// login.js — Handles Sign In and Sign Up

// On page load: redirect if already logged in, and load roles
window.addEventListener('load', async () => {
    // If already logged in, redirect immediately
    try {
        const res  = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
            redirectByRole(data.user.role_id);
            return;
        }
    } catch (e) { /* not logged in, stay on page */ }

    // Load roles for Sign Up dropdown
    loadRoles();
});

// Allow Enter key to submit
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const signinVisible = document.getElementById('formSignin').style.display !== 'none';
    if (signinVisible) doLogin(); else doSignup();
});

function showTab(tab) {
    document.getElementById('formSignin').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('formSignup').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('tabSignin').classList.toggle('active', tab === 'signin');
    document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

async function loadRoles() {
    const sel = document.getElementById('signupRole');
    if (sel.options.length > 1) return;
    try {
        const res  = await fetch('/api/auth/roles');
        const data = await res.json();
        if (data.success) {
            data.roles.forEach(r => {
                const opt    = document.createElement('option');
                opt.value    = r.role_id;
                opt.textContent = r.role_name;
                sel.appendChild(opt);
            });
        }
    } catch (e) { console.error('Could not load roles.'); }
}

async function doLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        return showAlert('loginAlert', 'Please fill in both fields.', 'error');
    }

    setBtn('loginBtn', true, 'Sign In');
    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            showAlert('loginAlert', 'Login successful! Redirecting...', 'success');
            setTimeout(() => window.location.href = data.redirect, 700);
        } else {
            showAlert('loginAlert', data.message, 'error');
            setBtn('loginBtn', false, 'Sign In');
        }
    } catch (e) {
        showAlert('loginAlert', 'Cannot connect to server. Is it running?', 'error');
        setBtn('loginBtn', false, 'Sign In');
    }
}

async function doSignup() {
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const role_id  = document.getElementById('signupRole').value;

    if (!name || !email || !password || !role_id) {
        return showAlert('signupAlert', 'All fields are required.', 'error');
    }
    if (!email.includes('@')) {
        return showAlert('signupAlert', 'Email must contain @.', 'error');
    }

    setBtn('signupBtn', true, 'Create Account');
    try {
        const res  = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role_id })
        });
        const data = await res.json();

        if (data.success) {
            showAlert('signupAlert', data.message + ' You can now sign in.', 'success');
            setTimeout(() => showTab('signin'), 1500);
        } else {
            showAlert('signupAlert', data.message, 'error');
        }
    } catch (e) {
        showAlert('signupAlert', 'Cannot connect to server.', 'error');
    }
    setBtn('signupBtn', false, 'Create Account');
}

function redirectByRole(role_id) {
    if (role_id === 2) window.location.href = '/entrepreneur';
    else if (role_id === 3) window.location.href = '/investor';
    else window.location.href = '/dashboard';
}

function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    el.className = 'alert alert-' + type + ' show';
    el.textContent = msg;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function setBtn(id, loading, label) {
    const b = document.getElementById(id);
    b.disabled   = loading;
    b.innerHTML  = loading ? '<span class="spinner"></span>' : label;
}
