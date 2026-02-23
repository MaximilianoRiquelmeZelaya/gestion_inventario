/**
 * ARCHIVO PRINCIPAL DE JAVASCRIPT PARA LA VISTA DE REGISTROS
 */

// Variable global para controlar salidas accidentales
let cambiosSinGuardar = false;

document.addEventListener("DOMContentLoaded", function() {
    // 1. Inicialización de la vista "Nuevo Registro" (si existen los elementos)
    if (document.getElementById('mapUbicacion')) {
        remapearColumnas();
    }
    
    // 2. Inicialización del Modal de Historial (Fechas por defecto)
    if (document.getElementById("fechaInicioModal")) {
        setFechasPorDefectoModal();
        setTimeout(filtrarTablaModal, 100); 
    }

    // 3. Trackers de cambios sin guardar
    document.querySelectorAll('.input-tracker').forEach(inp => { 
        inp.addEventListener('input', () => cambiosSinGuardar = true); 
        inp.addEventListener('change', () => cambiosSinGuardar = true); 
    });
    
    // 4. Listeners para los checkbox "Seleccionar Todo" en las columnas de filtros
    document.addEventListener('change', function(e) { 
        if (e.target.classList.contains('select-all-col-reg')) { 
            let col = e.target.getAttribute('data-col'); 
            let isChecked = e.target.checked; 
            document.querySelectorAll(`.col-check-reg-${col}`).forEach(c => c.checked = isChecked); 
            filtrarTablaRegistro(); 
        } else if (e.target.classList.contains('filter-checkbox-reg')) { 
            let col = e.target.getAttribute('data-col'); 
            let allChecks = document.querySelectorAll(`.col-check-reg-${col}`); 
            let allChecked = Array.from(allChecks).every(c => c.checked); 
            document.getElementById(`all_reg_${col}`).checked = allChecked; 
            filtrarTablaRegistro(); 
        } 
    });
});

window.addEventListener('beforeunload', function (e) { 
    if (cambiosSinGuardar) { 
        e.preventDefault(); 
        e.returnValue = ''; 
    } 
});

// ==========================================
// FUNCIONES PARA: NUEVO REGISTRO
// ==========================================

function sincronizarMonitor() { 
    document.getElementById('formMonitorGlobal').value = document.getElementById('inputMonitorGlobal').value; 
}

function toggleAllRevisado(masterCheck) { 
    document.querySelectorAll('.fila-registro').forEach(row => { 
        if (row.style.display !== 'none') { 
            let check = row.querySelector('.check-revisado'); 
            if (check) { 
                check.checked = masterCheck.checked; 
                cambiosSinGuardar = true; 
            } 
        } 
    }); 
}

function remapearColumnas() { 
    let keyUbic = document.getElementById('mapUbicacion').value; 
    let keyEqui = document.getElementById('mapEquipo').value; 
    let keyCant = document.getElementById('mapCantidad').value; 
    
    document.querySelectorAll('.fila-registro').forEach(row => { 
        let data = JSON.parse(row.getAttribute('data-json')); 
        row.querySelector('.dyn-ubicacion').value = (keyUbic && data[keyUbic]) ? data[keyUbic] : ''; 
        row.querySelector('.dyn-equipo').value = (keyEqui && data[keyEqui]) ? data[keyEqui] : 'Sin Equipo'; 
        let cantidad = (keyCant && data[keyCant]) ? data[keyCant] : 0; 
        row.querySelector('.dyn-cantidad').value = cantidad; 
        row.querySelector('.dyn-cantidad-orig').value = cantidad; 
    }); 
    actualizarFiltrosTablaRegistro(); 
}

