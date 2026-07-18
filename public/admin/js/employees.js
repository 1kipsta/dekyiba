const api = '/api/management';
// token, authHeaders(), money(), and escapeHtml() are provided by shared.js.

// Read our own admin_id out of the JWT payload (the middle, base64url-encoded
// segment) so we can hide the delete button on the account that's currently
// signed in — matches what the server itself refuses to delete.
function currentAdminId() {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).admin_id;
  } catch (err) {
    return null;
  }
}

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
  const selfId = currentAdminId();

  document.getElementById('staff-count').textContent = admins.length;
  document.getElementById('staff-online-count').textContent = admins.filter((a) => a.is_checked_in).length;

  if (admins.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#7a7560;">No staff accounts yet.</td></tr>';
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
      <td>${admin.admin_id === selfId
        ? '<span style="color:#7a7560; font-size:0.8rem;">This is you</span>'
        : `<button type="button" class="btn btn-outline delete-admin" data-id="${admin.admin_id}" data-name="${escapeHtml(admin.full_name)}" style="padding:4px 10px; font-size:0.8rem;">Delete</button>`}</td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-admin').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete ${btn.dataset.name}'s account? This cannot be undone.`)) return;
      const res = await fetch(`${api}/admins/${btn.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result.error || 'Could not delete account.');
        return;
      }
      loadAdmins();
    });
  });
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
