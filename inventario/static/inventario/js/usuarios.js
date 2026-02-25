// 1. ABRIR MODAL EDITAR USUARIO
// Se llama desde el botón "Editar" en la tabla
function abrirModalEditar(id, username, rol, permisos) {
    // Referencias a los campos del modal
    const inputId = document.getElementById('input_u_id');
    const inputName = document.getElementById('input_u_name');
    const selectRol = document.getElementById('select_rol_nuevo');
    const cajaPermisos = document.getElementById('caja_permisos_colecciones');
    
    // Llenar datos básicos
    if (inputId) inputId.value = id;
    if (inputName) inputName.value = username;
    
    // Configurar Selector de Rol
    if (selectRol) {
        selectRol.value = rol;
        
        // Actualizar visibilidad de permisos según el rol cargado
        alternarPermisos('caja_permisos_colecciones', rol);

        // --- LÓGICA DE SEGURIDAD: BLOQUEO DE AUTO-EDICIÓN DE ROL ---
        // Buscamos o creamos el mensaje de alerta
        let aviso = document.getElementById('aviso_rol_propio');
        
        // Si el ID del usuario a editar coincide con el logueado (CURRENT_USER_ID)
        if (typeof CURRENT_USER_ID !== 'undefined' && String(id) === String(CURRENT_USER_ID)) {
            selectRol.disabled = true; // Bloqueamos el select
            selectRol.classList.add('bg-secondary-subtle', 'text-muted');
            selectRol.title = "Por seguridad, no puedes cambiar tu propio rol.";
            
            // Mostrar aviso visual
            if (!aviso) {
                aviso = document.createElement('div');
                aviso.id = 'aviso_rol_propio';
                aviso.className = 'form-text text-danger fw-bold mt-1';
                aviso.innerHTML = '<img src="/static/inventario/images/candado.svg" width="12"> No puedes degradar tu propio rol.';
                selectRol.parentNode.appendChild(aviso);
            }
        } else {
            // Si es otro usuario, desbloqueamos
            selectRol.disabled = false;
            selectRol.classList.remove('bg-secondary-subtle', 'text-muted');
            selectRol.title = "Asignar rol al usuario";
            if (aviso) aviso.remove();
        }
    }

    // Configurar Checkboxes de Permisos
    // Limpiamos selección previa
    const checkboxes = document.querySelectorAll('input[name="u_permisos"]');
    checkboxes.forEach(chk => chk.checked = false);

    // Marcamos los permisos que trae el usuario
    // 'permisos' puede venir como array JS o string de Python, intentamos manejar ambos
    if (permisos) {
        let listaPermisos = [];
        if (Array.isArray(permisos)) {
            listaPermisos = permisos;
        } else if (typeof permisos === 'string') {
            // Limpieza básica si viene como string "['a', 'b']"
            listaPermisos = permisos.replace(/'/g, '').replace(/[\[\]\s]/g, '').split(',');
        }
        
        checkboxes.forEach(chk => {
            if (listaPermisos.includes(chk.value)) {
                chk.checked = true;
            }
        });
    }

    // Mostrar el modal
    const modalEl = document.getElementById('modalEditarUsuario');
    if (modalEl) {
        new bootstrap.Modal(modalEl).show();
    }
}

// 2. ABRIR MODAL BORRAR USUARIO
function abrirModalBorrarUsuario(id, username) {
    const inputId = document.getElementById('input_borrar_u_id');
    const txtName = document.getElementById('texto_nombre_usuario');
    
    if (inputId) inputId.value = id;
    if (txtName) txtName.innerText = "👤 " + username;
    
    const modalEl = document.getElementById('modalBorrarUsuario');
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

// 3. ABRIR MODAL RESTABLECER CONTRASEÑA
function abrirModalRestablecerPass(id, username) {
    const inputId = document.getElementById('input_reset_u_id');
    const txtUser = document.getElementById('texto_reset_usuario');
    
    if (inputId) inputId.value = id;
    if (txtUser) txtUser.innerText = username;
    
    const modalEl = document.getElementById('modalRestablecerPass');
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

// 4. LÓGICA DE VISIBILIDAD DE PERMISOS
// Se llama al cambiar el select de rol o al abrir el modal
function alternarPermisos(idCaja, valorRol) {
    const caja = document.getElementById(idCaja);
    if (caja) {
        // Superusuarios y Admins tienen acceso total, ocultamos los checkboxes específicos
        if (valorRol === 'admin' || valorRol === 'superuser') {
            caja.classList.add('d-none');
        } else {
            caja.classList.remove('d-none');
        }
    }
}