function enviarFormularioRegistro() { 
    let monitor = document.getElementById('inputMonitorGlobal').value.trim(); 
    if (monitor === "") { 
        alert("⚠️ Debes ingresar el Nombre del Monitor en la barra superior."); 
        document.getElementById('inputMonitorGlobal').focus(); 
        return; 
    } 
    
    let arrayRegistros = []; 
    document.querySelectorAll('.fila-registro').forEach(row => { 
        let isRevisado = row.querySelector('.check-revisado').checked; 
        if (isRevisado) { 
            let estatusVal = row.querySelector('.val-estatus').value; 
            arrayRegistros.push({ 
                doc_id: row.querySelector('.val-doc-id').value, 
                ubicacion: row.querySelector('.val-ubicacion').value, 
                equipo: row.querySelector('.val-equipo').value, 
                cantidad: row.querySelector('.val-cantidad').value, 
                cantidad_orig: row.querySelector('.val-cantidad-orig').value, 
                estatus: estatusVal, 
                acciones_hidden: row.querySelector('.val-acciones').value, 
                observacion: row.querySelector('.val-observacion').value 
            }); 
        } 
    }); 
    
    if (arrayRegistros.length === 0) { 
        alert("⚠️ No has marcado ningún equipo como 'Revisado'."); 
        return; 
    } 
    
    document.getElementById('inputDatosJSON').value = JSON.stringify(arrayRegistros); 
    document.getElementById('formCampoCantidad').value = document.getElementById('mapCantidad').value; 
    cambiosSinGuardar = false; 
    document.getElementById('formCrearRegistro').submit(); 
}

function toggleFilaEstatus(switchElement) { 
    let row = switchElement.closest('tr'); 
    let hiddenEstatus = row.querySelector('.val-estatus'); 
    let lblEstatus = row.querySelector('.lbl-estatus'); 
    let btnAccion = row.querySelector('.btn-accion-ui'); 
    let checks = row.querySelectorAll('.check-accion'); 
    let hiddenAccion = row.querySelector('.hidden-accion-resultado'); 
    row.querySelector('.check-revisado').checked = true; 
    
    if (switchElement.checked) { 
        hiddenEstatus.value = 'NC'; 
        lblEstatus.innerText = 'NC'; 
        lblEstatus.classList.replace('text-success', 'text-danger'); 
        btnAccion.disabled = false; 
        btnAccion.classList.replace('btn-outline-secondary', 'btn-danger'); 
        btnAccion.innerText = "Requerido: Elegir..."; 
    } else { 
        hiddenEstatus.value = 'C'; 
        lblEstatus.innerText = 'C'; 
        lblEstatus.classList.replace('text-danger', 'text-success'); 
        btnAccion.disabled = true; 
        btnAccion.classList.replace('btn-danger', 'btn-outline-secondary'); 
        btnAccion.innerText = "Seleccionar..."; 
        checks.forEach(c => c.checked = false); 
        hiddenAccion.value = ""; 
    } 
}

function actualizarHiddenAccion(checkbox) { 
    let row = checkbox.closest('tr'); 
    let checks = row.querySelectorAll('.check-accion:checked'); 
    let btnAccion = row.querySelector('.btn-accion-ui'); 
    let hidden = row.querySelector('.hidden-accion-resultado'); 
    let valores = Array.from(checks).map(c => c.value); 
    hidden.value = valores.join(' | '); 
    
    if (valores.length > 0) btnAccion.innerText = valores.length + " Seleccionada(s)"; 
    else btnAccion.innerText = "Requerido: Elegir..."; 
}

function actualizarFiltrosTablaRegistro() { 
    const tablaId = 'tablaRegistro'; 
    const filas = document.querySelectorAll(`#${tablaId} tbody tr.fila-registro`); 
    const columnasFiltrables = [1, 2, 3]; 
    
    columnasFiltrables.forEach(colIndex => { 
        let menu = document.getElementById(`filtro-reg-col-${colIndex}`); 
        if (!menu) return; 
        
        let valoresUnicos = new Set(); 
        filas.forEach(fila => { 
            let cell = fila.cells[colIndex]; 
            if (cell) { 
                let hiddenNode = cell.querySelector('.val-estatus'); 
                let inputNode = cell.querySelector('input:not([type="checkbox"]), select'); 
                let val = hiddenNode ? hiddenNode.value : (inputNode ? inputNode.value.trim() : cell.textContent.trim()); 
                if (val === "" && colIndex === 1) val = "(Vacío)"; 
                valoresUnicos.add(val); 
            } 
        }); 
        
        let arrayValores = Array.from(valoresUnicos).sort(); 
        let html = `<li><div class="form-check border-bottom pb-2 mb-2"><input class="form-check-input select-all-col-reg" type="checkbox" value="all" id="all_reg_${colIndex}" checked data-col="${colIndex}"><label class="form-check-label fw-bold text-primary w-100" for="all_reg_${colIndex}">Seleccionar todo</label></div></li>`; 
        
        arrayValores.forEach((val, idx) => { 
            let textLabel = val === "" ? "(Vacío)" : val; 
            html += `<li><div class="form-check"><input class="form-check-input filter-checkbox-reg col-check-reg-${colIndex}" type="checkbox" value="${val}" id="chk_reg_${colIndex}_${idx}" checked data-col="${colIndex}"><label class="form-check-label text-truncate w-100" for="chk_reg_${colIndex}_${idx}" style="max-width: 250px;" title="${textLabel}">${textLabel}</label></div></li>`; 
        }); 
        menu.innerHTML = html; 
    }); 
}

