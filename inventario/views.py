# --- LIBRERÍAS NATIVAS DE PYTHON ---
import csv
import io
import json
from datetime import datetime
import pandas as pd
import os
import time

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import update_session_auth_hash
from django.core.files.storage import FileSystemStorage
from django.conf import settings
from django.utils import timezone

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from bson.objectid import ObjectId

from .models import Usuario, Solicitud, PlantillaBaseDatos, RegistroIntegridad, HistorialCambio

ATLAS_URI = "mongodb+srv://Carlitos:HolaAngelo@lab.of8uhid.mongodb.net/?appName=Lab"

def get_mongo_client():
    return MongoClient(ATLAS_URI, server_api=ServerApi('1'))

# --- HELPER DE HISTORIAL (NUEVO) ---
def registrar_historial(user, tipo, detalle, base="-", coleccion="-", extra=None):
    try:
        HistorialCambio.objects.create(
            tipo_cambio=tipo,
            detalle_cambio=detalle,
            usuario=user.username if user and user.is_authenticated else 'Sistema',
            base=base or "-",
            coleccion=coleccion or "-",
            datos_extra=extra
        )
    except Exception as e:
        print("Error al guardar historial:", e)

def limpiar_archivos_temporales(horas_antiguedad=24):

    folder_path = os.path.join(settings.BASE_DIR, 'media', 'temp_import')
    
    if os.path.exists(folder_path):
        ahora = time.time()
        for filename in os.listdir(folder_path):
            file_path = os.path.join(folder_path, filename)
            if os.path.isfile(file_path):
                # Si el tiempo de modificación es menor a (ahora - horas en segundos)
                if os.stat(file_path).st_mtime < (ahora - (horas_antiguedad * 3600)):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"No se pudo borrar archivo temporal {filename}: {e}")

# ==========================================================
# ⚙️ HELPER CENTRAL Y NAVEGACIÓN

def get_contexto_navegacion(request):
    if not request.user.is_authenticated: return {}
    client = get_mongo_client()
    plantillas = PlantillaBaseDatos.objects.all()
    
    if not plantillas and request.user.rol in ['admin', 'superuser']:
        PlantillaBaseDatos.objects.create(nombre_db="Inventario_Principal", campos=[{"nombre": "Producto", "alias": "Producto", "tipo": "text"}, {"nombre": "Stock Actual", "alias": "Stock Actual", "tipo": "number"}])
        client["Inventario_Principal"].create_collection("Bodega_Central")
        client["Inventario_Principal"]["Bodega_Central"].insert_one({"_metadata": "Init"})
        plantillas = PlantillaBaseDatos.objects.all()

    menu_navegacion = {}
    primera_db, primera_coll = None, None

    for p in plantillas:
        cols_db = [c for c in client[p.nombre_db].list_collection_names() if not c.startswith('system')]
        if cols_db:
            menu_navegacion[p.nombre_db] = cols_db
            if not primera_db:
                primera_db = p.nombre_db
                primera_coll = cols_db[0]

    pref_db = request.user.db_preferida if request.user.db_preferida else primera_db
    pref_coll = request.user.bodega_preferida if request.user.bodega_preferida else primera_coll

    selected_db = request.GET.get('db', request.session.get('selected_db', pref_db))
    selected_coll = request.GET.get('bodega', request.session.get('selected_coll', pref_coll))

    if selected_db in menu_navegacion and selected_coll not in menu_navegacion[selected_db]:
        selected_coll = menu_navegacion[selected_db][0]

    request.session['selected_db'] = selected_db
    request.session['selected_coll'] = selected_coll
    puede_editar_global = request.user.puede_editar(selected_coll) if selected_coll else False

    return {'menu_navegacion': menu_navegacion, 'selected_db': selected_db, 'selected_coll': selected_coll, 'puede_editar': puede_editar_global}

def login_view(request):
    # Si el usuario ya está logueado, lo mandamos a la app
    if request.user.is_authenticated:
        return redirect('inventario')

    if request.method == 'POST':
        usuario_input = request.POST.get('usuario')
        password_input = request.POST.get('password')
        
        # 1. Validar si el nombre de usuario existe en la base de datos
        if not Usuario.objects.filter(username=usuario_input).exists():
            messages.error(request, "El usuario ingresado no existe en el sistema.")
            # Retornamos sin contexto para que los campos queden en blanco
            return render(request, 'inventario/login.html')
            
        # 2. Si el usuario existe, intentamos autenticar la contraseña
        user = authenticate(request, username=usuario_input, password=password_input)
        
        if user is not None:
            login(request, user)
            # Redirigimos a la página de inicio preferida del usuario
            return redirect(user.pagina_inicio)
        else:
            messages.error(request, "Contraseña incorrecta. Inténtalo de nuevo.")
            # Retornamos el nombre de usuario intentado para que el input no se borre
            return render(request, 'inventario/login.html', {'usuario_intentado': usuario_input})
            
    return render(request, 'inventario/login.html')

def logout_view(request):
    logout(request)
    return redirect('login')

@login_required
def exportar_excel(request, db_name, coll_name):
    client = get_mongo_client()
    datos = list(client[db_name][coll_name].find({"_metadata": {"$exists": False}}))
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = f'attachment; filename="Inventario_{db_name}_{coll_name}.csv"'
    writer = csv.writer(response, delimiter=';')
    if datos:
        headers = [k for k in datos[0].keys() if k != '_id']
        writer.writerow(headers)
        for doc in datos: writer.writerow([doc.get(h, '') for h in headers])
    return response

@login_required
def get_insumos_bodega(request):
    db_origen = request.GET.get('db')
    bodega = request.GET.get('bodega')
    insumos = []
    if db_origen and bodega:
        for doc in get_mongo_client()[db_origen][bodega].find({"_metadata": {"$exists": False}}):
            nombre = doc.get('Producto') or doc.get('nombre')
            if nombre and nombre not in insumos: insumos.append(nombre)
    return JsonResponse({'productos': sorted(insumos)})

