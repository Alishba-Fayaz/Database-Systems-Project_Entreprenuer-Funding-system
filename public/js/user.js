// user.js — Ordinary User Dashboard Logic

let categories      = [];
let browsePage      = 1;
let histPage        = 1;
let selectedProject = null;
const PAGE_SIZE     = 6;

let verificationData = null;

window.addEventListener('load', async () => {
    await checkAuth();
    await loadCategories();
    await loadVerification();
    await loadOverviewStats();
    await loadFeatured();
});

async function checkAuth() {
    try {
        const res  = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 1) { window.location.href = '/'; return; }
        document.getElementById('sideName').textContent   = data.user.name;
        document.getElementById('sideAvatar').textContent = data.user.name[0].toUpperCase();
    } catch (e) { window.location.href = '/'; }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

// ---- Navigation ----
function nav(el, secId) {
    document.querySelectorAll('.section').forEach(s  => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + secId).classList.add('active');
    el.classList.add('active');
    const titles = { overview:'Overview', verification:'Identity Verification', browse:'Browse Projects', history:'My Contributions' };
    document.getElementById('topTitle').textContent = titles[secId] || secId;
    if (secId === 'browse')       { browsePage = 1; loadBrowse(); }
    if (secId === 'history')      { histPage   = 1; loadHistory(); }
    if (secId === 'verification') { renderVerSection(); }
}

function navByName(secId) {
    const el = document.querySelector(`[data-sec="${secId}"]`);
    if (el) nav(el, secId);
}

// ---- Verification: READ ----
async function loadVerification() {
    const data = await api('/api/user/verification');
    verificationData = data.success ? data.verification : null;
    updateVerBadge();
}

function updateVerBadge() {
    const badge = document.getElementById('verBadge');
    const nudge = document.getElementById('verNudge');
    const stEl  = document.getElementById('st-vstatus');

    if (!verificationData) {
        badge.innerHTML = '<span style="color:var(--red);font-weight:600;">⚠️ Not Verified</span>';
        if (nudge) nudge.style.display = 'block';
        if (stEl)  stEl.textContent    = 'None';
    } else {
        const s = verificationData.status;
        const colors = { Pending:'var(--gold)', Approved:'var(--green)', Rejected:'var(--red)' };
        const icons  = { Pending:'⏳', Approved:'✅', Rejected:'❌' };
        badge.innerHTML = `<span style="color:${colors[s]};font-weight:600;">${icons[s]} ${s}</span>`;
        if (nudge) nudge.style.display = (s === 'Approved') ? 'none' : 'block';
        if (stEl)  stEl.textContent = s;
    }
}

// Render the verification section based on current data
function renderVerSection() {
    const statusCard  = document.getElementById('verStatusCard');
    const submitPanel = document.getElementById('verSubmitPanel');
    const updatePanel = document.getElementById('verUpdatePanel');

    if (!verificationData) {
        // No record — show status card + submit form (CREATE)
        statusCard.innerHTML = `
            <div class="verify-status-card">
                <div class="verify-icon none">🪪</div>
                <div class="verify-info">
                    <h3>Not Verified</h3>
                    <p>You have not submitted any verification details yet. Fill the form below.</p>
                </div>
            </div>`;
        submitPanel.style.display = 'block';
        updatePanel.style.display = 'none';
    } else {
        const s = verificationData.status;
        const icons   = { Pending:'⏳', Approved:'✅', Rejected:'❌' };
        const classes = { Pending:'pending', Approved:'approved', Rejected:'rejected' };
        const msgs    = {
            Pending:  'Your verification is under review. This usually takes 1–3 business days.',
            Approved: 'Your identity has been verified. Full access granted.',
            Rejected: 'Your verification was rejected. Please resubmit with correct information.'
        };
        statusCard.innerHTML = `
            <div class="verify-status-card">
                <div class="verify-icon ${classes[s]}">${icons[s]}</div>
                <div class="verify-info">
                    <h3>Status: ${s}</h3>
                    <p>${msgs[s]}</p>
                    <p style="margin-top:5px;font-size:0.78rem;color:var(--text-3);">
                        ${verificationData.id_type} · ${maskId(verificationData.id_number)} · Submitted: ${fmtDate(verificationData.submitted_at)}
                    </p>
                </div>
            </div>`;

        // Show UPDATE form if not Approved (allow corrections), hide SUBMIT form
        submitPanel.style.display = 'none';
        updatePanel.style.display = (s !== 'Approved') ? 'block' : 'none';
        if (s === 'Rejected') {
            document.getElementById('verUpdateTitle').textContent = '🔄 Resubmit Verification';
        }
        // Pre-fill update form
        document.getElementById('updIdType').value   = verificationData.id_type;
        document.getElementById('updIdNumber').value = verificationData.id_number;
    }
}