function filtrarTablaRegistro() { 
    let inputBuscador = document.getElementById("buscadorRegistro").value.toLowerCase(); 
    let filas = document.querySelectorAll("#tablaRegistro tbody tr.fila-registro"); 
    let filtrosPorColumna = {}; 
    
    [1, 2, 3].forEach(colIndex => { 
        let selectAll = document.getElementById(`all_reg_${colIndex}`); 
        if (selectAll && !selectAll.checked) { 
            let checkboxes = document.querySelectorAll(`.col-check-reg-${colIndex}:checked`); 
            filtrosPorColumna[colIndex] = Array.from(checkboxes).map(c => c.value); 
        } 
    }); 
    
    filas.forEach(fila => { 
        let showRow = true; 
        let textoFila = ""; 
        fila.querySelectorAll('input:not([type="checkbox"]), select').forEach(node => textoFila += " " + node.value.toLowerCase()); 
        
        if (inputBuscador !== "" && !textoFila.includes(inputBuscador)) showRow = false; 
        
        if (showRow) { 
            for (let colIndex in filtrosPorColumna) { 
                let cell = fila.cells[colIndex]; 
                let hiddenNode = cell.querySelector('.val-estatus'); 
                let inputNode = cell.querySelector('input:not([type="checkbox"]), select'); 
                let val = hiddenNode ? hiddenNode.value : (inputNode ? inputNode.value.trim() : cell.textContent.trim()); 
                if (val === "" && colIndex == 1) val = "(Vacío)"; 
                if (!filtrosPorColumna[colIndex].includes(val)) { 
                    showRow = false; break; 
                } 
            } 
        } 
        fila.style.display = showRow ? "" : "none"; 
    }); 
}

function filtrarTablaModal() {
    let inputTexto = document.getElementById("buscadorModal").value.toLowerCase();
    let fechaInicio = document.getElementById("fechaInicioModal").value;
    let fechaFin = document.getElementById("fechaFinModal").value;
    
    document.querySelectorAll("#tablaModalHistorial tbody .fila-historial").forEach(fila => {
        let textoFila = fila.textContent.toLowerCase();
        let fechaFila = fila.getAttribute("data-fecha"); 
        
        let cumpleTexto = inputTexto === "" || textoFila.includes(inputTexto);
        let cumpleFechaInicio = fechaInicio === "" || fechaFila >= fechaInicio;
        let cumpleFechaFin = fechaFin === "" || fechaFila <= fechaFin;
        
        if (cumpleTexto && cumpleFechaInicio && cumpleFechaFin) {
            fila.style.display = "";
        } else {
            fila.style.display = "none";
        }
    });
}

function setFechasPorDefectoModal() {
    let inputInicio = document.getElementById("fechaInicioModal");
    let inputFin = document.getElementById("fechaFinModal");

    if (inputInicio && inputFin) {
        let hoy = new Date();
        let hace30Dias = new Date();
        hace30Dias.setDate(hoy.getDate() - 30);

        const formatearFecha = (fecha) => {
            let d = new Date(fecha);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().split('T')[0];
        };

        inputInicio.value = formatearFecha(hace30Dias);
        inputFin.value = formatearFecha(hoy);
    }
}

function limpiarFiltrosModal() {
    document.getElementById("buscadorModal").value = "";
    setFechasPorDefectoModal(); 
    filtrarTablaModal(); 
}

// ==========================================
// FUNCIONES PARA: VER REGISTROS
// ==========================================

