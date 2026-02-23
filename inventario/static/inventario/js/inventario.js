document.addEventListener("DOMContentLoaded", function() {
    flatpickr(".input-fecha", { dateFormat: "d-m-Y", locale: "es", allowInput: true });
    
    if(document.getElementById('tablaInventarioVer')) inicializarFiltrosTabla('tablaInventarioVer', 'filtro-col-');
    if(document.getElementById('tablaInventarioEditar')) inicializarFiltrosTabla('tablaInventarioEditar', 'filtro-edit-col-');
});

function abrirModalEditar(id, rowElement) {
    if (event.target.closest('.dropdown') || event.target.closest('.btn')) return;

    const datos = JSON.parse(rowElement.getAttribute('data-json'));
    const nombreProducto = datos['Producto'] || "Registro";
    
    document.getElementById('tituloModalProducto').innerText = nombreProducto;
    document.getElementById('input_doc_id').value = id;
    
    const inputs = document.querySelectorAll('#formEditarDinamico input[data-campo-nombre]');
    inputs.forEach(input => {
        let nombreCampo = input.getAttribute('data-campo-nombre');
        let valor = datos[nombreCampo] !== undefined ? datos[nombreCampo] : "";
        input.value = valor;
        if (input.classList.contains('input-fecha') && input._flatpickr) { input._flatpickr.setDate(valor); }
    });
    
    new bootstrap.Modal(document.getElementById('modalEditarRegistro')).show();
}

function toggleColumna(colIndex) {
    const celdas = document.querySelectorAll(`.col-idx-${colIndex}`);
    celdas.forEach(celda => {
        if (celda.classList.contains('col-hidden')) celda.classList.remove('col-hidden');
        else celda.classList.add('col-hidden');
    });
}

let isReordering = false;
function toggleReorderMode() {
    isReordering = !isReordering;
    const btnT = document.getElementById('btnToggleOrder'), btnS = document.getElementById('btnSaveOrder'), cols = document.querySelectorAll('.sortable-grid .col-md-4');
    if (isReordering) { 
        btnT.classList.replace('btn-outline-secondary', 'btn-secondary'); btnT.innerText = "Cancelar"; btnS.classList.remove('d-none'); 
        cols.forEach(c => { c.draggable = true; c.classList.add('is-reordering'); }); 
    } else { 
        btnT.classList.replace('btn-secondary', 'btn-outline-secondary'); btnT.innerText = "Reordenar Campos"; btnS.classList.add('d-none'); 
        cols.forEach(c => { c.draggable = false; c.classList.remove('is-reordering'); }); 
    }
}

document.querySelectorAll('.sortable-grid').forEach(grid => {
    let dragItem = null;
    grid.querySelectorAll('.col-md-4').forEach(col => {
        col.addEventListener('dragstart', function(e) { if(!isReordering) return; dragItem = this; setTimeout(() => this.style.opacity = '0.5', 0); });
        col.addEventListener('dragend', function() { if(!isReordering) return; setTimeout(() => this.style.opacity = '1', 0); dragItem = null; });
        col.addEventListener('dragover', e => { if(isReordering) e.preventDefault(); });
        col.addEventListener('drop', function(e) { if(!isReordering) return; e.preventDefault(); if (this !== dragItem && dragItem != null) { let cols = Array.from(grid.querySelectorAll('.col-md-4')); cols.indexOf(dragItem) < cols.indexOf(this) ? this.after(dragItem) : this.before(dragItem); } });
    });
});

function guardarOrdenPreferido() {
    let grid = document.querySelector('.sortable-grid'); if(!grid) return;
    fetch(URL_GUARDAR_ORDEN, { 
        method: "POST", 
        headers: {"Content-Type": "application/json"}, 
        body: JSON.stringify({ plantilla: SELECTED_DB, orden: Array.from(grid.querySelectorAll('label')).map(l => l.innerText) }) 
    }).then(r => { if(r.ok) window.location.reload(); });
}

