const api = '/api/management';
// token, authHeaders(), money(), and escapeHtml() are provided by shared.js.

function formatDate(d) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

async function loadBarOverview() {
  const [summaryRes, ordersRes, menuRes] = await Promise.all([
    fetch(`${api}/bar/summary?range=today`, { headers: authHeaders() }),
    fetch(`${api}/bar/orders`, { headers: authHeaders() }),
    fetch(`${api}/restaurant/menu?department=bar`, { headers: authHeaders() })
  ]);

  if (summaryRes.ok) {
    const summary = await summaryRes.json();
    document.getElementById('bar-order-count').textContent = summary.order_count || 0;
    document.getElementById('bar-revenue').textContent = money(summary.total_sales || 0);
  }

  if (menuRes.ok) {
    const items = await menuRes.json();
    document.getElementById('bar-item-count').textContent = items.length;
    renderBarItems(items);
  }

  if (ordersRes.ok) {
    const orders = await ordersRes.json();
    const tbody = document.getElementById('bar-orders-body');
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No bar orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map((order) => `
      <tr>
        <td>${escapeHtml(order.guest_name)}</td>
        <td>${escapeHtml(order.item_name)}</td>
        <td>${escapeHtml(order.quantity)}</td>
        <td>${money(order.total_amount)}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${formatDate(order.created_at)}</td>
      </tr>
    `).join('');
  }
}

function renderBarItems(items) {
  const tbody = document.getElementById('bar-items-body');
  if (!tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#7a7560;">No bar items yet — add one above.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${money(item.price)}</td>
      <td><button type="button" class="btn btn-outline delete-bar-item" data-id="${item.menu_item_id}" style="padding:4px 10px; font-size:0.8rem;">Delete</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-bar-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this bar item?')) return;
      await fetch(`${api}/restaurant/menu/${btn.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
      loadBarOverview();
    });
  });
}

async function createBarItem(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('bar-item-name').value,
    category: document.getElementById('bar-item-category').value,
    department: 'bar',
    price: document.getElementById('bar-item-price').value,
    description: 'Bar item',
    image_url: '',
    is_active: true
  };
  const status = document.getElementById('bar-items-status');
  status.className = 'status-msg';
  status.textContent = 'Saving…';
  const res = await fetch(`${api}/restaurant/menu`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await res.json().catch(() => ({}));
  if (res.ok) {
    status.textContent = 'Bar item saved.';
    status.className = 'status-msg show success';
    document.getElementById('bar-items-form').reset();
    loadBarOverview();
  } else {
    status.textContent = result.error || 'Could not save bar item.';
    status.className = 'status-msg show error';
  }
}

document.getElementById('bar-items-form').addEventListener('submit', createBarItem);
loadBarOverview();
setInterval(loadBarOverview, 15000);
