const api = '/api/management';
// token and authHeaders() are provided by shared.js.

async function loadSettings() {
  const res = await fetch(`${api}/settings`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('hotel_name').value = data.hotel_name || '';
  document.getElementById('hotel_address').value = data.hotel_address || '';
  document.getElementById('currency').value = data.currency || 'GH₵';
  document.getElementById('tax_rate').value = data.tax_rate || '0';
  document.getElementById('report_window').value = data.report_window || '7';
  document.getElementById('restaurant_enabled').checked = data.restaurant_enabled !== false;
  document.getElementById('bar_enabled').checked = data.bar_enabled !== false;
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    hotel_name: document.getElementById('hotel_name').value,
    hotel_address: document.getElementById('hotel_address').value,
    currency: document.getElementById('currency').value,
    tax_rate: document.getElementById('tax_rate').value,
    report_window: document.getElementById('report_window').value,
    restaurant_enabled: document.getElementById('restaurant_enabled').checked,
    bar_enabled: document.getElementById('bar_enabled').checked
  };

  const status = document.getElementById('settings-status');
  status.className = 'status-msg';
  status.textContent = 'Saving…';
  const res = await fetch(`${api}/settings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const result = await res.json().catch(() => ({}));
  if (res.ok) {
    status.textContent = result.message || 'Settings updated.';
    status.className = 'status-msg show success';
  } else {
    status.textContent = result.error || 'Could not update settings.';
    status.className = 'status-msg show error';
  }
}

document.getElementById('settings-form').addEventListener('submit', saveSettings);
loadSettings();
