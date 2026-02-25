document.addEventListener("DOMContentLoaded", function() {
    if (typeof flatpickr !== 'undefined') {
        flatpickr(".input-fecha", { dateFormat: "d-m-Y", locale: "es", allowInput: true });
    }
    
    if(document.getElementById('tablaInventarioVer')) inicializarFiltrosTabla('tablaInventarioVer', 'filtro-col-');
    if(document.getElementById('tablaInventarioEditar')) inicializarFiltrosTabla('tablaInventarioEditar', 'filtro-edit-col-');
});

// ==========================================
// 🛠️ CONTROL DE INVENTARIO
// ==========================================

function toggleAllControl(masterCheck) {
    const checkboxes = document.querySelectorAll('#tablaControl tbody .check-control');
    checkboxes.forEach(chk => {
        if(chk.closest('tr').style.display !== 'none') {
            chk.checked = masterCheck.checked;
        }
    });
    validarBotonControl();
}

function detectarCambioFila(input) {
    const fila = input.closest('tr');
    const checkbox = fila.querySelector('.check-control');
    const tdEstado = fila.querySelector('.td-estado');
    const inputsFila = fila.querySelectorAll('.input-control-dinamico');
    
    let hayCambios = false;

    inputsFila.forEach(inp => {
        const valorOriginal = String(inp.getAttribute('data-original'));
        const valorActual = String(inp.value);

        if (valorOriginal !== valorActual) {
            hayCambios = true;
            inp.classList.add('bg-warning-subtle', 'text-dark', 'fw-bold');
            inp.classList.remove('bg-transparent');
        } else {
            inp.classList.remove('bg-warning-subtle', 'text-dark', 'fw-bold');
            inp.classList.add('bg-transparent');
        }
    });

    if (hayCambios) {
        tdEstado.innerHTML = `<span class="badge bg-warning text-dark border border-warning-subtle w-100">Modificado</span>`;
        if (checkbox && !checkbox.checked) checkbox.checked = true;
    } else {
        tdEstado.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle w-100">Coincide</span>`;
    }

    validarBotonControl();
}

function validarBotonControl() {
    const seleccionados = document.querySelectorAll('.check-control:checked').length;
    const btn = document.getElementById('btnGuardarControl');
    const contador = document.getElementById('contadorControl');
    
    if (btn && contador) {
        contador.innerText = `${seleccionados} Seleccionados`;
        btn.disabled = seleccionados === 0;
        
        if (seleccionados > 0) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
        } else {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-success');
        }
    }
}

function enviarControlInventario() {
    let itemsAEnviar = [];
    let resumenHTML = "";
    let cambiosDetectados = 0;
    
    document.querySelectorAll('.fila-control').forEach(row => {
        const checkbox = row.querySelector('.check-control');
        
        if (checkbox && checkbox.checked) {
            let itemObj = {
                id: row.getAttribute('data-id'),
                nombre_producto: row.getAttribute('data-nombre'),
                cambios: [] 
            };

            row.querySelectorAll('.input-control-dinamico').forEach(inp => {
                const campo = inp.getAttribute('data-campo');
                const valor = inp.value;
                const original = inp.getAttribute('data-original');
                
                if (campo) {
                    itemObj[campo] = valor;
                    if (String(valor) !== String(original)) {
                        itemObj.cambios.push(campo);
                        // Agregamos fila al resumen visual del modal
                        resumenHTML += `
                            <tr>
                                <td class="fw-bold">${itemObj.nombre_producto}</td>
                                <td>${campo}</td>
                                <td class="text-danger text-decoration-line-through">${original}</td>
                                <td class="text-success fw-bold">${valor}</td>
                            </tr>
                        `;
                        cambiosDetectados++;
                    }
                }
            });
            itemsAEnviar.push(itemObj);
        }
    });

    if (itemsAEnviar.length === 0) return;

    // Llenar el modal
    const bodyTabla = document.getElementById('bodyResumenCambios');
    if (cambiosDetectados === 0) {
        bodyTabla.innerHTML = '<tr><td colspan="4" class="text-center text-muted fst-italic py-3">Se confirmarán los registros seleccionados sin cambios en sus valores.</td></tr>';
    } else {
        bodyTabla.innerHTML = resumenHTML;
    }

    // Guardar JSON en input oculto
    document.getElementById('inputControlData').value = JSON.stringify(itemsAEnviar);

    // Abrir Modal (Bootstrap 5)
    new bootstrap.Modal(document.getElementById('modalConfirmarControl')).show();
}

// Nueva función para el botón dentro del Modal
function submitControlFinal() {
    const pass = document.getElementById('passwordConfirmControl').value;
    if (!pass) {
        alert("Por favor, ingresa tu contraseña para confirmar.");
        return;
    }

    const form = document.getElementById('formControlInventario');
    
    // Inyectar contraseña en el form
    let passInput = form.querySelector('input[name="password_confirm"]');
    if (!passInput) {
        passInput = document.createElement('input');
        passInput.type = 'hidden';
        passInput.name = 'password_confirm';
        form.appendChild(passInput);
    }
    passInput.value = pass;
    
    form.submit();
}

// ==========================================
// FUNCIONES GENERALES (Modal, Filtros, DragDrop)
// ==========================================

