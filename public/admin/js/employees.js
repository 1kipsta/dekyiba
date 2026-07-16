const api = '/api/management';
// token, authHeaders(), money(), and escapeHtml() are provided by shared.js.

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return 'Never';
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

async function loadAdmins() {
  const res = await fetch(`${api}/admins`, { headers: authHeaders() });
  if (!res.ok) return;
  const admins = await res.json();
  const tbody = document.getElementById('admins-body');

  document.getElementById('staff-count').textContent = admins.length;
  document.getElementById('staff-online-count').textContent = admins.filter((a) => a.is_checked_in).length;

  if (admins.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No staff accounts yet.</td></tr>';
    return;
  }
  tbody.innerHTML = admins.map((admin) => `
    <tr>
      <td>${escapeHtml(admin.full_name)}</td>
      <td>${escapeHtml(admin.username)}</td>
      <td>${escapeHtml(admin.role)}</td>
      <td><span class="badge ${admin.is_checked_in ? 'online' : 'offline'}">${admin.is_checked_in ? 'Checked in' : 'Checked out'}</span></td>
      <td>${formatDateTime(admin.last_login_at)}</td>
      <td>${formatDate(admin.created_at)}</td>
    </tr>
  `).join('');
}

async function createAdmin(e) {
  e.preventDefault();
  const payload = {
    full_name: document.getElementById('admin-name').value,
    username: document.getElementById('admin-username').value,
    password: document.getElementById('admin-password').value,
    role: document.getElementById('admin-role').value
  };
  const status = document.getElementById('admin-status');
  status.className = 'status-msg';
  status.textContent = 'Creating…';
  const res = await fetch(`${api}/admins`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await res.json().catch(() => ({}));
  if (res.ok) {
    status.textContent = 'Account created.';
    status.className = 'status-msg show success';
    document.getElementById('admin-form').reset();
    loadAdmins();
  } else {
    status.textContent = result.error || 'Could not create account.';
    status.className = 'status-msg show error';
  }
}

document.getElementById('admin-form').addEventListener('submit', createAdmin);
loadAdmins();
setInterval(loadAdmins, 15000);
