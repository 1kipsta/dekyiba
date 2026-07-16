const API = '/api';

if (!StaffAuth.requireStaff()) {
  // requireStaff already redirected to login
}

function renderStaffStatus() {
  const el = document.getElementById('staff-status');
  if (!el) return;
  const info = StaffAuth.info();
  if (!info) return;
  el.innerHTML = `Signed in as ${info.full_name} (${info.role}) &middot; <a href="#" id="staff-signout" style="text-decoration:underline;">Sign out</a>`;
  document.getElementById('staff-signout').addEventListener('click', (e) => {
    e.preventDefault();
    StaffAuth.signOut('/');
  });
}

function money(n) {
  return `GH₵ ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
}

function formatTime(d) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadMenu() {
  try {
    const res = await fetch(`${API}/management/restaurant/menu?department=bar`, { headers: StaffAuth.headers() });
    if (!res.ok) return;
    const menu = await res.json();
    const datalist = document.getElementById('bar-menu-items');
    datalist.innerHTML = menu.map((item) => `<option value="${escapeHtml(item.name)}" data-price="${escapeHtml(item.price)}">`).join('');
  } catch (err) {
    // menu is optional — staff can still type a free-text item
  }
}

document.getElementById('o-item').addEventListener('input', (e) => {
  const options = document.getElementById('bar-menu-items').options;
  for (const opt of options) {
    if (opt.value === e.target.value) {
      document.getElementById('o-price').value = opt.dataset.price;
      break;
    }
  }
});

async function loadTodayOrders() {
  const tbody = document.getElementById('orders-body');
  try {
    const res = await fetch(`${API}/management/bar/orders`, { headers: StaffAuth.headers() });
    if (!res.ok) return;
    const orders = await res.json();
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#7a7560;">No bar orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.slice(0, 30).map((o) => `
      <tr>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(o.guest_name)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(o.item_name)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(o.quantity)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${money(o.total_amount)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(o.status)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${formatTime(o.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#B7472A;">Could not load bar orders.</td></tr>';
  }
}

document.getElementById('record-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('order-status');
  statusEl.className = 'status-msg';

  const payload = {
    guest_name: document.getElementById('o-guest').value.trim(),
    item_name: document.getElementById('o-item').value.trim(),
    quantity: document.getElementById('o-qty').value || 1,
    unit_price: document.getElementById('o-price').value || 0,
    status: 'served',
    notes: document.getElementById('o-notes').value
  };

  if (!payload.guest_name || !payload.item_name || Number(payload.unit_price) <= 0) {
    statusEl.textContent = 'Enter a guest/room, an item, and a unit price above zero.';
    statusEl.className = 'status-msg show error';
    return;
  }

  try {
    const res = await fetch(`${API}/management/bar/orders`, {
      method: 'POST',
      headers: StaffAuth.headers(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not record order.');

    statusEl.textContent = 'Bar order recorded.';
    statusEl.className = 'status-msg show success';
    document.getElementById('o-guest').value = '';
    document.getElementById('o-item').value = '';
    document.getElementById('o-qty').value = 1;
    document.getElementById('o-price').value = '';
    document.getElementById('o-notes').value = '';
    loadTodayOrders();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'status-msg show error';
  }
});

renderStaffStatus();
loadMenu();
loadTodayOrders();
setInterval(loadTodayOrders, 15000);