function inicializarFiltrosTabla(tablaId, prefijoIdMenu) {
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;
    const filas = tabla.querySelectorAll('tbody tr.fila-dato');
    const numColumnas = document.querySelectorAll(`#${tablaId} thead th`).length;

    for (let i = 0; i < numColumnas; i++) {
        let menu = document.getElementById(prefijoIdMenu + i);
        if (!menu) continue;

        let valoresUnicos = new Set();
        filas.forEach(fila => { if(fila.cells[i]) valoresUnicos.add(fila.cells[i].textContent.trim()); });
        let arrayValores = Array.from(valoresUnicos).sort();

        let html = `<li><div class="form-check border-bottom pb-2 mb-2"><input class="form-check-input select-all-col" type="checkbox" value="all" id="all_${tablaId}_${i}" checked data-col="${i}" data-table="${tablaId}"><label class="form-check-label fw-bold text-primary w-100" for="all_${tablaId}_${i}">Seleccionar todo</label></div></li>`;
        
        arrayValores.forEach((val, idx) => {
            let textLabel = val === "" ? "(Vacío)" : val;
            html += `<li><div class="form-check"><input class="form-check-input filter-checkbox col-check-${tablaId}-${i}" type="checkbox" value="${val.replace(/"/g, '&quot;')}" id="chk_${tablaId}_${i}_${idx}" checked data-col="${i}" data-table="${tablaId}"><label class="form-check-label text-truncate w-100" for="chk_${tablaId}_${i}_${idx}" style="max-width: 250px;" title="${textLabel}">${textLabel}</label></div></li>`;
        });
        menu.innerHTML = html;
    }

    tabla.closest('.table-responsive').addEventListener('change', function(e) {
        if (e.target.classList.contains('select-all-col')) {
            let col = e.target.getAttribute('data-col');
            let tbl = e.target.getAttribute('data-table');
            let isChecked = e.target.checked;
            document.querySelectorAll(`.col-check-${tbl}-${col}`).forEach(c => c.checked = isChecked);
            filtrarTablaGenerico(tbl);
        } else if (e.target.classList.contains('filter-checkbox')) {
            let col = e.target.getAttribute('data-col');
            let tbl = e.target.getAttribute('data-table');
            let allChecks = document.querySelectorAll(`.col-check-${tbl}-${col}`);
            let allChecked = Array.from(allChecks).every(c => c.checked);
            document.getElementById(`all_${tbl}_${col}`).checked = allChecked;
            filtrarTablaGenerico(tbl);
        }
    });
}

function filtrarTabla(tablaId, buscadorId) { filtrarTablaGenerico(tablaId, buscadorId); }

function filtrarTablaGenerico(tablaId, buscadorId = null) {
    if (!buscadorId) {
        if (tablaId === 'tablaInventarioVer') buscadorId = 'buscadorGlobal';
        else buscadorId = 'buscadorEditar';
    }
    
    let input = document.getElementById(buscadorId).value.toLowerCase();
    let filas = document.querySelectorAll(`#${tablaId} tbody tr.fila-dato`);
    let numColumnas = document.querySelectorAll(`#${tablaId} thead th`).length;

    let filtrosPorColumna = {};
    for (let i = 0; i < numColumnas; i++) {
        let selectAll = document.getElementById(`all_${tablaId}_${i}`);
        if (selectAll && !selectAll.checked) {
            let checkboxes = document.querySelectorAll(`.col-check-${tablaId}-${i}:checked`);
            filtrosPorColumna[i] = Array.from(checkboxes).map(c => c.value);
        }
    }

    filas.forEach(fila => {
        let showRow = true;
        let textoFila = fila.textContent.toLowerCase();
        if (input !== "" && !textoFila.includes(input)) showRow = false;

        if (showRow) {
            for (let colIndex in filtrosPorColumna) {
                let celdaText = fila.cells[colIndex] ? fila.cells[colIndex].textContent.trim() : "";
                if (!filtrosPorColumna[colIndex].includes(celdaText)) {
                    showRow = false; break;
                }
            }
        }
        fila.style.display = showRow ? "" : "none";
    });
}