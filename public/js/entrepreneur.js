// entrepreneur.js — Entrepreneur Dashboard Logic

let categories  = [];
let projPage    = 1;
let fundPage    = 1;
let invPage     = 1;
let currentInvProjectId = null;
const PAGE_SIZE = 5;

// ---- Init ----
window.addEventListener('load', async () => {
    await checkAuth();
    await loadCategories();
    await loadStats();
    await loadOverviewProjects();
    document.getElementById('pDeadline').min = today();
    document.getElementById('editDeadline').min = today();
});

async function checkAuth() {
    try {
        const res  = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 2) {
            window.location.href = '/';
            return;
        }
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
    const titles = { overview:'Overview', create:'Create Project', myprojects:'My Projects', funding:'Funding Tracker' };
    document.getElementById('topTitle').textContent = titles[secId] || secId;
    if (secId === 'myprojects') { projPage = 1; loadMyProjects(); }
    if (secId === 'funding')    { fundPage = 1; loadFundingTracker(); }
}

function navByName(secId) {
    const el = document.querySelector(`[data-sec="${secId}"]`);
    if (el) nav(el, secId);
}

// ---- Stats ----
async function loadStats() {
    try {
        const data = await api('/api/entrepreneur/stats');
        if (data.success) {
            const s = data.stats;
            document.getElementById('st-total').textContent  = s.total_projects  || 0;
            document.getElementById('st-active').textContent = s.active_projects || 0;
            document.getElementById('st-funded').textContent = s.funded_projects || 0;
            document.getElementById('st-raised').textContent = fmt(s.total_raised || 0);
        }
    } catch (e) { /* silent */ }
}

// ---- Categories ----
async function loadCategories() {
    if (categories.length) return;
    const data = await api('/api/common/categories');
    if (data.success) {
        categories = data.categories;
        ['pCat','editCat'].forEach(id => {
            const sel = document.getElementById(id);
            categories.forEach(c => {
                const o = document.createElement('option');
                o.value = c.category_id; o.textContent = c.category_name;
                sel.appendChild(o);
            });
        });
    }
}

// ---- Overview: 3 latest projects ----
async function loadOverviewProjects() {
    const el = document.getElementById('overviewList');
    const data = await api('/api/entrepreneur/projects?page=1&limit=3');
    if (!data.success || !data.projects.length) {
        el.innerHTML = emptyState('📭', 'No projects yet. Create your first one!');
        return;
    }
    el.innerHTML = `<div class="projects-grid">${data.projects.map(p => projectCard(p, false)).join('')}</div>`;
}

// ---- My Projects (paginated) ----
async function loadMyProjects() {
    const container = document.getElementById('myProjContainer');
    container.innerHTML = '<div class="load-center"><div class="spinner"></div></div>';

    const data = await api(`/api/entrepreneur/projects?page=${projPage}&limit=${PAGE_SIZE}`);
    if (!data.success || !data.projects.length) {
        container.innerHTML = emptyState('📁', 'No projects found. Start by creating one.');
        return;
    }

    const html = `
        <div class="projects-grid">${data.projects.map(p => projectCard(p, true)).join('')}</div>
        ${buildPagination(data.total, projPage, PAGE_SIZE, 'projPage', 'loadMyProjects')}
    `;
    container.innerHTML = html;
}

function projectCard(p, showActions) {
    const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
    const statusTag = { Active:'tag-active', Funded:'tag-funded', Closed:'tag-closed' }[p.status] || 'tag-closed';
    return `
    <div class="project-card">
        <div class="pc-top">
            <span class="tag tag-cat">${esc(p.category_name)}</span>
            <span class="tag ${statusTag}">${p.status}</span>
        </div>
        <div class="pc-title">${esc(p.title)}</div>
        <div class="pc-desc">${esc(p.description || 'No description provided.')}</div>
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
        ${showActions ? `
        <div class="td-actions" style="margin-top:8px;">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal(${p.project_id},'${esc(p.title)}','${esc(p.description||'')}',${p.category_id},'${p.status}',${p.funding_goal},'${p.deadline}')">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="viewInvestments(${p.project_id},'${esc(p.title)}')">📈 Investments</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.project_id})">🗑️ Delete</button>
        </div>` : ''}
    </div>`;
}

