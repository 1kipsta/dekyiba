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
    const res = await fetch(`${API}/management/restaurant/menu?department=restaurant`, { headers: StaffAuth.headers() });
    if (!res.ok) return;
    const menu = await res.json();
    const datalist = document.getElementById('menu-items');
    datalist.innerHTML = menu.map((item) => `<option value="${escapeHtml(item.name)}" data-price="${escapeHtml(item.price)}">`).join('');
  } catch (err) {
    // menu is optional — staff can still type a free-text item
  }
}

async function loadTodaySales() {
  const tbody = document.getElementById('orders-body');
  try {
    const res = await fetch(`${API}/management/restaurant/sales?range=today`, { headers: StaffAuth.headers() });
    if (!res.ok) return;
    const sales = await res.json();
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:#7a7560;">No sales recorded yet today.</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map((s) => `
      <tr>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(s.item_name)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(s.category)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${escapeHtml(s.quantity)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${money(s.total_amount)}</td>
        <td style="padding:12px 16px; border-top:1px solid var(--line);">${formatTime(s.sold_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:#B7472A;">Could not load sales.</td></tr>';
  }
}

document.getElementById('o-item').addEventListener('input', (e) => {
  const options = document.getElementById('menu-items').options;
  for (const opt of options) {
    if (opt.value === e.target.value) {
      document.getElementById('o-price').value = opt.dataset.price;
      break;
    }
  }
});

document.getElementById('record-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('order-status');
  statusEl.className = 'status-msg';

  const payload = {
    item_name: document.getElementById('o-item').value.trim(),
    category: document.getElementById('o-category').value || 'General',
    quantity: document.getElementById('o-qty').value || 1,
    unit_price: document.getElementById('o-price').value || 0,
    status: 'delivered',
    notes: document.getElementById('o-notes').value
  };

  if (!payload.item_name || Number(payload.unit_price) <= 0) {
    statusEl.textContent = 'Enter an item name and a unit price above zero.';
    statusEl.className = 'status-msg show error';
    return;
  }

  try {
    const res = await fetch(`${API}/management/restaurant/sales`, {
      method: 'POST',
      headers: StaffAuth.headers(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not record sale.');

    statusEl.textContent = 'Sale recorded.';
    statusEl.className = 'status-msg show success';
    document.getElementById('o-item').value = '';
    document.getElementById('o-category').value = 'General';
    document.getElementById('o-qty').value = 1;
    document.getElementById('o-price').value = '';
    document.getElementById('o-notes').value = '';
    loadTodaySales();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'status-msg show error';
  }
});

renderStaffStatus();
loadMenu();
loadTodaySales();
setInterval(loadTodaySales, 15000);
