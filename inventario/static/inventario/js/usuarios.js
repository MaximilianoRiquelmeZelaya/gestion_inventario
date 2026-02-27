function abrirModalEditar(id, username, rol, permisos) {
    const inputId = document.getElementById('input_u_id');
    const inputName = document.getElementById('input_u_name');
    const selectRol = document.getElementById('select_rol_nuevo');
    const cajaPermisos = document.getElementById('caja_permisos_colecciones');
    
    if (inputId) inputId.value = id;
    if (inputName) inputName.value = username;

    if (selectRol) {
        selectRol.value = rol;
        
        alternarPermisos('caja_permisos_colecciones', rol);

        let aviso = document.getElementById('aviso_rol_propio');
        
        if (typeof CURRENT_USER_ID !== 'undefined' && String(id) === String(CURRENT_USER_ID)) {
            selectRol.disabled = true;
            selectRol.classList.add('bg-secondary-subtle', 'text-muted');
            selectRol.title = "Por seguridad, no puedes cambiar tu propio rol.";
            
            if (!aviso) {
                aviso = document.createElement('div');
                aviso.id = 'aviso_rol_propio';
                aviso.className = 'form-text text-danger fw-bold mt-1';
                aviso.innerHTML = '<img src="/static/inventario/images/candado.svg" width="12"> No puedes degradar tu propio rol.';
                selectRol.parentNode.appendChild(aviso);
            }
        } else {
            selectRol.disabled = false;
            selectRol.classList.remove('bg-secondary-subtle', 'text-muted');
            selectRol.title = "Asignar rol al usuario";
            if (aviso) aviso.remove();
        }
    }

    const checkboxes = document.querySelectorAll('input[name="u_permisos"]');
    checkboxes.forEach(chk => chk.checked = false);

    if (permisos) {
        let listaPermisos = [];
        if (Array.isArray(permisos)) {
            listaPermisos = permisos;
        } else if (typeof permisos === 'string') {
            listaPermisos = permisos.replace(/'/g, '').replace(/[\[\]\s]/g, '').split(',');
        }
        
        checkboxes.forEach(chk => {
            if (listaPermisos.includes(chk.value)) {
                chk.checked = true;
            }
        });
    }

    const modalEl = document.getElementById('modalEditarUsuario');
    if (modalEl) {
        new bootstrap.Modal(modalEl).show();
    }
}

function abrirModalBorrarUsuario(id, username) {
    const inputId = document.getElementById('input_borrar_u_id');
    const txtName = document.getElementById('texto_nombre_usuario');
    
    if (inputId) inputId.value = id;
    if (txtName) txtName.innerText = "👤 " + username;
    
    const modalEl = document.getElementById('modalBorrarUsuario');
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

function abrirModalRestablecerPass(id, username) {
    const inputId = document.getElementById('input_reset_u_id');
    const txtUser = document.getElementById('texto_reset_usuario');
    
    if (inputId) inputId.value = id;
    if (txtUser) txtUser.innerText = username;
    
    const modalEl = document.getElementById('modalRestablecerPass');
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

function alternarPermisos(idCaja, valorRol) {
    const caja = document.getElementById(idCaja);
    if (caja) {
        if (valorRol === 'admin' || valorRol === 'superuser') {
            caja.classList.add('d-none');
        } else {
            caja.classList.remove('d-none');
        }
    }
}