// ---- Create Project (CREATE) ----
async function createProject() {
    const title       = document.getElementById('pTitle').value.trim();
    const description = document.getElementById('pDesc').value.trim();
    const category_id = document.getElementById('pCat').value;
    const funding_goal = document.getElementById('pGoal').value;
    const deadline    = document.getElementById('pDeadline').value;

    if (!title || !category_id || !funding_goal || !deadline) {
        return alert2('createAlert', 'Please fill in all required fields.', 'error');
    }

    setBtn('createBtn', true);
    const data = await api('/api/entrepreneur/projects', 'POST', { title, description, funding_goal, deadline, category_id });
    setBtn('createBtn', false, 'Submit Project');

    if (data.success) {
        alert2('createAlert', data.message, 'success');
        document.getElementById('pTitle').value = '';
        document.getElementById('pDesc').value  = '';
        document.getElementById('pGoal').value  = '';
        document.getElementById('pDeadline').value = '';
        document.getElementById('pCat').value   = '';
        loadStats();
        loadOverviewProjects();
    } else {
        alert2('createAlert', data.message, 'error');
    }
}

// ---- Edit Modal (UPDATE) ----
function openEditModal(id, title, desc, catId, status, goal, deadline) {
    document.getElementById('editId').value       = id;
    document.getElementById('editTitle').value    = title;
    document.getElementById('editDesc').value     = desc;
    document.getElementById('editCat').value      = catId;
    document.getElementById('editStatus').value   = status;
    document.getElementById('editGoal').value     = goal;
    document.getElementById('editDeadline').value = deadline.split('T')[0];
    document.getElementById('editAlert').classList.remove('show');
    document.getElementById('editModal').classList.add('show');
}

async function saveEdit() {
    const id          = document.getElementById('editId').value;
    const title       = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDesc').value.trim();
    const category_id = document.getElementById('editCat').value;
    const status      = document.getElementById('editStatus').value;
    const funding_goal = document.getElementById('editGoal').value;
    const deadline    = document.getElementById('editDeadline').value;

    if (!title || !category_id || !funding_goal || !deadline) {
        return alert2('editAlert', 'All fields are required.', 'error');
    }

    setBtn('editSaveBtn', true);
    const data = await api(`/api/entrepreneur/projects/${id}`, 'PUT', { title, description, funding_goal, deadline, category_id, status });
    setBtn('editSaveBtn', false, 'Save Changes');

    if (data.success) {
        alert2('editAlert', data.message, 'success');
        setTimeout(() => {
            closeModal('editModal');
            loadMyProjects();
            loadStats();
            if (document.getElementById('sec-funding').classList.contains('active')) loadFundingTracker();
        }, 800);
    } else {
        alert2('editAlert', data.message, 'error');
    }
}

// ---- Delete Project (DELETE) ----
async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
    const data = await api(`/api/entrepreneur/projects/${id}`, 'DELETE');
    if (data.success) {
        loadMyProjects();
        loadStats();
        loadOverviewProjects();
    } else {
        alert(data.message);
    }
}

