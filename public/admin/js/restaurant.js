const api = '/api/management';
// token, authHeaders(), money(), and escapeHtml() are provided by shared.js.

function formatDate(d) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

async function loadRestaurantOverview() {
  const [menuRes, salesRes] = await Promise.all([
    fetch(`${api}/restaurant/menu?department=restaurant`, { headers: authHeaders() }),
    fetch(`${api}/restaurant/sales?range=today`, { headers: authHeaders() })
  ]);

  if (menuRes.ok) {
    const menu = await menuRes.json();
    document.getElementById('menu-count').textContent = menu.length;
    renderMenuItems(menu);
  }

  if (salesRes.ok) {
    const sales = await salesRes.json();
    const total = sales.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const delivered = sales.filter((item) => item.status === 'delivered').length;
    document.getElementById('restaurant-sales').textContent = money(total);
    document.getElementById('restaurant-delivered').textContent = delivered;
    const tbody = document.getElementById('restaurant-sales-body');
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No sales recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map((item) => `
      <tr>
        <td>${escapeHtml(item.item_name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${money(item.total_amount)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${formatDate(item.sold_at)}</td>
      </tr>
    `).join('');
  }
}

function renderMenuItems(menu) {
  const tbody = document.getElementById('menu-items-body');
  if (!tbody) return;
  if (menu.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#7a7560;">No menu items yet — add one below.</td></tr>';
    return;
  }
  tbody.innerHTML = menu.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${money(item.price)}</td>
      <td>${item.is_active ? 'Active' : 'Inactive'}</td>
      <td><button type="button" class="btn btn-outline delete-menu-item" data-id="${item.menu_item_id}" style="padding:4px 10px; font-size:0.8rem;">Delete</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-menu-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this menu item?')) return;
      await fetch(`${api}/restaurant/menu/${btn.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
      loadRestaurantOverview();
    });
  });
}

async function addMenuItem(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('menu-name').value,
    category: document.getElementById('menu-category').value,
    department: 'restaurant',
    price: document.getElementById('menu-price').value,
    description: document.getElementById('menu-description').value,
    image_url: document.getElementById('menu-image').value,
    is_active: document.getElementById('menu-active').checked
  };
  const status = document.getElementById('menu-status');
  status.className = 'status-msg';
  status.textContent = 'Saving…';
  const res = await fetch(`${api}/restaurant/menu`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const result = await res.json().catch(() => ({}));
  if (res.ok) {
    status.textContent = 'Menu item saved.';
    status.className = 'status-msg show success';
    document.getElementById('menu-form').reset();
    loadRestaurantOverview();
  } else {
    status.textContent = result.error || 'Could not save menu item.';
    status.className = 'status-msg show error';
  }
}

function renderMenuFileLink(fileUrl) {
  const linkEl = document.getElementById('menu-upload-link');
  if (!linkEl) return;
  linkEl.innerHTML = '';
  if (!fileUrl) return;
  const link = document.createElement('a');
  link.href = fileUrl;
  link.target = '_blank';
  link.textContent = 'View uploaded menu file';
  linkEl.appendChild(link);
}

// Runs on page load (and can be called again after upload) so the "View
// uploaded menu file" link survives refreshes instead of only appearing
// right after a successful upload.
async function loadMenuFileStatus() {
  try {
    const res = await fetch(`${api}/restaurant/menu/file`, { headers: authHeaders() });
    if (!res.ok) return;
    const { file_url } = await res.json();
    renderMenuFileLink(file_url);
  } catch (err) {
    // silently ignore — link just won't show
  }
}

async function uploadMenuFile(e) {
  e.preventDefault();
  const fileInput = document.getElementById('menu-file');
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function () {
    const payload = {
      file_name: file.name,
      mime_type: file.type,
      file_data: reader.result
    };
    const status = document.getElementById('menu-upload-status');
    const linkEl = document.getElementById('menu-upload-link');
    status.className = 'status-msg';
    status.textContent = 'Uploading…';
    linkEl.innerHTML = '';
    try {
      const res = await fetch(`${api}/restaurant/menu/upload`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        status.textContent = 'Menu uploaded successfully.';
        status.className = 'status-msg show success';
        renderMenuFileLink(result.file_url);
        document.getElementById('menu-upload-form').reset();
      } else {
        status.textContent = result.error || 'Upload failed.';
        status.className = 'status-msg show error';
      }
    } catch (err) {
      status.textContent = 'Network error during upload.';
      status.className = 'status-msg show error';
    }
  };
  reader.readAsDataURL(file);
}

document.getElementById('menu-form').addEventListener('submit', addMenuItem);
document.getElementById('menu-upload-form').addEventListener('submit', uploadMenuFile);
loadRestaurantOverview();
loadMenuFileStatus();
setInterval(loadRestaurantOverview, 15000);
