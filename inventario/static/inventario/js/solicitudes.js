function cargarInsumos() {
    let origenRaw = document.getElementById('req_origen').value;
    let insumoSelect = document.getElementById('req_insumo');
    if (!origenRaw) {
        insumoSelect.innerHTML = '<option value="">Seleccione Origen primero...</option>';
        insumoSelect.disabled = true;
        return;
    }
    let partes = origenRaw.split('|');
    insumoSelect.innerHTML = '<option value="">Cargando catálogo...</option>';
    insumoSelect.disabled = true;

    fetch(`/api/insumos/?db=${partes[0]}&bodega=${partes[1]}`)
        .then(response => response.json())
        .then(data => {
            insumoSelect.innerHTML = '<option value="">Seleccione Insumo...</option>';
            if(data.productos.length > 0){
                data.productos.forEach(prod => { insumoSelect.innerHTML += `<option value="${prod}">${prod}</option>`; });
                insumoSelect.disabled = false;
            } else {
                insumoSelect.innerHTML = '<option value="">Bodega vacía</option>';
            }
        });
}

function validarDestino() {
    let origen = document.getElementById('req_origen').value;
    let destino = document.getElementById('req_destino').value;

    if(origen && destino && origen === destino) {
        alert("Error: La colección de Destino no puede ser la misma que la de Origen.");
        document.getElementById('req_destino').value = "";
    }
}

function abrirModalConfirmacionEnvio() {
    let origen = document.getElementById('req_origen').value;
    let destino = document.getElementById('req_destino').value;
    let insumo = document.getElementById('req_insumo').value;
    let cantidad = document.getElementById('req_cantidad').value;

    if(!origen || !destino || !insumo || !cantidad) {
        alert("Por favor completa todos los campos (Origen, Insumo, Destino y Cantidad).");
        return;
    }

    document.getElementById('conf_origen').innerText = origen.replace('|', ' → ');
    document.getElementById('conf_destino').innerText = destino.replace('|', ' → ');
    document.getElementById('conf_insumo').innerText = insumo;
    document.getElementById('conf_cantidad').innerText = cantidad;
    new bootstrap.Modal(document.getElementById('modalConfirmarSolicitud')).show();
}

function confirmarYEnviar() { document.getElementById('formNuevaSolicitud').submit(); }

function toggleMod(selectElement, id) {
    var box = document.getElementById('mod_box_' + id);
    if (box) box.style.display = (selectElement.value === 'Modificada') ? 'block' : 'none';
}

function toggleRecepcionParcial(selectElement, id) {
    var box = document.getElementById('parcial_box_' + id);
    var inputNumber = box.querySelector('input[name="cantidad_recibida"]');
    if (box) {
        if (selectElement.value === 'parcial') {
            box.style.display = 'block';
            inputNumber.required = true; 
        } else {
            box.style.display = 'none';
            inputNumber.required = false; 
        }
    }
}

setInterval(() => {
    const tablaActual = document.querySelector('.table tbody');
    if (!tablaActual) return;

    const isFocused = tablaActual.contains(document.activeElement);
    let isSelecting = false;
    tablaActual.querySelectorAll('select[name="nuevo_estado"]').forEach(select => {
        if (select.value !== "") isSelecting = true;
    });

    const modalAbierto = document.querySelector('.modal.show');
    if (isFocused || isSelecting || modalAbierto) return; 

    fetch(window.location.href)
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const nuevaTabla = doc.querySelector('.table tbody');
            if(nuevaTabla) tablaActual.innerHTML = nuevaTabla.innerHTML;
        })
        .catch(error => console.log('Buscando actualizaciones...'));
}, 5000);