// CRUD: CREATE verification
async function submitVerification() {
    const id_type   = document.getElementById('idType').value;
    const id_number = document.getElementById('idNumber').value.trim();
    if (!id_type || !id_number) {
        return alert2('verSubmitAlert', 'Please select ID type and enter ID number.', 'error');
    }
    setBtn('verSubmitBtn', true);
    const data = await api('/api/user/verification', 'POST', { id_type, id_number });
    setBtn('verSubmitBtn', false, 'Submit for Review');
    if (data.success) {
        alert2('verSubmitAlert', data.message, 'success');
        await loadVerification();
        setTimeout(() => renderVerSection(), 600);
    } else {
        alert2('verSubmitAlert', data.message, 'error');
    }
}

// CRUD: UPDATE verification
async function updateVerification() {
    const id_type   = document.getElementById('updIdType').value;
    const id_number = document.getElementById('updIdNumber').value.trim();
    if (!id_type || !id_number) {
        return alert2('verUpdateAlert', 'Please fill both fields.', 'error');
    }
    setBtn('verUpdateBtn', true);
    const data = await api('/api/user/verification', 'PUT', { id_type, id_number });
    setBtn('verUpdateBtn', false, 'Update Details');
    if (data.success) {
        alert2('verUpdateAlert', data.message, 'success');
        await loadVerification();
        setTimeout(() => renderVerSection(), 600);
    } else {
        alert2('verUpdateAlert', data.message, 'error');
    }
}

// ---- Categories ----
async function loadCategories() {
    if (categories.length) return;
    const data = await api('/api/common/categories');
    if (data.success) {
        categories = data.categories;
        const sel = document.getElementById('browseCat');
        categories.forEach(c => {
            const o = document.createElement('option');
            o.value = c.category_id; o.textContent = c.category_name;
            sel.appendChild(o);
        });
    }
}

// ---- Overview Stats ----
async function loadOverviewStats() {
    const data = await api('/api/user/history?page=1&limit=100');
    if (data.success && data.history.length) {
        const total    = data.history.reduce((sum, h) => sum + parseFloat(h.amount), 0);
        const projects = new Set(data.history.map(h => h.project_title)).size;
        document.getElementById('st-contributed').textContent = 'PKR ' + fmt(total);
        document.getElementById('st-supported').textContent   = projects;
    }
}

// ---- Featured Projects (READ, 3 cards) ----
async function loadFeatured() {
    const grid = document.getElementById('featuredGrid');
    const data = await api('/api/user/projects?page=1&limit=3');
    if (!data.success || !data.projects.length) {
        grid.innerHTML = emptyState('🚀', 'No active projects right now. Check back soon!');
        return;
    }
    grid.innerHTML = data.projects.map(p => projectCard(p)).join('');
}

// ---- Browse Projects (READ, paginated) ----
async function loadBrowse() {
    const container = document.getElementById('browseContainer');
    container.innerHTML = '<div class="load-center"><div class="spinner"></div></div>';

    const title       = document.getElementById('browseTitle').value.trim();
    const category_id = document.getElementById('browseCat').value;
    let url = `/api/user/projects?page=${browsePage}&limit=${PAGE_SIZE}`;
    if (title)       url += `&title=${encodeURIComponent(title)}`;
    if (category_id) url += `&category_id=${encodeURIComponent(category_id)}`;

    const data = await api(url);
    if (!data.success || !data.projects.length) {
        container.innerHTML = emptyState('🔍', 'No projects found. Try different filters.');
        return;
    }

    const grid = data.projects.map(p => projectCard(p)).join('');
    const pag  = buildPagination(data.total, browsePage, PAGE_SIZE, 'browsePage', 'loadBrowse');
    container.innerHTML = `<div class="projects-grid">${grid}</div>${pag}`;
}

function doBrowse()   { browsePage = 1; loadBrowse(); }
function clearBrowse() {
    document.getElementById('browseTitle').value = '';
    document.getElementById('browseCat').value   = '';
    browsePage = 1; loadBrowse();
}

function projectCard(p) {
    const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
    return `
    <div class="project-card">
        <div class="pc-top">
            <span class="tag tag-cat">${esc(p.category_name)}</span>
            <span class="tag tag-active">Active</span>
        </div>
        <div class="pc-title">${esc(p.title)}</div>
        <div class="pc-desc">${esc(p.description || 'No description provided.')}</div>
        <div class="pc-by">👤 ${esc(p.entrepreneur_name)}</div>
        <div class="progress-wrap">
            <div class="progress-meta">
                <span class="progress-raised">PKR ${fmt(p.total_collected)}</span>
                <span class="progress-pct">${pct}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${pct>=100?'done':''}" style="width:${pct}%"></div>
            </div>
        </div>
        <div class="pc-footer">
            <span>📅 ${fmtDate(p.deadline)}</span>
            <span class="pc-goal">Goal: <span>PKR ${fmt(p.funding_goal)}</span></span>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:8px;"
            onclick="openFund(${p.project_id},'${esc(p.title)}',${p.funding_goal},${p.total_collected},${pct})">
            🌱 Support Project
        </button>
    </div>`;
}

