// 1. LÓGICA DE FILTRADO COMPLETA
function filtrarHistorial() {
    let inicio = document.getElementById("filtroHistorialInicio").value; 
    let fin = document.getElementById("filtroHistorialFin").value;
    let busqueda = document.getElementById("buscadorHistorial").value.toLowerCase();
    
    let filas = document.querySelectorAll("#tablaHistorial tbody tr.fila-historial");
    
    let filtrosDropdown = {};
    [0, 2, 5, 6].forEach(col => {
        let selectAll = document.getElementById(`all_hist_${col}`);
        if (selectAll && !selectAll.checked) {
            let checks = document.querySelectorAll(`.col-check-hist-${col}:checked`);
            filtrosDropdown[col] = Array.from(checks).map(c => c.value);
        }
    });

    filas.forEach(fila => {
        let show = true;
        let fechaStr = fila.getAttribute("data-fecha"); 
        let textoFila = fila.textContent.toLowerCase();

        if (inicio && fin) { if (fechaStr < inicio || fechaStr > fin) show = false; }
        else if (inicio) { if (fechaStr < inicio) show = false; }
        else if (fin) { if (fechaStr > fin) show = false; }

        if (show && busqueda !== "") { if (!textoFila.includes(busqueda)) show = false; }

        if (show) {
            for (let col in filtrosDropdown) {
                let cellVal = fila.cells[col].textContent.trim();
                if (!filtrosDropdown[col].includes(cellVal)) { show = false; break; }
            }
        }

        fila.style.display = show ? "" : "none";
    });
}

function limpiarFiltrosHistorial() {
    document.getElementById("filtroHistorialInicio").value = "";
    document.getElementById("filtroHistorialFin").value = "";
    document.getElementById("buscadorHistorial").value = "";
    document.querySelectorAll('.select-all-col-hist').forEach(chk => {
        chk.checked = true;
        document.querySelectorAll(`.col-check-hist-${chk.dataset.col}`).forEach(c => c.checked = true);
    });
    filtrarHistorial();
}

// 2. INICIALIZAR DROPDOWNS DE FILTRO
document.addEventListener("DOMContentLoaded", function() {
    const tablaId = 'tablaHistorial';
    const filas = document.querySelectorAll(`#${tablaId} tbody tr.fila-historial`);
    const columnas = ES_SUPERUSER ? [1, 3, 6, 7] : [0, 2, 5, 6]; 

    columnas.forEach(colIndex => {
        let menu = document.getElementById(`filtro-hist-${colIndex}`);
        if (!menu) return;

        let valoresUnicos = new Set();
        filas.forEach(fila => { if(fila.cells[colIndex]) valoresUnicos.add(fila.cells[colIndex].textContent.trim()); });
        
        let arrayValores = Array.from(valoresUnicos).sort();
        let html = `<li><div class="form-check border-bottom pb-2 mb-2"><input class="form-check-input select-all-col-hist" type="checkbox" value="all" id="all_hist_${colIndex}" checked data-col="${colIndex}"><label class="form-check-label fw-bold text-primary w-100" for="all_hist_${colIndex}">Seleccionar todo</label></div></li>`;
        
        arrayValores.forEach((val, idx) => {
            let textLabel = val === "" ? "(Vacío)" : val;
            html += `<li><div class="form-check"><input class="form-check-input filter-checkbox-hist col-check-hist-${colIndex}" type="checkbox" value="${val}" id="chk_h_${colIndex}_${idx}" checked data-col="${colIndex}"><label class="form-check-label text-truncate w-100" for="chk_h_${colIndex}_${idx}" style="max-width: 250px;" title="${textLabel}">${textLabel}</label></div></li>`;
        });
        menu.innerHTML = html;
    });
});

document.addEventListener('change', function(e) {
    if (e.target.classList.contains('select-all-col-hist')) {
        let col = e.target.getAttribute('data-col');
        document.querySelectorAll(`.col-check-hist-${col}`).forEach(c => c.checked = e.target.checked);
        filtrarHistorial();
    } else if (e.target.classList.contains('filter-checkbox-hist')) {
        let col = e.target.getAttribute('data-col');
        let allChecked = Array.from(document.querySelectorAll(`.col-check-hist-${col}`)).every(c => c.checked);
        document.getElementById(`all_hist_${col}`).checked = allChecked;
        filtrarHistorial();
    }
});

// 3. MOSTRAR JSON DEL PRODUCTO ELIMINADO
function verDetallesEliminado(jsonString) {
    try {
        let obj = JSON.parse(jsonString);
        document.getElementById('jsonViewer').textContent = JSON.stringify(obj, null, 4);
        new bootstrap.Modal(document.getElementById('modalDetallesJSON')).show();
    } catch(e) {
        alert("No se pudo cargar la información detallada.");
    }
}

function toggleAllHistorial(masterCheck) {
    document.querySelectorAll('.check-borrar-hist').forEach(chk => {
        if(chk.closest('tr').style.display !== 'none') chk.checked = masterCheck.checked;
    });
    validarBotonBorrarHist();
}

function validarBotonBorrarHist() {
    let checkeds = document.querySelectorAll('.check-borrar-hist:checked').length;
    let btn = document.getElementById('btnBorrarHistorial');
    if(btn) {
        btn.disabled = checkeds === 0;
        btn.innerHTML = checkeds > 0 
            ? `<img src="${document.querySelector('.icono-tema').src.replace('reloj.svg', 'basurero.svg')}" width="16" class="icono-tema me-1"> Eliminar (${checkeds})`
            : `<img src="${document.querySelector('.icono-tema').src.replace('reloj.svg', 'basurero.svg')}" width="16" class="icono-tema me-1"> Eliminar Registros`;
    }
}