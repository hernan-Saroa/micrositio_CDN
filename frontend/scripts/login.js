/* ═══════════════════════════════════════════════════════════════════════════════
   LOGIN · VIITS Admin — INVIAS Colombia
   Toggle password · Strength indicator · 2FA with device trust
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const alertEl = document.getElementById('alert');
const alertMessage = document.getElementById('alert-message');
const twoFactorStep = document.getElementById('twoFactorStep');
const verify2faBtn = document.getElementById('verify2faBtn');
const backToLogin = document.getElementById('backToLogin');
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

const DEMO_MODE = false;

let _tempToken = '';  // Temporary token while waiting for 2FA
let resetEmail = '';

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════════
function showAlert(message, type = 'error') {
    alertEl.className = `alert alert-${type} show`;
    alertEl.querySelector('.material-icons').textContent =
        type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'check_circle';
    alertMessage.textContent = message;
}
function hideAlert() { alertEl.classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════════════════════
// TOGGLE PASSWORD VISIBILITY
// ═══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target || 'password';
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD STRENGTH INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════
function evaluateStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: 'Débil', cls: 'strength-1' };
    if (score === 2) return { level: 2, label: 'Media', cls: 'strength-2' };
    if (score === 3) return { level: 3, label: 'Fuerte', cls: 'strength-3' };
    return { level: 4, label: 'Muy Fuerte', cls: 'strength-4' };
}

function updateStrengthUI(inputId, containerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!input || !container) return;

    input.addEventListener('input', () => {
        const val = input.value;
        const label = container.querySelector('.strength-label');
        container.className = 'password-strength';

        if (!val) { label.textContent = ''; return; }
        const s = evaluateStrength(val);
        container.classList.add(s.cls);
        label.textContent = s.label;
    });
}

// Bind strength indicator for reset password form
updateStrengthUI('newPassword', 'newPasswordStrength');

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE FINGERPRINT (replaces MAC — browser cannot access MAC)
// ═══════════════════════════════════════════════════════════════════════════════
async function getDeviceFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency || '',
        navigator.platform || '',
        new Date().getTimezoneOffset().toString()
    ];
    const raw = components.join('|');
    // Use SubtleCrypto to hash
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2FA CODE INPUTS — auto-advance + paste support
// ═══════════════════════════════════════════════════════════════════════════════
const tfaInputs = document.querySelectorAll('#tfaCodeInputs input');

tfaInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
        if (inp.value && i < tfaInputs.length - 1) tfaInputs[i + 1].focus();
        checkAutoSubmit2FA();
    });

    inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) {
            tfaInputs[i - 1].focus();
        }
    });

    // Paste support: distribute digits
    inp.addEventListener('paste', e => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        pasted.split('').forEach((ch, j) => {
            if (tfaInputs[j]) tfaInputs[j].value = ch;
        });
        if (pasted.length === 6) checkAutoSubmit2FA();
        else if (tfaInputs[pasted.length]) tfaInputs[pasted.length].focus();
    });
});

function get2FACode() {
    return Array.from(tfaInputs).map(i => i.value).join('');
}

function checkAutoSubmit2FA() {
    const code = get2FACode();
    if (code.length === 6) {
        // Small delay so user sees the last digit
        setTimeout(() => verify2FA(), 150);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM VISIBILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function showView(view) {
    loginForm.style.display = 'none';
    twoFactorStep.style.display = 'none';
    forgotPasswordStep1.style.display = 'none';
    forgotPasswordStep2.style.display = 'none';
    forgotPasswordStep3.style.display = 'none';

    if (view === 'login') loginForm.style.display = 'block';
    if (view === '2fa') twoFactorStep.style.display = 'block';
    if (view === 'reset1') forgotPasswordStep1.style.display = 'block';
    if (view === 'reset2') forgotPasswordStep2.style.display = 'block';
    if (view === 'reset3') forgotPasswordStep3.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) { showAlert('Por favor completa todos los campos'); return; }
    if (!email.includes('@')) { showAlert('Por favor ingresa un correo electrónico válido'); return; }

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    if (DEMO_MODE) {
        setTimeout(() => {
            sessionStorage.setItem('demoUser', email);
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('loginTime', new Date().toISOString());
            showAlert('Inicio de sesión exitoso. Redirigiendo...', 'success');
            setTimeout(() => { window.location.href = 'admin-panel.html'; }, 1000);
        }, 800);
        return;
    }

    try {
        const fingerprint = await getDeviceFingerprint();

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, device_fingerprint: fingerprint })
        });

        if (response.status === 429) {
            let info;
            try { info = await response.json(); } catch { info = {}; }
            const retryMin = info.retryAfterMin || 5;
            const maxAttempts = info.maxAttempts || 5;
            const retrySeconds = info.retryAfter || (retryMin * 60);

            // Mostrar alerta con cuenta regresiva
            showAlert(
                `Has superado ${maxAttempts} intentos fallidos. ` +
                `Espera ${retryMin} minuto${retryMin > 1 ? 's' : ''} para intentar de nuevo.`,
                'warning'
            );

            // Deshabilitar botón y mostrar cuenta regresiva
            loginBtn.disabled = true;
            let remaining = retrySeconds;
            const countdownInterval = setInterval(() => {
                remaining--;
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                loginBtn.textContent = `Espera ${mins}:${secs.toString().padStart(2, '0')}`;
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="material-icons">login</i> Iniciar sesión';
                    hideAlert();
                }
            }, 1000);
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            showAlert(data.message || 'Credenciales inválidas');
            return;
        }

        // Does the user need 2FA?
        if (data.requires_2fa) {
            _tempToken = data.temp_token;
            hideAlert();
            showView('2fa');
            tfaInputs.forEach(i => { i.value = ''; });
            tfaInputs[0].focus();
            return;
        }

        // Direct login (2FA not required or device trusted)
        completeLogin(data);

    } catch (error) {
        console.error('Login error:', error);
        showAlert('Error de conexión al servidor. Verifica que el backend esté activo.');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2FA VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
verify2faBtn.addEventListener('click', () => verify2FA());

async function verify2FA() {
    const code = get2FACode();
    if (code.length !== 6) { showAlert('Ingresa el código completo de 6 dígitos'); return; }

    verify2faBtn.classList.add('loading');
    verify2faBtn.disabled = true;
    hideAlert();

    try {
        const fingerprint = await getDeviceFingerprint();
        const trustDevice = document.getElementById('trustDevice').checked;

        const response = await fetch('/api/auth/2fa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                temp_token: _tempToken,
                code,
                device_fingerprint: fingerprint,
                trust_device: trustDevice
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showAlert(data.message || 'Código incorrecto');
            tfaInputs.forEach(i => { i.value = ''; });
            tfaInputs[0].focus();
            return;
        }

        completeLogin(data);

    } catch (error) {
        console.error('2FA error:', error);
        showAlert('Error de conexión al servidor.');
    } finally {
        verify2faBtn.classList.remove('loading');
        verify2faBtn.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function completeLogin(data) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('loginTime', new Date().toISOString());

    showAlert('Inicio de sesión exitoso. Redirigiendo...', 'success');
    setTimeout(() => { window.location.href = 'admin-panel.html'; }, 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
backToLogin.addEventListener('click', () => { hideAlert(); showView('login'); });

forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); hideAlert(); showView('reset1'); });
backToLoginBtn.addEventListener('click', () => { hideAlert(); showView('login'); });
backToEmailBtn.addEventListener('click', () => { hideAlert(); showView('reset1'); });
backToTokenBtn.addEventListener('click', () => { hideAlert(); showView('reset2'); });

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD — Step 1: Email
// ═══════════════════════════════════════════════════════════════════════════════
forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('resetEmail').value.trim();
    if (!email) { showAlert('Por favor ingresa tu correo electrónico'); return; }
    if (!email.includes('@')) { showAlert('Por favor ingresa un correo válido'); return; }

    const btn = document.getElementById('sendResetCodeBtn');
    btn.classList.add('loading'); btn.disabled = true;

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            resetEmail = email;
            showAlert('Código de verificación enviado a tu correo', 'success');
            setTimeout(() => showView('reset2'), 1500);
        } else {
            showAlert(data.message || 'Error al enviar el código');
        }
    } catch {
        showAlert('Error de conexión al servidor.');
    } finally {
        btn.classList.remove('loading'); btn.disabled = false;
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD — Step 2: Verify Token
// ═══════════════════════════════════════════════════════════════════════════════
verifyTokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const token = document.getElementById('resetToken').value.trim();
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
        showAlert('Ingresa un código de 6 dígitos válido'); return;
    }

    const btn = document.getElementById('verifyTokenBtn');
    btn.classList.add('loading'); btn.disabled = true;

    try {
        const response = await fetch('/api/auth/verify-reset-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, token })
        });
        const data = await response.json();

        if (response.ok && data.valid) {
            showAlert('Código verificado exitosamente', 'success');
            setTimeout(() => showView('reset3'), 1500);
        } else {
            showAlert(data.message || 'Código incorrecto o expirado');
        }
    } catch {
        showAlert('Error de conexión al servidor.');
    } finally {
        btn.classList.remove('loading'); btn.disabled = false;
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD — Step 3: New Password
// ═══════════════════════════════════════════════════════════════════════════════
resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword || newPassword.length < 8) { showAlert('La contraseña debe tener al menos 8 caracteres'); return; }
    if (newPassword !== confirmPassword) { showAlert('Las contraseñas no coinciden'); return; }

    const btn = document.getElementById('resetPasswordBtn');
    btn.classList.add('loading'); btn.disabled = true;

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                showView('login');
                forgotPasswordForm.reset();
                verifyTokenForm.reset();
                resetPasswordForm.reset();
            }, 2000);
        } else {
            showAlert(data.message || 'Error al restablecer la contraseña');
        }
    } catch {
        showAlert('Error de conexión al servidor.');
    } finally {
        btn.classList.remove('loading'); btn.disabled = false;
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAR ALERTS ON INPUT
// ═══════════════════════════════════════════════════════════════════════════════
['email', 'password', 'resetEmail', 'resetToken', 'newPassword', 'confirmPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', hideAlert);
});

// Console branding
console.log('%c🔐 VIITS Admin — Autenticación Segura', 'color: #f97316; font-size: 14px; font-weight: bold;');