function filtrarVerRegistros() { 
    let input = document.getElementById("buscadorVerRegistros").value.toLowerCase(); 
    document.querySelectorAll(".fila-ver-reg").forEach(fila => { 
        fila.style.display = fila.textContent.toLowerCase().includes(input) ? "" : "none"; 
    }); 
}

function toggleGrupoBorrar(masterCheck, tbodyId) { 
    document.querySelectorAll(`#${tbodyId} .check-borrar`).forEach(chk => { 
        if(chk.closest('tr').style.display !== 'none') chk.checked = masterCheck.checked; 
    }); 
    validarBotonBorrarMasivo(); 
}

function validarBotonBorrarMasivo() {
    let checkeds = document.querySelectorAll('.check-borrar:checked').length;
    let btn = document.getElementById('btnBorrarMasivo');
    if(btn) {
        btn.disabled = checkeds === 0;
        if(checkeds > 0){
            // Utilizamos la variable global inyectada desde Django
            btn.innerHTML = `<img src="${URL_ICONO_BASURERO}" width="16" class="me-1 icono-tema"> Borrar (${checkeds})`;
        } else {
            btn.innerHTML = `<img src="${URL_ICONO_BASURERO}" width="16" class="me-1 icono-tema"> Borrar Seleccionados`;
        }
    }
}

function ejecutarBorradoMasivo(tipo) { 
    let passInput = document.getElementById('inputPassBorrar'); 
    if(tipo === 'borrar' && !passInput.value) { 
        alert("⚠️ Debes ingresar tu contraseña para confirmar la eliminación."); 
        passInput.focus(); 
        return; 
    } 
    document.getElementById('action_borrar_masivo').value = (tipo === 'descargar') ? 'descargar_borrado' : 'borrar_registros'; 
    document.getElementById('formBorrarMasivo').submit(); 
    if(tipo === 'borrar'){ 
        bootstrap.Modal.getInstance(document.getElementById('modalBorrarMasivo')).hide(); 
    } 
}

function abrirModalEditarRegistro(id, btnElement) { 
    let fila = btnElement.closest('tr'); 
    document.getElementById('edit_reg_id').value = id; 
    document.getElementById('edit_cantidad').value = fila.querySelector('.td-cant').innerText.trim(); 
    
    let estatusStr = fila.querySelector('.td-estatus').innerText.trim(); 
    document.getElementById('edit_estatus').value = estatusStr; 
    
    let accionesStr = fila.querySelector('.td-acciones').innerText.trim(); 
    document.getElementById('edit_acciones_hidden').value = accionesStr; 
    
    let arrayAcciones = accionesStr.split(' | '); 
    let checks = document.querySelectorAll('.check-edit-accion'); 
    checks.forEach(c => { c.checked = arrayAcciones.includes(c.value); }); 
    
    actualizarHiddenEditAccion(); 
    toggleModalAcciones(document.getElementById('edit_estatus')); 
    document.getElementById('edit_observacion').value = fila.querySelector('.td-obs').innerText.trim(); 
    new bootstrap.Modal(document.getElementById('modalEditarRegistro')).show(); 
}

function toggleModalAcciones(selectElement) { 
    let btnAccion = document.getElementById('btnEditAccionesUI'); 
    let checks = document.querySelectorAll('.check-edit-accion'); 
    let hidden = document.getElementById('edit_acciones_hidden'); 
    
    if (selectElement.value === 'NC') { 
        btnAccion.disabled = false; 
        btnAccion.classList.replace('btn-outline-secondary', 'btn-danger'); 
        if(hidden.value === "") btnAccion.innerText = "Requerido: Elegir..."; 
    } else { 
        btnAccion.disabled = true; 
        btnAccion.classList.replace('btn-danger', 'btn-outline-secondary'); 
        btnAccion.innerText = "Seleccionar..."; 
        checks.forEach(c => c.checked = false); 
        hidden.value = ""; 
    } 
}

function actualizarHiddenEditAccion() { 
    let checks = document.querySelectorAll('.check-edit-accion:checked'); 
    let btnAccion = document.getElementById('btnEditAccionesUI'); 
    let hidden = document.getElementById('edit_acciones_hidden'); 
    let valores = Array.from(checks).map(c => c.value); 
    hidden.value = valores.join(' | '); 
    
    if (valores.length > 0) btnAccion.innerText = valores.length + " Seleccionada(s)"; 
    else btnAccion.innerText = "Requerido: Elegir..."; 
}

