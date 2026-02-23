// Invocación del modal de borrado
function abrirModalBorrarUsuario(id, username) {
    document.getElementById('input_borrar_u_id').value = id;
    document.getElementById('texto_nombre_usuario').innerText = "👤 " + username;
    let modal = new bootstrap.Modal(document.getElementById('modalBorrarUsuario'));
    modal.show();
}

// Lógica de Permisos
function alternarPermisos(idCaja, valorRol) {
    let caja = document.getElementById(idCaja);
    if (caja) {
        if (valorRol === 'admin') {
            caja.classList.add('d-none');
        } else {
            caja.classList.remove('d-none');
        }
    }
}

function abrirModalRestablecerPass(id, username) {
    document.getElementById('input_reset_u_id').value = id;
    document.getElementById('texto_reset_usuario').innerText = username;
    let modal = new bootstrap.Modal(document.getElementById('modalRestablecerPass'));
    modal.show();
}
// Ajuste para el select_rol_nuevo
function alternarPermisos(idCaja, valorRol) {
    let caja = document.getElementById(idCaja);
    if (caja) {
        // Superuser o admin no necesitan permisos de colección explícitos (tienen global)
        if (valorRol === 'admin' || valorRol === 'superuser') {
            caja.classList.add('d-none');
        } else {
            caja.classList.remove('d-none');
        }
    }
}