function abrirModalEditar(id, rowElement) {
    if (event.target.closest('.dropdown') || event.target.closest('.btn') || event.target.closest('input')) return;
    const datosJSON = rowElement.getAttribute('data-json');
    if (!datosJSON) return;
    const datos = JSON.parse(datosJSON);
    document.getElementById('tituloModalProducto').innerText = datos['Producto'] || "Registro";
    document.getElementById('input_doc_id').value = id;
    document.querySelectorAll('#formEditarDinamico input[data-campo-nombre]').forEach(input => {
        let nombre = input.getAttribute('data-campo-nombre');
        input.value = datos[nombre] !== undefined ? datos[nombre] : "";
        if (input.classList.contains('input-fecha') && input._flatpickr) input._flatpickr.setDate(input.value);
    });
    new bootstrap.Modal(document.getElementById('modalEditarRegistro')).show();
}

function toggleColumna(colIndex) {
    document.querySelectorAll(`.col-idx-${colIndex}`).forEach(c => c.classList.toggle('col-hidden'));
}

function filtrarTabla(tablaId, buscadorId) { filtrarTablaGenerico(tablaId, buscadorId); }

function filtrarTablaGenerico(tablaId, buscadorId) {
    let input = document.getElementById(buscadorId).value.toLowerCase();
    let filas = document.querySelectorAll(`#${tablaId} tbody tr.fila-dato`);
    let numCols = document.querySelectorAll(`#${tablaId} thead th`).length;
    let filtros = {};

    for (let i = 0; i < numCols; i++) {
        let allCheck = document.getElementById(`all_${tablaId}_${i}`);
        if (allCheck && !allCheck.checked) {
            filtros[i] = Array.from(document.querySelectorAll(`.col-check-${tablaId}-${i}:checked`)).map(c => c.value);
        }
    }

    filas.forEach(fila => {
        let show = true;
        if (input && !fila.textContent.toLowerCase().includes(input)) show = false;
        if (show) {
            for (let i in filtros) {
                let txt = fila.cells[i] ? fila.cells[i].textContent.trim() : "";
                if (!filtros[i].includes(txt)) { show = false; break; }
            }
        }
        fila.style.display = show ? "" : "none";
    });
}

function inicializarFiltrosTabla(tablaId, prefijo) {
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;
    const numCols = document.querySelectorAll(`#${tablaId} thead th`).length;
    const filas = tabla.querySelectorAll('tbody tr.fila-dato');

    for (let i = 0; i < numCols; i++) {
        let menu = document.getElementById(prefijo + i);
        if (!menu) continue;
        let vals = new Set();
        filas.forEach(f => { if(f.cells[i]) vals.add(f.cells[i].textContent.trim()); });
        let html = `<li><div class="form-check border-bottom pb-2 mb-2"><input class="form-check-input select-all-col" type="checkbox" value="all" id="all_${tablaId}_${i}" checked data-col="${i}" data-table="${tablaId}"><label class="form-check-label fw-bold text-primary w-100" for="all_${tablaId}_${i}">Seleccionar todo</label></div></li>`;
        Array.from(vals).sort().forEach((v, idx) => {
            html += `<li><div class="form-check"><input class="form-check-input filter-checkbox col-check-${tablaId}-${i}" type="checkbox" value="${v.replace(/"/g, '&quot;')}" id="chk_${tablaId}_${i}_${idx}" checked data-col="${i}" data-table="${tablaId}"><label class="form-check-label text-truncate w-100" for="chk_${tablaId}_${i}_${idx}" style="max-width: 250px;">${v || "(Vacío)"}</label></div></li>`;
        });
        menu.innerHTML = html;
    }
    
    // Delegación de eventos (simplificada)
    tabla.closest('.table-responsive').addEventListener('change', function(e) {
        if (e.target.classList.contains('select-all-col')) {
            let col = e.target.dataset.col;
            document.querySelectorAll(`.col-check-${tablaId}-${col}`).forEach(c => c.checked = e.target.checked);
            filtrarTablaGenerico(tablaId, (tablaId === 'tablaInventarioVer' ? 'buscadorGlobal' : 'buscadorEditar'));
        } else if (e.target.classList.contains('filter-checkbox')) {
            filtrarTablaGenerico(tablaId, (tablaId === 'tablaInventarioVer' ? 'buscadorGlobal' : 'buscadorEditar'));
        }
    });
}

// Drag & Drop simplificado
let isReordering = false;
function toggleReorderMode() {
    isReordering = !isReordering;
    const btn = document.getElementById('btnToggleOrder');
    document.getElementById('btnSaveOrder').classList.toggle('d-none');
    btn.innerText = isReordering ? "Cancelar" : "Reordenar";
    document.querySelectorAll('.sortable-grid .col-md-4').forEach(c => {
        c.draggable = isReordering;
        c.classList.toggle('is-reordering');
    });
}
function guardarOrdenPreferido() {
    if(typeof URL_GUARDAR_ORDEN !== 'undefined') {
        let orden = Array.from(document.querySelectorAll('.sortable-grid label')).map(l => l.innerText);
        fetch(URL_GUARDAR_ORDEN, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ plantilla: SELECTED_DB, orden: orden }) }).then(r => window.location.reload());
    }
}
document.querySelectorAll('.sortable-grid').forEach(grid => {
    let dragItem = null;
    grid.querySelectorAll('.col-md-4').forEach(col => {
        col.addEventListener('dragstart', function() { if(isReordering) { dragItem = this; this.style.opacity = '0.5'; } });
        col.addEventListener('dragend', function() { if(isReordering) { this.style.opacity = '1'; dragItem = null; } });
        col.addEventListener('dragover', e => { if(isReordering) e.preventDefault(); });
        col.addEventListener('drop', function(e) { 
            if(isReordering) { e.preventDefault(); if(this !== dragItem) { let all = Array.from(grid.children); all.indexOf(dragItem) < all.indexOf(this) ? this.after(dragItem) : this.before(dragItem); } } 
        });
    });
});