function toggleOtraPlanta() { 
    let select = document.getElementById('selectPlanta'); 
    let input = document.getElementById('inputPlantaOtra'); 
    if (select.value === 'Otra') { 
        input.style.display = 'block'; 
        input.required = true; 
    } else { 
        input.style.display = 'none'; 
        input.required = false; 
    } 
}

function validarDescargaExcel() { 
    let tipo = document.getElementById('tipo_descarga').value; 
    if(tipo === 'mes') { 
        if(!document.getElementById('inputMes').value) { 
            alert('⚠️ Por favor selecciona un mes de la lista.'); 
            return false; 
        } 
    } else { 
        if(!document.getElementById('inputRango1').value || !document.getElementById('inputRango2').value) { 
            alert('⚠️ Por favor selecciona ambas fechas de inicio y fin.'); 
            return false; 
        } 
    } 
    return true; 
}


// ==========================================
// FUNCIONES PARA: VERIFICAR REGISTROS
// ==========================================

function filtrarFechasVerificar() { 
    let mes = document.getElementById("filtroMesVerificar").value; 
    let inicio = document.getElementById("filtroInicioVerificar").value; 
    let fin = document.getElementById("filtroFinVerificar").value; 
    let busqueda = document.getElementById("buscadorVerificar").value.toLowerCase(); 
    
    document.querySelectorAll(".fila-verificar").forEach(fila => { 
        let fechaStr = fila.getAttribute("data-fecha"); 
        let textoFila = fila.textContent.toLowerCase(); 
        let show = true; 
        
        if (mes) { 
            if (!fechaStr.startsWith(mes)) show = false; 
        } else if (inicio && fin) { 
            if (fechaStr < inicio || fechaStr > fin) show = false; 
        } else if (inicio) { 
            if (fechaStr < inicio) show = false; 
        } else if (fin) { 
            if (fechaStr > fin) show = false; 
        } 
        
        if (show && busqueda !== "") { 
            if (!textoFila.includes(busqueda)) show = false; 
        } 
        fila.style.display = show ? "" : "none"; 
    }); 
    
    document.querySelectorAll(".fila-verificar").forEach(fila => { 
        if (fila.style.display === "none") { 
            let check = fila.querySelector('.check-verificar'); 
            if (check) check.checked = false; 
        } 
    }); 
    
    let masterCheck = document.getElementById('checkAllVerificar');
    if (masterCheck) masterCheck.checked = false; 
    
    validarBotonVerificar(); 
}

function limpiarFiltrosVerificar() { 
    document.getElementById("filtroMesVerificar").value = ""; 
    document.getElementById("filtroInicioVerificar").value = ""; 
    document.getElementById("filtroFinVerificar").value = ""; 
    document.getElementById("buscadorVerificar").value = ""; 
    filtrarFechasVerificar(); 
}

function toggleAllVerificar(masterCheck) { 
    document.querySelectorAll(".fila-verificar").forEach(fila => { 
        if (fila.style.display !== "none") { 
            let check = fila.querySelector('.check-verificar'); 
            if (check) check.checked = masterCheck.checked; 
        } 
    }); 
    validarBotonVerificar(); 
}

function validarBotonVerificar() { 
    let cantidadSeleccionados = document.querySelectorAll('.check-verificar:checked').length; 
    let btn = document.getElementById('btnAutorizarVerificacion'); 
    
    if (btn) { 
        if (cantidadSeleccionados > 0) { 
            btn.disabled = false; 
            // Utilizamos la variable global inyectada desde Django
            btn.innerHTML = `<img src="${URL_ICONO_CHECK}" width="18" style="filter: brightness(0) invert(1);" class="me-1"> Autorizar (${cantidadSeleccionados}) Registros`; 
        } else { 
            btn.disabled = true; 
            btn.innerHTML = `<img src="${URL_ICONO_CHECK}" width="18" style="filter: brightness(0) invert(1);" class="me-1"> Autorizar Seleccionados`; 
        } 
    } 
}