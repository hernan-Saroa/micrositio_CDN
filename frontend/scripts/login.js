const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const alert = document.getElementById('alert');
const alertMessage = document.getElementById('alert-message');

// Modo de demostración (cambiar a false cuando el backend esté disponible)
const DEMO_MODE = false;

function showAlert(message, type = 'error') {
    alert.className = `alert alert-${type} show`;
    alert.querySelector('.material-icons').textContent =
        type === 'error' ? 'error' : 'check_circle';
    alertMessage.textContent = message;
}

function hideAlert() {
    alert.classList.remove('show');
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Email:', email);
    console.log('Contraseña:', password);

    // Validaciones básicas
    if (!email || !password) {
        showAlert('Por favor completa todos los campos');
        return;
    }

    if (!email.includes('@')) {
        showAlert('Por favor ingresa un correo electrónico válido');
        return;
    }

    // Mostrar loading
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    // MODO DE DEMOSTRACIÓN - Sin backend
    if (DEMO_MODE) {
        setTimeout(() => {
            // Simular autenticación exitosa
            sessionStorage.setItem('demoUser', email);
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('loginTime', new Date().toISOString());

            showAlert('Inicio de sesión exitoso. Redirigiendo...', 'success');

            // Redirigir directamente al panel administrativo
            setTimeout(() => {
                window.location.href = 'admin-panel.html';
            }, 1000);
        }, 800);
        return;
    }

    // MODO PRODUCCIÓN - Con backend
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Guardar token JWT y datos del usuario
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('loginTime', new Date().toISOString());

            showAlert('Inicio de sesión exitoso. Redirigiendo...', 'success');

            // Redirigir al panel administrativo
            setTimeout(() => {
                window.location.href = 'admin-panel.html';
            }, 100);
        } else {
            showAlert(data.message || 'Credenciales inválidas');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión al servidor. Verifica que el backend esté activo.');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// Limpiar alertas al escribir
document.getElementById('email').addEventListener('input', hideAlert);
document.getElementById('password').addEventListener('input', hideAlert);

// ========================================
// FUNCIONALIDAD DE RESTABLECIMIENTO DE CONTRASEÑA
// ========================================

// Elementos del DOM para restablecimiento de contraseña
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const backToLoginBtn = document.getElementById('backToLoginBtn');
const backToEmailBtn = document.getElementById('backToEmailBtn');
const backToTokenBtn = document.getElementById('backToTokenBtn');

const forgotPasswordStep1 = document.getElementById('forgotPasswordStep1');
const forgotPasswordStep2 = document.getElementById('forgotPasswordStep2');
const forgotPasswordStep3 = document.getElementById('forgotPasswordStep3');

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const verifyTokenForm = document.getElementById('verifyTokenForm');
const resetPasswordForm = document.getElementById('resetPasswordForm');

let resetEmail = '';

// Función para mostrar/ocultar formularios
function showLoginForm() {
    loginForm.style.display = 'block';
    forgotPasswordStep1.style.display = 'none';
    forgotPasswordStep2.style.display = 'none';
    forgotPasswordStep3.style.display = 'none';
}

function showForgotPasswordStep1() {
    loginForm.style.display = 'none';
    forgotPasswordStep1.style.display = 'block';
    forgotPasswordStep2.style.display = 'none';
    forgotPasswordStep3.style.display = 'none';
}

function showForgotPasswordStep2() {
    loginForm.style.display = 'none';
    forgotPasswordStep1.style.display = 'none';
    forgotPasswordStep2.style.display = 'block';
    forgotPasswordStep3.style.display = 'none';
}

function showForgotPasswordStep3() {
    loginForm.style.display = 'none';
    forgotPasswordStep1.style.display = 'none';
    forgotPasswordStep2.style.display = 'none';
    forgotPasswordStep3.style.display = 'block';
}

// Event listeners para navegación
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    showForgotPasswordStep1();
});

backToLoginBtn.addEventListener('click', () => {
    hideAlert();
    showLoginForm();
});

backToEmailBtn.addEventListener('click', () => {
    hideAlert();
    showForgotPasswordStep1();
});

backToTokenBtn.addEventListener('click', () => {
    hideAlert();
    showForgotPasswordStep2();
});

// Event listener para enviar código de restablecimiento
forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
        showAlert('Por favor ingresa tu correo electrónico');
        return;
    }

    if (!email.includes('@')) {
        showAlert('Por favor ingresa un correo electrónico válido');
        return;
    }

    const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
    sendResetCodeBtn.classList.add('loading');
    sendResetCodeBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            resetEmail = email;
            showAlert('Código de verificación enviado a tu correo electrónico', 'success');
            setTimeout(() => {
                showForgotPasswordStep2();
            }, 1500);
        } else {
            showAlert(data.message || 'Error al enviar el código de verificación');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión al servidor. Verifica que el backend esté activo.');
    } finally {
        sendResetCodeBtn.classList.remove('loading');
        sendResetCodeBtn.disabled = false;
    }
});

// Event listener para verificar token
verifyTokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const token = document.getElementById('resetToken').value.trim();

    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
        showAlert('Por favor ingresa un código de 6 dígitos válido');
        return;
    }

    const verifyTokenBtn = document.getElementById('verifyTokenBtn');
    verifyTokenBtn.classList.add('loading');
    verifyTokenBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/verify-reset-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: resetEmail, token })
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            showAlert('Código verificado exitosamente', 'success');
            setTimeout(() => {
                showForgotPasswordStep3();
            }, 1500);
        } else {
            showAlert(data.message || 'Código de verificación incorrecto o expirado');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión al servidor. Verifica que el backend esté activo.');
    } finally {
        verifyTokenBtn.classList.remove('loading');
        verifyTokenBtn.disabled = false;
    }
});

// Event listener para restablecer contraseña
resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword || newPassword.length < 8) {
        showAlert('La contraseña debe tener al menos 8 caracteres');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert('Las contraseñas no coinciden');
        return;
    }

    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    resetPasswordBtn.classList.add('loading');
    resetPasswordBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: resetEmail,
                token: document.getElementById('resetToken').value.trim(),
                newPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Contraseña restablecida exitosamente', 'success');
            setTimeout(() => {
                resetEmail = '';
                showLoginForm();
                // Limpiar formularios
                forgotPasswordForm.reset();
                verifyTokenForm.reset();
                resetPasswordForm.reset();
            }, 2000);
        } else {
            showAlert(data.message || 'Error al restablecer la contraseña');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión al servidor. Verifica que el backend esté activo.');
    } finally {
        resetPasswordBtn.classList.remove('loading');
        resetPasswordBtn.disabled = false;
    }
});

// Limpiar alertas al escribir en los formularios de restablecimiento
document.getElementById('resetEmail').addEventListener('input', hideAlert);
document.getElementById('resetToken').addEventListener('input', hideAlert);
document.getElementById('newPassword').addEventListener('input', hideAlert);
document.getElementById('confirmPassword').addEventListener('input', hideAlert);

// Mostrar información de conexión en consola
console.log('%c🔐 AUTENTICACIÓN ACTIVA', 'color: #f97316; font-size: 16px; font-weight: bold;');