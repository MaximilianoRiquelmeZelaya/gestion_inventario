document.addEventListener("DOMContentLoaded", function() {
    const btnToggle = document.getElementById('btnTogglePass');
    const passInput = document.getElementById('inputPassword');
    const iconoOjo = document.getElementById('iconoOjo');

    if (btnToggle && passInput && iconoOjo) {
        
        passInput.addEventListener('input', function() {
            if (passInput.value.length > 0) {
                btnToggle.disabled = false;
                iconoOjo.style.opacity = (passInput.type === 'password') ? "0.5" : "1";
            } else {
                btnToggle.disabled = true;
                iconoOjo.style.opacity = "0.2";
                passInput.type = 'password';
                iconoOjo.src = URL_OJO;
            }
        });

        btnToggle.addEventListener('click', function() {
            if (passInput.value.length === 0) return;

            if (passInput.type === 'password') {
                passInput.type = 'text';
                iconoOjo.src = URL_OJO_TACHADO;
                iconoOjo.style.opacity = "1";
            } else {
                passInput.type = 'password';
                iconoOjo.src = URL_OJO;
                iconoOjo.style.opacity = "0.5";
            }
        });
    }
});