// ---- Funding Tracker (READ, paginated) ----
async function loadFundingTracker() {
    const tbody = document.getElementById('fundBody');
    tbody.innerHTML = '<tr><td colspan="9"><div class="load-center"><div class="spinner"></div></div></td></tr>';

    const data = await api(`/api/entrepreneur/projects?page=${fundPage}&limit=${PAGE_SIZE}`);
    if (!data.success || !data.projects.length) {
        tbody.innerHTML = `<tr><td colspan="9">${emptyState('💰','No projects to track yet.')}</td></tr>`;
        document.getElementById('fundPag').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.projects.map((p, i) => {
        const pct  = Math.min(100, parseFloat(p.percent_funded) || 0);
        const row  = (fundPage - 1) * PAGE_SIZE + i + 1;
        const stag = { Active:'tag-active', Funded:'tag-funded', Closed:'tag-closed' }[p.status] || 'tag-closed';
        return `<tr>
            <td class="txt-dim">${row}</td>
            <td class="td-main">${esc(p.title)}</td>
            <td>${esc(p.category_name)}</td>
            <td class="td-blue">${fmt(p.funding_goal)}</td>
            <td class="td-blue">${fmt(p.total_collected)}</td>
            <td>${fmt(p.remaining_amount)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:7px;min-width:110px;">
                    <div class="progress-bar" style="flex:1;height:4px;">
                        <div class="progress-fill ${pct>=100?'done':''}" style="width:${pct}%"></div>
                    </div>
                    <span style="font-size:0.75rem;font-weight:700;color:var(--accent-light);">${pct}%</span>
                </div>
            </td>
            <td><span class="tag ${stag}">${p.status}</span></td>
            <td>${fmtDate(p.deadline)}</td>
        </tr>`;
    }).join('');

    document.getElementById('fundPag').innerHTML =
        buildPagination(data.total, fundPage, PAGE_SIZE, 'fundPage', 'loadFundingTracker');
}

// ---- Investment Details Modal (READ, paginated) ----
async function viewInvestments(projectId, title) {
    currentInvProjectId = projectId;
    invPage = 1;
    document.getElementById('invModal').classList.add('show');
    loadInvestments(title);
}

async function loadInvestments(title) {
    const body = document.getElementById('invBody');
    body.innerHTML = '<div class="load-center"><div class="spinner"></div></div>';

    const data = await api(`/api/entrepreneur/projects/${currentInvProjectId}/investments?page=${invPage}&limit=5`);

    if (!data.success || !data.investments.length) {
        body.innerHTML = emptyState('📭', `No investments yet for "${title}".`);
        document.getElementById('invPag').innerHTML = '';
        return;
    }

    body.innerHTML = `
        <div class="mb-16" style="font-weight:700;">${esc(title)}</div>
        <div class="table-wrap">
        <table>
            <thead><tr><th>Investor</th><th>Amount (PKR)</th><th>Date</th></tr></thead>
            <tbody>
                ${data.investments.map(i => `
                <tr>
                    <td class="td-main">${esc(i.investor_name)}</td>
                    <td class="td-blue">${fmt(i.amount)}</td>
                    <td>${fmtDateTime(i.invested_at)}</td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

    document.getElementById('invPag').innerHTML =
        buildPagination(data.total, invPage, 5, 'invPage', `loadInvestments('${esc(title)}')`);
}

// ---- Helpers ----
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

async function api(url, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    try {
        const res = await fetch(url, opts);
        return await res.json();
    } catch (e) { return { success: false, message: 'Network error.' }; }
}

function buildPagination(total, current, limit, pageVar, loadFn) {
    const pages = Math.ceil(total / limit);
    if (pages <= 1) return '';
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" ${current<=1?'disabled':''} onclick="${pageVar}=${current-1};${loadFn}()">‹</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i===current?'active':''}" onclick="${pageVar}=${i};${loadFn}()">${i}</button>`;
    }
    html += `<button class="page-btn" ${current>=pages?'disabled':''} onclick="${pageVar}=${current+1};${loadFn}()">›</button>`;
    html += `<span class="page-info">Page ${current} of ${pages} (${total} records)</span></div>`;
    return html;
}

function emptyState(icon, msg) {
    return `<div class="empty-state"><span class="ei">${icon}</span><p>${msg}</p></div>`;
}

function alert2(id, msg, type) {
    const el = document.getElementById(id);
    el.className = `alert alert-${type} show`;
    el.textContent = msg;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function setBtn(id, loading, label = '') {
    const b = document.getElementById(id);
    b.disabled  = loading;
    b.innerHTML = loading ? '<span class="spinner"></span>' : label;
}

function fmt(v) { return parseFloat(v||0).toLocaleString('en-PK', {minimumFractionDigits:0}); }

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});
}

function fmtDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function today() { return new Date().toISOString().split('T')[0]; }

function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
