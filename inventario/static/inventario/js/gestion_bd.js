document.addEventListener("DOMContentLoaded", function() {
    var contenedorCrear = document.getElementById('contenedor-campos'); 
    if(contenedorCrear) new Sortable(contenedorCrear, { handle: '.drag-handle', animation: 150, ghostClass: 'bg-warning-subtle' });
    
    var elMapeo = document.getElementById('tablaMapeo'); 
    if(elMapeo) new Sortable(elMapeo, { handle: '.drag-handle', animation: 150, ghostClass: 'bg-light' });
});

function activarEdicion(id) {
    let form = document.getElementById(`form-bd-${id}`);
    form.querySelector('.btn-habilitar').style.display = 'none';
    form.querySelector('.indicativo-arrastre').style.display = 'inline-block';
    form.querySelector('.acciones-edicion').style.setProperty('display', 'flex', 'important');
    form.querySelectorAll('.input-editable').forEach(inp => { inp.removeAttribute('readonly'); inp.classList.remove('bg-body-secondary'); });
    form.querySelectorAll('.select-editable').forEach(sel => { sel.style.pointerEvents = 'auto'; sel.classList.remove('bg-body-secondary', 'text-muted'); });
    form.querySelectorAll('.drag-handle-edit').forEach(el => el.style.display = 'block');
    form.querySelectorAll('.btn-delete-edit').forEach(el => el.style.display = 'block');
    new Sortable(document.getElementById(`sortable-${id}`), { handle: '.drag-handle', animation: 150, ghostClass: 'bg-warning-subtle' });
}

function agregarCampoAExistente(id_contenedor) {
    const contenedor = document.getElementById(id_contenedor);
    const fila = document.createElement('div');
    fila.className = 'row g-2 mb-2 align-items-center bg-body p-2 border rounded shadow-sm item-campo';
    fila.innerHTML = `<div class="col-auto text-muted drag-handle drag-handle-edit" style="cursor: grab; font-size: 1.2rem;" title="Arrastrar">☰</div><div class="col-md-5"><input type="text" name="campo_nombre[]" class="form-control border-secondary-subtle fw-semibold" placeholder="Nombre" required></div><div class="col-md-4"><select name="campo_tipo[]" class="form-select border-secondary-subtle" required><option value="text">Texto</option><option value="number">Número</option><option value="date">Fecha</option><option value="calc_stock">Stock</option><option value="calc_venc">Vencimiento</option></select></div><div class="col-auto btn-delete-edit"><button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('.item-campo').remove()"><img src="${URL_ICONO_BASURERO}" width="16"></button></div>`;
    contenedor.appendChild(fila);
}

function toggleFila(checkbox) {
    let hiddenInput = checkbox.parentElement.querySelector('input[type="hidden"]');
    let row = checkbox.closest('tr');
    if (checkbox.checked) { hiddenInput.value = "1"; row.style.opacity = "1"; row.querySelectorAll('input[type="text"], select, input[type="radio"]').forEach(i => i.disabled = false); } 
    else { hiddenInput.value = "0"; row.style.opacity = "0.5"; row.querySelectorAll('input[type="text"], select, input[type="radio"]').forEach(i => i.disabled = true); }
}

function abrirModalBorrar(tipo, dbNombre, collNombre) {
    document.getElementById('borrar_db_nombre').value = dbNombre; 
    document.getElementById('borrar_coll_nombre').value = collNombre;
    let texto = (tipo === 'db') ? `Eliminar BD: <strong>${dbNombre}</strong>` : `Eliminar Colección: <strong>${collNombre}</strong>`;
    document.getElementById('texto_borrar_alerta').innerHTML = texto;
    document.getElementById('borrar_action').value = (tipo === 'db') ? 'borrar_db' : 'borrar_coleccion';
    new bootstrap.Modal(document.getElementById('modalBorrarSeguro')).show();
}

function abrirModalRenombrar(tipo, dbNombre, collNombre) {
    let inputNuevo = document.getElementById('input_nuevo_nombre');
    let info = document.getElementById('texto_renombrar_info');
    if (tipo === 'db') {
        document.getElementById('renombrar_action').value = 'renombrar_db';
        document.getElementById('renom_db_antigua').value = dbNombre;
        document.getElementById('input_nuevo_nombre').name = 'db_nueva';
        info.innerText = `Renombrando Base de Datos: ${dbNombre}`; inputNuevo.value = dbNombre;
        document.getElementById('seguridad_renom_db').style.display = 'block';
    } else {
        document.getElementById('renombrar_action').value = 'renombrar_coleccion';
        document.getElementById('renom_db_origen').value = dbNombre;
        document.getElementById('renom_coll_antigua').value = collNombre;
        document.getElementById('input_nuevo_nombre').name = 'coll_nueva';
        info.innerText = `Renombrando Colección: ${collNombre}`; inputNuevo.value = collNombre;
        document.getElementById('seguridad_renom_db').style.display = 'none';
    }
    new bootstrap.Modal(document.getElementById('modalRenombrar')).show();
}

function toggleDestino(select) {
    var box = document.getElementById('box_bd_existente');
    if (select.value === 'existente') { box.style.display = 'block'; } 
    else { box.style.display = 'none'; }
}

function actualizarRoles(radio, tipo) {
    document.querySelectorAll('.input-nombre-final').forEach(inp => {
        inp.classList.remove('bg-primary-subtle', 'text-primary', 'bg-warning-subtle', 'text-dark', 'border-primary', 'border-warning');
        inp.classList.add('border-secondary-subtle');
    });

    let fila = radio.closest('tr');
    let inputNombre = fila.querySelector('.input-nombre-final');
    let selectTipo = fila.querySelector('.select-tipo');

    if (tipo === 'producto') {
        inputNombre.classList.add('bg-primary-subtle', 'text-primary', 'border-primary');
        inputNombre.classList.remove('border-secondary-subtle');
        selectTipo.value = 'text';
    } else if (tipo === 'stock') {
        inputNombre.classList.add('bg-warning-subtle', 'text-dark', 'border-warning');
        inputNombre.classList.remove('border-secondary-subtle');
        selectTipo.value = 'number';
    }
}