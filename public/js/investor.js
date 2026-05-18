// investor.js — Investor Dashboard Logic

let categories       = [];
let discoverPage     = 1;
let histPage         = 1;
let selectedProject  = null;
const PAGE_SIZE      = 6;

window.addEventListener('load', async () => {
    await checkAuth();
    await loadCategories();
    await loadStats();
    await loadOverviewInv();
    await loadDiscover();
});

async function checkAuth() {
    try {
        const res  = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 3) { window.location.href = '/'; return; }
        document.getElementById('sideName').textContent   = data.user.name;
        document.getElementById('sideAvatar').textContent = data.user.name[0].toUpperCase();
    } catch (e) { window.location.href = '/'; }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

function nav(el, secId) {
    document.querySelectorAll('.section').forEach(s  => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + secId).classList.add('active');
    el.classList.add('active');
    const titles = { overview:'Overview', discover:'Discover Projects', history:'My Investments' };
    document.getElementById('topTitle').textContent = titles[secId] || secId;
    if (secId === 'discover') { discoverPage = 1; loadDiscover(); }
    if (secId === 'history')  { histPage = 1;    loadHistory(); }
}

function navByName(secId) {
    const el = document.querySelector(`[data-sec="${secId}"]`);
    if (el) nav(el, secId);
}

// ---- Stats ----
async function loadStats() {
    const data = await api('/api/investor/stats');
    if (data.success) {
        const s = data.stats;
        document.getElementById('st-invested').textContent = fmt(s.total_invested || 0);
        document.getElementById('st-backed').textContent   = s.projects_backed || 0;
        document.getElementById('st-success').textContent  = s.funded_count    || 0;
        document.getElementById('st-txns').textContent     = s.total_investments || 0;
    }
}

// ---- Categories ----
async function loadCategories() {
    if (categories.length) return;
    const data = await api('/api/common/categories');
    if (data.success) {
        categories = data.categories;
        const sel = document.getElementById('srchCat');
        categories.forEach(c => {
            const o = document.createElement('option');
            o.value = c.category_id; o.textContent = c.category_name;
            sel.appendChild(o);
        });
    }
}

// ---- Overview: 4 recent investments ----
async function loadOverviewInv() {
    const el   = document.getElementById('overviewInv');
    const data = await api('/api/investor/history?page=1&limit=4');
    if (!data.success || !data.investments.length) {
        el.innerHTML = emptyState('💼', 'No investments yet. Discover projects to begin.');
        return;
    }
    el.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Project</th><th>Amount (PKR)</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
            ${data.investments.map(i => `
            <tr>
                <td class="td-main">${esc(i.project_title)}</td>
                <td class="td-blue">${fmt(i.amount)}</td>
                <td><span class="tag ${statusTag(i.project_status)}">${i.project_status}</span></td>
                <td>${fmtDate(i.invested_at)}</td>
            </tr>`).join('')}
        </tbody>
    </table></div>`;
}

// ---- Discover Projects (READ, paginated) ----
async function loadDiscover() {
    const container = document.getElementById('discoverContainer');
    container.innerHTML = '<div class="load-center"><div class="spinner"></div></div>';

    const title      = document.getElementById('srchTitle').value.trim();
    const category_id = document.getElementById('srchCat').value;
    let url = `/api/investor/search?page=${discoverPage}&limit=${PAGE_SIZE}`;
    if (title)       url += `&title=${encodeURIComponent(title)}`;
    if (category_id) url += `&category_id=${encodeURIComponent(category_id)}`;

    const data = await api(url);
    if (!data.success || !data.projects.length) {
        container.innerHTML = emptyState('🔍', 'No active projects found. Try different filters.');
        return;
    }

    const grid = data.projects.map(p => {
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
                onclick="openInvest(${p.project_id},'${esc(p.title)}',${p.funding_goal},${p.total_collected},${pct})">
                💰 Invest Now
            </button>
        </div>`;
    }).join('');

    const pag = buildPagination(data.total, discoverPage, PAGE_SIZE, 'discoverPage', 'loadDiscover');

    container.innerHTML = `<div class="projects-grid">${grid}</div>${pag}`;
}

function doSearch()   { discoverPage = 1; loadDiscover(); }
function clearSearch() {
    document.getElementById('srchTitle').value = '';
    document.getElementById('srchCat').value   = '';
    discoverPage = 1; loadDiscover();
}

// ---- Invest Modal (CREATE) ----
function openInvest(projectId, title, goal, collected, pct) {
    selectedProject = { projectId, title, goal, collected };
    document.getElementById('investInfo').innerHTML = `
        <strong>${esc(title)}</strong><br>
        PKR ${fmt(collected)} raised of PKR ${fmt(goal)} &nbsp;·&nbsp; ${pct}%<br>
        <div class="progress-bar" style="margin-top:7px;">
            <div class="progress-fill" style="width:${pct}%"></div>
        </div>`;
    document.getElementById('investAmt').value = '';
    document.getElementById('investAlert').classList.remove('show');
    document.getElementById('investModal').classList.add('show');
}

async function confirmInvest() {
    const amount = document.getElementById('investAmt').value;
    if (!amount || parseFloat(amount) <= 0) {
        return alert2('investAlert', 'Please enter a valid amount.', 'error');
    }
    setBtn('investBtn', true);
    const data = await api('/api/investor/invest', 'POST', { project_id: selectedProject.projectId, amount });
    setBtn('investBtn', false, 'Confirm Investment');
    if (data.success) {
        alert2('investAlert', data.message, 'success');
        setTimeout(() => {
            closeModal('investModal');
            loadStats();
            loadDiscover();
            loadOverviewInv();
        }, 1000);
    } else {
        alert2('investAlert', data.message, 'error');
    }
}

// ---- History (READ + DELETE, paginated) ----
async function loadHistory() {
    const tbody = document.getElementById('histBody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="load-center"><div class="spinner"></div></div></td></tr>`;

    const data = await api(`/api/investor/history?page=${histPage}&limit=5`);

    if (!data.success || !data.investments.length) {
        tbody.innerHTML = `<tr><td colspan="8">${emptyState('📜','No investment history yet.')}</td></tr>`;
        document.getElementById('histPag').innerHTML = '';
        return;
    }

    tbody.innerHTML = data.investments.map((i, idx) => {
        const row = (histPage - 1) * 5 + idx + 1;
        const pct = parseFloat(i.percent_funded) || 0;
        return `<tr>
            <td class="txt-dim">${row}</td>
            <td class="td-main">${esc(i.project_title)}</td>
            <td>${esc(i.category_name)}</td>
            <td class="td-blue">${fmt(i.amount)}</td>
            <td>${pct}%</td>
            <td><span class="tag ${statusTag(i.project_status)}">${i.project_status}</span></td>
            <td>${fmtDate(i.invested_at)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="removeInvestment(${i.investment_id})">🗑️ Remove</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('histPag').innerHTML =
        buildPagination(data.total, histPage, 5, 'histPage', 'loadHistory');
}

// DELETE investment
async function removeInvestment(id) {
    if (!confirm('Remove this investment record?')) return;
    const data = await api(`/api/investor/invest/${id}`, 'DELETE');
    if (data.success) {
        loadHistory();
        loadStats();
        loadOverviewInv();
    } else { alert(data.message); }
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

function statusTag(s) { return {Active:'tag-active',Funded:'tag-funded',Closed:'tag-closed'}[s]||'tag-closed'; }
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
function fmt(v)    { return parseFloat(v||0).toLocaleString('en-PK', {minimumFractionDigits:0}); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function esc(s)    { if (s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