@login_required
@csrf_exempt
def guardar_orden_form(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        request.user.orden_formularios = {**request.user.orden_formularios, data.get('plantilla'): data.get('orden')}
        request.user.save()
        return JsonResponse({'status': 'ok'})
    return JsonResponse({'status': 'error'})

# ==========================================================
# 📦 VISTA 1: INVENTARIO (ACTUALIZADO CON HISTORIAL)
# ==========================================================
@login_required
def inventario_view(request):
    ctx = get_contexto_navegacion(request)
    vista_actual = request.GET.get('vista', 'ver')
    ctx['vista_actual'] = vista_actual
    if not ctx.get('selected_db'): return render(request, 'inventario/inventario.html', ctx)

    client = get_mongo_client()
    selected_db, selected_coll = ctx['selected_db'], ctx['selected_coll']
    puede_editar = request.user.puede_editar(selected_coll)
    plantilla = PlantillaBaseDatos.objects.filter(nombre_db=selected_db).first()
    
    campos_tabla = [{"nombre": c['nombre'], "alias": c.get('alias', c['nombre']), "tipo": c['tipo']} for c in plantilla.campos] if plantilla else [{"nombre": "Producto", "alias": "Producto", "tipo": "text"}, {"nombre": "Stock Actual", "alias": "Stock Actual", "tipo": "number"}]
    campos_formulario = list(campos_tabla)
    if ctx.get('selected_db') in request.user.orden_formularios:
        orden = request.user.orden_formularios[selected_db]
        campos_formulario.sort(key=lambda c: orden.index(c['alias']) if c['alias'] in orden else 999)

    coleccion_actual = client[selected_db][selected_coll]
    
    if request.method == 'POST':
        action = request.POST.get('action')
        vista_post = request.POST.get('vista_actual', 'ver') 
        
        if action in ['crear', 'editar'] and puede_editar:
            doc_data = {}
            for c in campos_tabla:
                if c['tipo'] not in ['calc_stock', 'calc_venc']:
                    val = request.POST.get(f"campo_{c['nombre']}", '')
                    doc_data[c['nombre']] = int(val) if c['tipo'] == 'number' and val.isdigit() else val

            if action == 'crear':
                coleccion_actual.insert_one(doc_data)
                registrar_historial(request.user, 'creación', f"creó el producto {doc_data.get('Producto', 'Sin Nombre')}", selected_db, selected_coll)
                messages.success(request, "Registro creado exitosamente.")
            else:
                doc_id = request.POST.get('doc_id')
                old_doc = coleccion_actual.find_one({'_id': ObjectId(doc_id)})
                cambios = []
                for k, v in doc_data.items():
                    if str(old_doc.get(k, '')) != str(v): cambios.append(f"[{k}] a [{v}]")
                if cambios:
                    registrar_historial(request.user, 'modificación', f"editó {doc_data.get('Producto', 'Registro')}: {', '.join(cambios)}", selected_db, selected_coll)
                coleccion_actual.update_one({'_id': ObjectId(doc_id)}, {'$set': doc_data})
                messages.success(request, "Registro actualizado.")
                
        elif action == 'borrar' and request.user.rol in ['admin', 'superuser']:
            if request.user.check_password(request.POST.get('password_confirm')):
                for doc_id in request.POST.getlist('delete_ids'): 
                    doc = coleccion_actual.find_one({'_id': ObjectId(doc_id)})
                    if doc:
                        extra_json = json.dumps({k: str(v) for k, v in doc.items() if k != '_id'})
                        registrar_historial(request.user, 'eliminación', f"eliminó {doc.get('Producto', 'Registro')}", selected_db, selected_coll, extra_json)
                    coleccion_actual.delete_one({'_id': ObjectId(doc_id)})
                messages.success(request, "Registros eliminados.")
            else: messages.error(request, "Contraseña incorrecta.")
        return redirect(f'/?db={selected_db}&bodega={selected_coll}&vista={vista_post}')

    productos = []
    for doc in coleccion_actual.find({"_metadata": {"$exists": False}}):
        valores = []
        for c in campos_tabla:
            val = doc.get(c['nombre'], "-")
            if c['tipo'] == 'calc_stock':
                try: valores.append('CRÍTICO' if int(doc.get("Stock Actual", 0)) <= int(doc.get("Stock critico", 0)) and int(doc.get("Stock critico", 0)) > 0 else 'OK')
                except: valores.append('N/A')
            elif c['tipo'] == 'calc_venc':
                try: valores.append("Vencido" if (datetime.strptime(doc.get("Fecha Vencimiento", ""), "%d-%m-%Y") - datetime.now()).days < 0 else f"{(datetime.strptime(doc.get("Fecha Vencimiento", ""), '%d-%m-%Y') - datetime.now()).days} días")
                except: valores.append('-')
            else: valores.append(val)
        productos.append({'id': str(doc['_id']), 'valores': valores, 'nombre_producto': doc.get('Producto', 'Sin Nombre'), 'resumen_info': f"Stock: {doc.get('Stock Actual', 0)}", 'raw_json': json.dumps({k: str(v) for k, v in doc.items()})})

    ctx.update({'productos': productos, 'campos_tabla': campos_tabla, 'campos_formulario': campos_formulario, 'puede_editar': puede_editar})
    return render(request, 'inventario/inventario.html', ctx)

# ==========================================================
# 📨 VISTA 2: SOLICITUDES (ACTUALIZADO CON HISTORIAL)
# ==========================================================
@login_required
def solicitudes_view(request):
    ctx = get_contexto_navegacion(request)
    client = get_mongo_client()
            
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'crear_solicitud':
            db_o, coll_o = request.POST.get('req_origen').split('|')
            db_d, coll_d = request.POST.get('req_destino').split('|')
            cant = request.POST.get('req_cantidad')
            ins = request.POST.get('req_insumo')
            
            if db_o == db_d and coll_o == coll_d:
                messages.error(request, "Error: El destino no puede ser el mismo que el origen.")
                return redirect('solicitudes')

            Solicitud.objects.create(solicitante=request.user, insumo=ins, db_origen=db_o, bodega_origen=coll_o, db_destino=db_d, bodega_destino=coll_d, cantidad=int(cant), comentario=request.POST.get('req_comentario', ''))
            
            # SOLICITUD: Registra en el ORIGEN
            registrar_historial(request.user, 'solicitud', f"solicitó {cant} [{ins}] para {db_d} | {coll_d}", db_o, coll_o)
            messages.success(request, "Solicitud enviada correctamente.")

        elif action == 'procesar_solicitud' and request.user.rol in ['admin', 'superuser']:
            sol = Solicitud.objects.get(id=request.POST.get('req_id'))
            sol.estado = request.POST.get('nuevo_estado')
            
            if sol.estado == 'Modificada':
                raw_mod = request.POST.get('mod_origen')
                if raw_mod: sol.db_origen, sol.bodega_origen = raw_mod.split('|')
                cant_anterior = sol.cantidad
                sol.cantidad = int(request.POST.get('mod_cantidad', sol.cantidad))
                registrar_historial(request.user, 'solicitud', f"modificó solicitud de {sol.solicitante.username}: de {cant_anterior} a {sol.cantidad} [{sol.insumo}] (Destino: {sol.db_destino} | {sol.bodega_destino})", sol.db_origen, sol.bodega_origen)
            elif sol.estado == 'Aprobada': 
                registrar_historial(request.user, 'solicitud', f"aprobó solicitud de {sol.solicitante.username}: {sol.cantidad} [{sol.insumo}] (Destino: {sol.db_destino} | {sol.bodega_destino})", sol.db_origen, sol.bodega_origen)
            elif sol.estado == 'Rechazada': 
                registrar_historial(request.user, 'solicitud', f"rechazó solicitud de {sol.solicitante.username}: {sol.cantidad} [{sol.insumo}] (Destino: {sol.db_destino} | {sol.bodega_destino})", sol.db_origen, sol.bodega_origen)
            
            sol.save()
            messages.success(request, f"Solicitud marcada como {sol.estado}.")

        elif action == 'recepcionar':
            sol = Solicitud.objects.get(id=request.POST.get('req_id'))
            if request.user.puede_editar(sol.bodega_destino):
                decision = request.POST.get('decision_recepcion')
                
                if decision == 'cancelar':
                    sol.estado = 'Cancelada'
                    sol.save()
                    # Cancelación por el receptor: Se registra en el destino
                    registrar_historial(request.user, 'solicitud', f"rechazó/canceló la recepción de {sol.cantidad} [{sol.insumo}]", sol.db_destino, sol.bodega_destino)
                    messages.success(request, "Solicitud cancelada en destino.")
                
                elif decision in ['completo', 'parcial']:
                    cant_r = int(request.POST.get('cantidad_recibida', sol.cantidad)) if decision == 'parcial' else sol.cantidad
                    doc_o = client[sol.db_origen][sol.bodega_origen].find_one({"Producto": sol.insumo})
                    
                    if doc_o and int(doc_o.get("Stock Actual", 0)) >= cant_r:
                        # Descuento en Origen
                        client[sol.db_origen][sol.bodega_origen].update_one({"_id": doc_o["_id"]}, {"$inc": {"Stock Actual": -cant_r}})
                        
                        # Aumento en Destino
                        doc_d = client[sol.db_destino][sol.bodega_destino].find_one({"Producto": sol.insumo})
                        if doc_d: 
                            client[sol.db_destino][sol.bodega_destino].update_one({"_id": doc_d["_id"]}, {"$inc": {"Stock Actual": cant_r}})
                        else:
                            nd = {k: v for k, v in doc_o.items() if k != '_id'}
                            nd["Stock Actual"] = cant_r
                            client[sol.db_destino][sol.bodega_destino].insert_one(nd)
                        
                        # Manejo de Estado Parcial o Completo
                        if decision == 'parcial':
                            sol.estado = f'Parcial [{cant_r}/{sol.cantidad}]'
                            nota = f"[Llegada Parcial: {cant_r} de {sol.cantidad}]"
                            sol.comentario = f"{sol.comentario} {nota}".strip() if sol.comentario else nota
                            sol.save()
                            # RECEPCIÓN: Registra en el DESTINO
                            registrar_historial(request.user, 'solicitud', f"recepcionó PARCIALMENTE ({cant_r} de {sol.cantidad}) de [{sol.insumo}] proveniente de {sol.db_origen} | {sol.bodega_origen}", sol.db_destino, sol.bodega_destino)
                            messages.success(request, f"Recepción parcial confirmada ({cant_r} unidades).")
                        else:
                            sol.estado = 'Recepcionada'
                            sol.save()
                            # RECEPCIÓN: Registra en el DESTINO
                            registrar_historial(request.user, 'solicitud', f"recepcionó {sol.cantidad} [{sol.insumo}] proveniente de {sol.db_origen} | {sol.bodega_origen}", sol.db_destino, sol.bodega_destino)
                            messages.success(request, f"Recepción confirmada exitosamente.")
                    else:
                        messages.error(request, "Error crítico: El stock actual en origen es menor al que intentas recepcionar.")
            return redirect('solicitudes')

        elif action == 'cancelar_solicitud':
            sol = Solicitud.objects.get(id=request.POST.get('req_id'))
            sol.estado = 'Cancelada'
            sol.save()
            registrar_historial(request.user, 'solicitud', f"canceló la solicitud de {sol.cantidad} [{sol.insumo}] hacia {sol.db_destino} | {sol.bodega_destino}", sol.db_origen, sol.bodega_origen)
            messages.success(request, "Solicitud cancelada.")

        elif action == 'borrar_solicitud' and request.user.rol in ['admin', 'superuser']:
            Solicitud.objects.get(id=request.POST.get('req_id')).delete()
            messages.success(request, "Registro de solicitud eliminado de la vista.")
        return redirect('solicitudes')

    sols = Solicitud.objects.all().order_by('-fecha_creacion')
    for s in sols: s.puede_recepcionar = request.user.puede_editar(s.bodega_destino)
    ctx.update({'solicitudes': sols})
    return render(request, 'inventario/solicitudes.html', ctx)

# ==========================================================
# ⚙️ VISTA 3: GESTIÓN DE BASES DE DATOS (ACTUALIZADO CON HISTORIAL)
# ==========================================================
# ==========================================================
# ⚙️ VISTA 3: GESTIÓN DE BASES DE DATOS (IMPORTACIÓN CORREGIDA)
# ==========================================================
@login_required
def gestion_bd_view(request):
    if request.user.rol not in ['admin', 'superuser']: return redirect('inventario')
    limpiar_archivos_temporales(horas_antiguedad=24) 
    ctx = get_contexto_navegacion(request)
    client = get_mongo_client()
    fs = FileSystemStorage(location='media/temp_import')
    vista_actual = request.GET.get('vista', 'crear_db')
    if request.method == 'POST' and request.POST.get('vista_actual') == 'importar': vista_actual = 'importar'
    ctx['vista_actual'] = vista_actual
    lista_bds_existentes = list(PlantillaBaseDatos.objects.values_list('nombre_db', flat=True))

    if request.method == 'POST':
        action = request.POST.get('action')
        vista_post = request.POST.get('vista_actual', 'crear_db')
        
        if action == 'crear_db':
            nombre_db = request.POST.get('nombre_db')
            nombres = request.POST.getlist('campo_nombre[]')
            tipos = request.POST.getlist('campo_tipo[]')
            campos_limpios = []
            for n, t in zip(nombres, tipos):
                if n.strip() and not any(c['nombre'] == n.strip() for c in campos_limpios):
                    campos_limpios.append({"nombre": n.strip(), "alias": n.strip(), "tipo": "text" if n.strip()=="Producto" else "number" if n.strip()=="Stock Actual" else t})
            if not any(c['nombre'] == 'Producto' for c in campos_limpios): campos_limpios.insert(0, {"nombre": "Producto", "alias": "Producto", "tipo": "text"})
            if not any(c['nombre'] == 'Stock Actual' for c in campos_limpios): campos_limpios.insert(1, {"nombre": "Stock Actual", "alias": "Stock Actual", "tipo": "number"})
            
            p_old = PlantillaBaseDatos.objects.filter(nombre_db=nombre_db).first()
            if not p_old:
                registrar_historial(request.user, 'creación', f"creó la base de datos {nombre_db}", nombre_db)
            else:
                old_dict = {c['nombre']: c for c in p_old.campos}
                new_dict = {c['nombre']: c for c in campos_limpios}
                cambios = []
                # Detectar agregados y editados
                for n, c in new_dict.items():
                    if n not in old_dict: 
                        cambios.append(f"agregó el campo [{n}] ({c['tipo']})")
                    elif old_dict[n]['tipo'] != c['tipo'] or old_dict[n].get('alias', old_dict[n]['nombre']) != c.get('alias', c['nombre']):
                        cambios.append(f"editó el campo [{n}] (Tipo: {c['tipo']})")
                # Detectar eliminados
                for n in old_dict:
                    if n not in new_dict: 
                        cambios.append(f"eliminó el campo [{n}]")
                
                # Agrupar todo en una sola modificación
                if cambios: 
                    registrar_historial(request.user, 'modificación', f"editó los campos de la base {nombre_db}: {', '.join(cambios)}", nombre_db)

            PlantillaBaseDatos.objects.update_or_create(nombre_db=nombre_db, defaults={'campos': campos_limpios})
            messages.success(request, f"Arquitectura guardada.")
            return redirect(f'/gestion-bd/?vista={vista_post}')

        elif action == 'crear_coleccion':
            db, coll = request.POST.get('db_padre'), request.POST.get('nueva_coll')
            client[db].create_collection(coll); client[db][coll].insert_one({"_metadata": "Init"})
            registrar_historial(request.user, 'creación', f"creó la colección {coll} en la base {db}", db, coll)
            messages.success(request, "Colección creada.")
            return redirect(f'/gestion-bd/?vista={vista_post}')

        elif action == 'previsualizar_importacion':
            filename = fs.save(request.FILES['archivo_importar'].name, request.FILES['archivo_importar']) if 'archivo_importar' in request.FILES else request.POST.get('filename_existente')
            fila_encabezado = int(request.POST.get('fila_encabezado', 1)) - 1
            sheet_names = []
            current_sheet = request.POST.get('sheet_seleccionada')
            
            # --- LECTOR MEJORADO DE CSV Y EXCEL ---
            file_path = fs.path(filename)
            try:
                if filename.endswith(('.xlsx', '.xls')):
                    with pd.ExcelFile(file_path) as xls:
                        sheet_names = xls.sheet_names
                        if not current_sheet and sheet_names: current_sheet = sheet_names[0]
                        df = pd.read_excel(xls, header=fila_encabezado, sheet_name=current_sheet)
                else: 
                    # csv con detección automática de separador (sep=None) y fallback de codificación
                    try:
                        df = pd.read_csv(file_path, header=fila_encabezado, sep=None, engine='python', encoding='utf-8')
                    except UnicodeDecodeError:
                        df = pd.read_csv(file_path, header=fila_encabezado, sep=None, engine='python', encoding='latin-1')
                        
                p = PlantillaBaseDatos.objects.filter(nombre_db=request.POST.get('target_db_select')).first()
                c_ext = [c['alias'] for c in p.campos] if p else []
                columnas_info = [{'original': str(col), 'match_sugerido': str(col) if str(col) in c_ext else "", 'tipo': 'text'} for col in df.columns]
                
                ctx.update({'importacion_fase': 'confirmar', 'file_name': filename, 'columnas_info': columnas_info, 'header_row': fila_encabezado+1, 'sheet_names': sheet_names, 'current_sheet': current_sheet, 'vista_actual': 'importar', 'modo_destino': request.POST.get('modo_destino'), 'target_db_select': request.POST.get('target_db_select'), 'campos_existentes_db': c_ext})
                return render(request, 'inventario/gestion_bd.html', ctx)
            
            except Exception as e:
                messages.error(request, f"Error al leer el archivo: Comprueba el formato o el delimitador. ({str(e)})")
                return redirect('/gestion-bd/?vista=importar')

        elif action == 'confirmar_importacion':
            db = request.POST.get('target_db_select') if request.POST.get('modo_destino') == 'existente' else request.POST.get('nombre_db_final')
            coll = request.POST.get('nombre_coll_final')
            file_path = fs.path(request.POST.get('file_name'))
            sheet_final = request.POST.get('sheet_final')
            
            try:
                # --- LECTURA SEGURA PARA EL GUARDADO FINAL ---
                if file_path.endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(file_path, header=int(request.POST.get('header_row'))-1, sheet_name=sheet_final if sheet_final else 0)
                else: 
                    try: df = pd.read_csv(file_path, header=int(request.POST.get('header_row'))-1, sep=None, engine='python', encoding='utf-8')
                    except UnicodeDecodeError: df = pd.read_csv(file_path, header=int(request.POST.get('header_row'))-1, sep=None, engine='python', encoding='latin-1')
                    
                p = PlantillaBaseDatos.objects.filter(nombre_db=db).first()
                campos = p.campos if p else []
                df_f = pd.DataFrame()
                
                for idx, orig in enumerate(request.POST.getlist('col_original')):
                    if request.POST.getlist('col_estado')[idx] == "1":
                        alias = request.POST.getlist('col_nueva')[idx].strip() or orig
                        tipo = request.POST.getlist('col_tipo')[idx]
                        n_int = "Producto" if orig == request.POST.get('rol_producto_select') else "Stock Actual" if orig == request.POST.get('rol_stock_select') else alias.replace('.','')
                        if p:
                            for c in p.campos:
                                if c.get('alias') == alias: n_int = c['nombre']
                        if orig in df.columns:
                            serie = df[orig].copy()
                            df_f[n_int] = pd.to_numeric(serie.astype(str).str.replace(r'[^\d\.\-]', '', regex=True), errors='coerce').fillna(0) if tipo in ['number','decimal','calc_stock'] else serie.fillna('').astype(str)
                            if not any(c['nombre'] == n_int for c in campos): campos.append({'nombre': n_int, 'alias': alias, 'tipo': tipo})

                for c in campos:
                    if c['nombre'] not in df_f.columns: df_f[c['nombre']] = 0 if c['tipo'] in ['number','decimal'] else ""

                if not df_f.empty:
                    registros = df_f.to_dict('records')
                    if coll not in client[db].list_collection_names(): client[db].create_collection(coll); client[db][coll].insert_one({"_metadata": "Init"})
                    client[db][coll].insert_many(registros)
                    PlantillaBaseDatos.objects.update_or_create(nombre_db=db, defaults={'campos': campos})
                    
                    # --- HISTORIAL CON DETALLES JSON ---
                    columnas_importadas = [c['alias'] for c in campos if c['nombre'] in df_f.columns]
                    detalles_json = json.dumps({"Columnas Importadas": columnas_importadas, "Total Filas": len(registros)})
                    registrar_historial(request.user, 'importación', f"importó {len(registros)} registros a {db} (Colección: {coll})", db, coll, extra=detalles_json)
                    
                    messages.success(request, f"Importación exitosa. Se cargaron {len(registros)} registros.")
            except Exception as e: 
                messages.error(request, f"Error al procesar el archivo: {e}")
            return redirect('/gestion-bd/?vista=editar_bd')

        elif action == 'renombrar_coleccion':
            if request.user.check_password(request.POST.get('password_confirm')):
                client[request.POST.get('db_origen')][request.POST.get('coll_antigua')].rename(request.POST.get('coll_nueva'))
                registrar_historial(request.user, 'modificación', f"renombró la colección {request.POST.get('coll_antigua')} a {request.POST.get('coll_nueva')}", request.POST.get('db_origen'))
                messages.success(request, "Colección renombrada.")
            return redirect('/gestion-bd/?vista=editar_bd')
        
        elif action == 'renombrar_db':
            if request.user.check_password(request.POST.get('password_confirm')):
                old, new = request.POST.get('db_antigua'), request.POST.get('db_nueva')
                for c in client[old].list_collection_names():
                    if not c.startswith('system'): client[old][c].aggregate([{"$match": {}}, {"$out": {"db": new, "coll": c}}])
                p = PlantillaBaseDatos.objects.filter(nombre_db=old).first()
                if p: p.nombre_db = new; p.save()
                client.drop_database(old)
                registrar_historial(request.user, 'modificación', f"renombró la base de datos {old} a {new}")
                messages.success(request, "Base de datos renombrada.")
            return redirect('/gestion-bd/?vista=editar_bd')

        elif action == 'borrar_db':
            if request.user.check_password(request.POST.get('password_confirm')):
                nm = request.POST.get('borrar_db_nombre')
                for c in client[nm].list_collection_names():
                    if not c.startswith('system'): registrar_historial(request.user, 'eliminación', f"eliminó {c}", nm)
                registrar_historial(request.user, 'eliminación', f"eliminó la base de datos {nm}", nm)
                client.drop_database(nm); PlantillaBaseDatos.objects.filter(nombre_db=nm).delete()
                messages.success(request, "Base eliminada.")
            return redirect(f'/gestion-bd/?vista={vista_post}')

        elif action == 'borrar_coleccion':
            if request.user.check_password(request.POST.get('password_confirm')):
                db, coll = request.POST.get('borrar_db_nombre'), request.POST.get('borrar_coll_nombre')
                registrar_historial(request.user, 'eliminación', f"eliminó {coll}", db)
                client[db].drop_collection(coll); messages.success(request, "Colección eliminada.")
            return redirect(f'/gestion-bd/?vista={vista_post}')

    arbol_dbs = [{'nombre': p.nombre_db, 'campos': p.campos, 'colecciones': [c for c in client[p.nombre_db].list_collection_names() if not c.startswith('system')]} for p in PlantillaBaseDatos.objects.all()]
    ctx.update({'arbol_dbs': arbol_dbs, 'lista_bds_existentes': lista_bds_existentes})
    return render(request, 'inventario/gestion_bd.html', ctx)

# ==========================================================
# 📋 VISTA 4: REGISTROS DE INTEGRIDAD Y CALIDAD
# ==========================================================
@login_required
def registros_view(request):
    ctx = get_contexto_navegacion(request)
    vista_actual = request.GET.get('vista', 'crear')
    ctx['vista_actual'] = vista_actual
    client = get_mongo_client()

    if request.method == 'POST':
        action = request.POST.get('action')
        
        # --- 1. GUARDAR NUEVO REGISTRO ---
        if action == 'guardar_registro':
            db_origen, coll_origen, c_stock = request.POST.get('db_origen'), request.POST.get('coll_origen'), request.POST.get('campo_cantidad_origen', 'Stock Actual')
            registros = json.loads(request.POST.get('datos_json', '[]'))
            creados = 0
            for reg in registros:
                if reg.get('estatus'): 
                    try: cant_segura = int(float(reg.get('cantidad') or 0))
                    except ValueError: cant_segura = 0

                    RegistroIntegridad.objects.create(
                        nombre_monitor=request.POST.get('nombre_monitor'), 
                        ubicacion=reg.get('ubicacion', ''), 
                        equipo=reg.get('equipo', ''), 
                        cantidad=cant_segura, 
                        estatus=reg.get('estatus'), 
                        accion_correctiva=reg.get('acciones_hidden', ''), 
                        observacion=reg.get('observacion', ''), 
                        db_origen=db_origen, 
                        coll_origen=coll_origen, 
                        mongo_doc_id=reg.get('doc_id', ''), 
                        campo_cantidad_origen=c_stock
                    )
                    creados += 1
                    
                    if str(reg.get('cantidad', '')) != str(reg.get('cantidad_orig', '')):
                        try: client[db_origen][coll_origen].update_one({'_id': ObjectId(reg['doc_id'])}, {'$set': {c_stock: cant_segura}})
                        except: pass
            if creados > 0:
                registrar_historial(request.user, 'registros', f"hizo control en {db_origen} {coll_origen} de {creados} equipos", db_origen, coll_origen)
                messages.success(request, f"Se guardaron {creados} registros.")
            return redirect('/registros/?vista=ver')

        # --- 2. EDITAR REGISTRO ---
        elif action == 'editar_registro':
            r = RegistroIntegridad.objects.get(id=request.POST.get('registro_id'))
            
            try: nueva_cantidad = int(float(request.POST.get('edit_cantidad', r.cantidad)))
            except ValueError: nueva_cantidad = r.cantidad
            
            nuevo_estatus = request.POST.get('edit_estatus')
            nuevas_acciones = request.POST.get('edit_acciones_hidden', '')
            nueva_obs = request.POST.get('edit_observacion', '')

            cambios = []
            if r.cantidad != nueva_cantidad:
                cambios.append(f"Cantidad de [{r.cantidad}] a [{nueva_cantidad}]")
                try: client[r.db_origen][r.coll_origen].update_one({'_id': ObjectId(r.mongo_doc_id)}, {'$set': {r.campo_cantidad_origen: nueva_cantidad}})
                except: pass
            if r.estatus != nuevo_estatus: cambios.append(f"Estatus de [{r.estatus}] a [{nuevo_estatus}]")
            if r.accion_correctiva != nuevas_acciones: cambios.append(f"Acciones de [{r.accion_correctiva}] a [{nuevas_acciones}]")
            if r.observacion != nueva_obs: cambios.append(f"Observación de [{r.observacion}] a [{nueva_obs}]")

            r.cantidad = nueva_cantidad
            r.estatus = nuevo_estatus
            r.accion_correctiva = nuevas_acciones
            r.observacion = nueva_obs
            r.save()

            if cambios:
                registrar_historial(request.user, 'modificación', f"editó {r.equipo}: {', '.join(cambios)}", r.db_origen, r.coll_origen)
            
            messages.success(request, "Registro actualizado.")
            return redirect('/registros/?vista=ver')

        # --- 3. DESCARGAR EXCEL ---
        elif action == 'descargar_excel':
            tipo_descarga, planta = request.POST.get('tipo_descarga'), request.POST.get('planta_select')
            if planta == 'Otra': planta = request.POST.get('planta_otra').strip()
            
            # Filtramos también por la BD actual para que descargue solo lo de esa planta
            selected_db = ctx.get('selected_db')
            selected_coll = ctx.get('selected_coll')
            
            registros_q = RegistroIntegridad.objects.filter(db_origen=selected_db, coll_origen=selected_coll).order_by('fecha_monitoreo')
            
            if tipo_descarga == 'mes':
                mes_str = request.POST.get('filtro_mes')
                año, mes_num = mes_str.split('-')
                registros_q = registros_q.filter(fecha_monitoreo__year=año, fecha_monitoreo__month=mes_num)
                nombre_archivo = f"POE.02.R.01065_Registro de Integridad_{año}_{mes_num}_{planta}.xlsx"
            else:
                f_inicio, f_fin = request.POST.get('fecha_inicio'), request.POST.get('fecha_fin')
                fecha_i, fecha_f = datetime.strptime(f_inicio, '%Y-%m-%d'), datetime.strptime(f_fin, '%Y-%m-%d')
                registros_q = registros_q.filter(fecha_monitoreo__date__gte=fecha_i, fecha_monitoreo__date__lte=fecha_f)
                ai, af, mi, mf = fecha_i.strftime('%Y'), fecha_f.strftime('%Y'), fecha_i.strftime('%m'), fecha_f.strftime('%m')
                nombre_archivo = f"POE.02.R.01065_Registro de Integridad_{ai if ai==af else f'{ai}-{af}'}_{mi if (ai==af and mi==mf) else f'{mi}-{mf}'}_{planta}.xlsx"

            df = pd.DataFrame([{'Fecha Monitoreo': r.fecha_monitoreo.strftime('%d-%m-%Y'), 'Nombre Monitor': r.nombre_monitor, 'Ubicación': r.ubicacion, 'Equipo': r.equipo, 'Cantidad': r.cantidad, 'Estatus (C/NC)': r.estatus, 'Acción Correctiva': r.accion_correctiva, 'Observación': r.observacion, 'Verificación': r.verificacion} for r in registros_q])
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Registros')
                worksheet = writer.sheets['Registros']
                worksheet.auto_filter.ref = worksheet.dimensions
                for col in worksheet.columns:
                    max_length = max([len(str(cell.value)) for cell in col] + [0])
                    worksheet.column_dimensions[col[0].column_letter].width = (max_length + 2)
            
            output.seek(0)
            response = HttpResponse(output.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
            return response

        # --- 4. VERIFICAR REGISTROS ---
        elif action == 'verificar_registros':
            if request.user.rol in ['admin', 'superuser']:
                if request.user.check_password(request.POST.get('password_confirm')):
                    ids = request.POST.getlist('verificar_ids')
                    if ids:
                        RegistroIntegridad.objects.filter(id__in=ids).update(estado_verificacion='Verificado', verificacion=f"Verificado por {request.user.username} el {timezone.now().strftime('%d-%m-%Y')}")
                        registrar_historial(request.user, 'registros', f"verificó {len(ids)} registros pendientes", ctx.get('selected_db'), ctx.get('selected_coll'))
                        messages.success(request, f"¡Éxito! {len(ids)} registros firmados.")
                else: messages.error(request, "Contraseña incorrecta.")
            return redirect('/registros/?vista=verificar')

        # --- 5. BORRAR MASIVO Y DESCARGAR ---
        elif action == 'borrar_registros':
            if request.user.rol in ['admin', 'superuser'] and request.user.check_password(request.POST.get('password_confirm')):
                ids = request.POST.getlist('delete_ids')
                if ids:
                    regs = RegistroIntegridad.objects.filter(id__in=ids)
                    count = regs.count()
                    for r in regs:
                        extra = json.dumps({'Equipo': r.equipo, 'Estatus': r.estatus, 'Fecha': r.fecha_monitoreo.strftime('%Y-%m-%d %H:%M')})
                        registrar_historial(request.user, 'eliminación', f"eliminó registro de integridad [{r.equipo}]", r.db_origen, r.coll_origen, extra=extra)
                    regs.delete()
                    messages.success(request, f"Se eliminaron {count} registros.")
            else: messages.error(request, "Contraseña incorrecta o permisos insuficientes.")
            return redirect('/registros/?vista=ver')

        elif action == 'descargar_borrado':
            ids = request.POST.getlist('delete_ids')
            registros_q = RegistroIntegridad.objects.filter(id__in=ids).order_by('fecha_monitoreo')
            df = pd.DataFrame([{'Fecha Monitoreo': r.fecha_monitoreo.strftime('%d-%m-%Y %H:%M'), 'Monitor': r.nombre_monitor, 'Base': r.db_origen, 'Colección': r.coll_origen, 'Ubicación': r.ubicacion, 'Equipo': r.equipo, 'Cantidad': r.cantidad, 'Estatus': r.estatus, 'Acciones': r.accion_correctiva, 'Observación': r.observacion} for r in registros_q])
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Borrados')
                worksheet = writer.sheets['Borrados']
                worksheet.auto_filter.ref = worksheet.dimensions
                for col in worksheet.columns:
                    worksheet.column_dimensions[col[0].column_letter].width = (max([len(str(cell.value)) for cell in col] + [0]) + 2)
            
            output.seek(0)
            response = HttpResponse(output.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="Respaldo_Registros_Borrados.xlsx"'
            return response

    # =======================================================
    # PREPARACIÓN DE DATOS (LECTURA) DEPENDIENDO DEL ENTORNO
    # =======================================================
    selected_db = ctx.get('selected_db')
    selected_coll = ctx.get('selected_coll')
    colecciones_db = ctx['menu_navegacion'].get(selected_db, [])
    
    if vista_actual == 'crear':
        productos, campos_disponibles = [], []
        if selected_db and selected_coll:
            plantilla = PlantillaBaseDatos.objects.filter(nombre_db=selected_db).first()
            if plantilla: campos_disponibles = [c['nombre'] for c in plantilla.campos]
            for doc in client[selected_db][selected_coll].find({"_metadata": {"$exists": False}}):
                productos.append({'id': str(doc.pop('_id')), 'raw_json': json.dumps({k: str(v) for k, v in doc.items()}), 'data': doc})
        
        # Filtra historial de acciones SOLO para el entorno seleccionado
        hace_un_mes = timezone.now() - timezone.timedelta(days=30)
        historial = RegistroIntegridad.objects.filter(
            db_origen=selected_db, coll_origen=selected_coll, fecha_monitoreo__gte=hace_un_mes
        ).exclude(accion_correctiva='').order_by('-fecha_monitoreo')[:50]
        
        ctx.update({'productos': productos, 'campos_disponibles': campos_disponibles, 'historial_acciones': historial, 'colecciones_db': colecciones_db})

    elif vista_actual == 'ver':
        # Muestra solo registros del entorno seleccionado
        registros = RegistroIntegridad.objects.filter(db_origen=selected_db, coll_origen=selected_coll).order_by('-fecha_monitoreo')
        ctx.update({'registros': registros, 'colecciones_db': colecciones_db})
        
    elif vista_actual == 'verificar' and request.user.rol in ['admin', 'superuser']:
        # Muestra solo pendientes del entorno seleccionado
        pendientes = RegistroIntegridad.objects.filter(db_origen=selected_db, coll_origen=selected_coll, estado_verificacion='Pendiente de verificación').order_by('fecha_monitoreo')
        ctx.update({'registros_pendientes': pendientes, 'colecciones_db': colecciones_db})

    return render(request, 'inventario/registros.html', ctx)

# ==========================================================
# 👥 USUARIOS Y CONFIGURACION (ACTUALIZADO CON HISTORIAL)
# ==========================================================
@login_required
def usuarios_view(request):
    # Ahora admins y superusers pueden entrar a ver/crear
    if request.user.rol not in ['admin', 'superuser']: return redirect('inventario')
    ctx = get_contexto_navegacion(request)
    vista_actual = request.GET.get('vista', 'ver'); ctx['vista_actual'] = vista_actual
    todas_colecciones = []
    for db_name, cols in ctx.get('menu_navegacion', {}).items(): todas_colecciones.extend(cols)

    if request.method == 'POST':
        action = request.POST.get('action')
        pass_por_defecto = f"agrotop{timezone.now().year}" # Clave dinámica: agrotop2026

        if action == 'guardar_usuario':
            u_id = request.POST.get('u_id')
            
            if u_id:
                user_obj = Usuario.objects.get(id=u_id)
                # SEGURIDAD: Evitar que un admin edite a un superuser
                if user_obj.rol == 'superuser' and request.user.rol != 'superuser':
                    messages.error(request, "Acceso denegado: No tienes jerarquía para editar a un Super Usuario.")
                    return redirect('/usuarios/?vista=ver')
            else:
                user_obj = Usuario(username=request.POST.get('u_name'))

            user_obj.username = request.POST.get('u_name')
            user_obj.rol = request.POST.get('u_role')
            user_obj.permisos_colecciones = request.POST.getlist('u_permisos')
            user_obj.save()
            messages.success(request, "Usuario guardado exitosamente.")
            
        elif action == 'restablecer_password' and request.user.rol == 'superuser':
            if request.user.check_password(request.POST.get('password_confirm')):
                u_reset = Usuario.objects.get(id=request.POST.get('reset_u_id'))
                u_reset.set_password(pass_por_defecto)
                u_reset.save()
                registrar_historial(request.user, 'modificación', f"restableció contraseña de [{u_reset.username}]")
                messages.success(request, f"Contraseña restablecida a la por defecto para {u_reset.username}.")
            else: messages.error(request, "Firma electrónica incorrecta.")

        elif action == 'borrar_usuario' and request.user.rol == 'superuser':
            if request.user.check_password(request.POST.get('password_confirm')):
                u_id = request.POST.get('borrar_u_id')
                if str(request.user.id) == str(u_id): messages.error(request, "No puedes eliminar tu propio usuario.")
                else: 
                    u_borrar = Usuario.objects.get(id=u_id)
                    registrar_historial(request.user, 'eliminación', f"eliminó a [{u_borrar.username}]")
                    u_borrar.delete()
                    messages.success(request, "Usuario eliminado permanentemente.")
            else: messages.error(request, "Firma electrónica incorrecta.")
        return redirect('/usuarios/?vista=ver')

    ctx.update({'usuarios_app': Usuario.objects.all(), 'colecciones_globales': todas_colecciones})
    return render(request, 'inventario/usuarios.html', ctx)

@login_required
def configuracion_view(request):
    ctx = get_contexto_navegacion(request)
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'actualizar_preferencias':
            if request.POST.get('tema') in ['light', 'dark', 'system']: request.user.tema = request.POST.get('tema')
            if request.POST.get('pantalla_inicio') in ['inventario', 'solicitudes']: request.user.pagina_inicio = request.POST.get('pantalla_inicio')
            if request.POST.get('entorno_pref'): request.user.db_preferida, request.user.bodega_preferida = request.POST.get('entorno_pref').split('|')
            else: request.user.db_preferida = ""; request.user.bodega_preferida = ""
            request.user.save(); messages.success(request, "Preferencias actualizadas.")
        elif action == 'actualizar_password':
            if not request.user.check_password(request.POST.get('current_pass')): messages.error(request, "Contraseña actual incorrecta.")
            elif request.POST.get('new_pass') != request.POST.get('confirm_pass'): messages.error(request, "Contraseñas no coinciden.")
            else: request.user.set_password(request.POST.get('new_pass')); request.user.save(); update_session_auth_hash(request, request.user); messages.success(request, "Contraseña actualizada.")
        return redirect('configuracion')
    return render(request, 'inventario/configuracion.html', ctx)

# ==========================================================
# 📜 VISTA 5: HISTORIAL Y AUDITORÍA (NUEVO)
# ==========================================================
@login_required
def historial_view(request):
    ctx = get_contexto_navegacion(request)
    
    if request.method == 'POST':
        if request.POST.get('action') == 'borrar_historial' and request.user.rol == 'superuser':
            if request.user.check_password(request.POST.get('password_confirm')):
                ids = request.POST.getlist('delete_ids')
                if ids:
                    borrados = HistorialCambio.objects.filter(id__in=ids).delete()[0]
                    # Opcional: el super usuario se audita a sí mismo para evitar borrar huellas ocultas
                    registrar_historial(request.user, 'eliminación', f"depuró {borrados} registros del historial del sistema")
                    messages.success(request, f"Se eliminaron {borrados} registros del historial.")
            else:
                messages.error(request, "Firma electrónica incorrecta.")
        return redirect('historial')
        
    ctx['historial_completo'] = HistorialCambio.objects.all()
    return render(request, 'inventario/historial.html', ctx)