// ---- Fund Modal (CREATE investment) ----
function openFund(projectId, title, goal, collected, pct) {
    selectedProject = { projectId, title, goal, collected };
    document.getElementById('fundInfo').innerHTML = `
        <strong>${esc(title)}</strong><br>
        PKR ${fmt(collected)} raised of PKR ${fmt(goal)} &nbsp;·&nbsp; ${pct}%<br>
        <div class="progress-bar" style="margin-top:7px;">
            <div class="progress-fill" style="width:${pct}%"></div>
        </div>`;
    document.getElementById('fundAmt').value = '';
    document.getElementById('fundAlert').classList.remove('show');
    document.getElementById('fundModal').classList.add('show');
}

async function confirmFund() {
    const amount = document.getElementById('fundAmt').value;
    if (!amount || parseFloat(amount) <= 0) {
        return alert2('fundAlert', 'Please enter a valid amount.', 'error');
    }
    setBtn('fundBtn', true);
    const data = await api('/api/user/fund', 'POST', { project_id: selectedProject.projectId, amount });
    setBtn('fundBtn', false, 'Confirm Contribution');
    if (data.success) {
        alert2('fundAlert', data.message, 'success');
        setTimeout(() => {
            closeModal('fundModal');
            loadOverviewStats();
            loadFeatured();
            if (document.getElementById('sec-browse').classList.contains('active')) loadBrowse();
        }, 1000);
    } else {
        alert2('fundAlert', data.message, 'error');
    }
}

// ---- History (READ, paginated) ----
async function loadHistory() {
    const tbody = document.getElementById('histBody');
    tbody.innerHTML = `<tr><td colspan="6"><div class="load-center"><div class="spinner"></div></div></td></tr>`;

    const data = await api(`/api/user/history?page=${histPage}&limit=5`);

    if (!data.success || !data.history.length) {
        tbody.innerHTML = `<tr><td colspan="6">${emptyState('📜','No contributions yet. Browse projects and support one!')}</td></tr>`;
        document.getElementById('histPag').innerHTML = '';
        return;
    }

    const stTag = { Active:'tag-active', Funded:'tag-funded', Closed:'tag-closed' };
    tbody.innerHTML = data.history.map((h, idx) => {
        const row = (histPage - 1) * 5 + idx + 1;
        return `<tr>
            <td class="txt-dim">${row}</td>
            <td class="td-main">${esc(h.project_title)}</td>
            <td>${esc(h.category_name)}</td>
            <td class="td-blue">${fmt(h.amount)}</td>
            <td><span class="tag ${stTag[h.project_status]||'tag-closed'}">${h.project_status}</span></td>
            <td>${fmtDate(h.invested_at)}</td>
        </tr>`;
    }).join('');

    document.getElementById('histPag').innerHTML =
        buildPagination(data.total, histPage, 5, 'histPage', 'loadHistory');
}

// ---- Helpers ----
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

async function api(url, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    try { const r = await fetch(url, opts); return await r.json(); }
    catch (e) { return { success: false, message: 'Network error.' }; }
}

function buildPagination(total, current, limit, pageVar, loadFn) {
    const pages = Math.ceil(total / limit);
    if (pages <= 1) return '';
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" ${current<=1?'disabled':''} onclick="${pageVar}=${current-1};${loadFn}()">‹</button>`;
    for (let i = 1; i <= pages; i++)
        html += `<button class="page-btn ${i===current?'active':''}" onclick="${pageVar}=${i};${loadFn}()">${i}</button>`;
    html += `<button class="page-btn" ${current>=pages?'disabled':''} onclick="${pageVar}=${current+1};${loadFn}()">›</button>`;
    html += `<span class="page-info">Page ${current} of ${pages} · ${total} records</span></div>`;
    return html;
}

function emptyState(icon, msg) { return `<div class="empty-state"><span class="ei">${icon}</span><p>${msg}</p></div>`; }

function alert2(id, msg, type) {
    const el = document.getElementById(id);
    el.className = `alert alert-${type} show`;
    el.textContent = msg;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function setBtn(id, loading, label='') {
    const b = document.getElementById(id);
    b.disabled = loading; b.innerHTML = loading ? '<span class="spinner"></span>' : label;
}

function fmt(v) { return parseFloat(v||0).toLocaleString('en-PK', {minimumFractionDigits:0}); }
function fmtDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function maskId(id) { if(!id||id.length<6) return id; return id.slice(0,4)+'****'+id.slice(-3); }
function esc(s) {
    if (s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
