const api = '/api/management';
// token, authHeaders(), money(), and escapeHtml() are provided by shared.js.

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadRooms() {
  const tbody = document.getElementById('rooms-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#7a7560;">Loading…</td></tr>';

  const res = await fetch('/api/rooms', { headers: authHeaders() });
  if (!res.ok) return;
  const rooms = await res.json();

  if (rooms.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#7a7560;">No rooms found.</td></tr>';
    return;
  }

  tbody.innerHTML = rooms.map((room) => `
    <tr>
      <td>Room ${escapeHtml(room.room_number)}</td>
      <td>${escapeHtml(room.room_type)}</td>
      <td>${escapeHtml(room.capacity)}</td>
      <td>${money(room.price_per_night)}</td>
      <td>
        <select class="status-select" data-room-id="${room.room_id}">
          <option value="available" ${room.status === 'available' ? 'selected' : ''}>Available</option>
          <option value="maintenance" ${room.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
          <option value="unavailable" ${room.status === 'unavailable' ? 'selected' : ''}>Unavailable</option>
        </select>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const roomId = e.target.dataset.roomId;
      const status = e.target.value;
      await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      loadRooms();
    });
  });
}

async function loadBookings(status = '') {
  const tbody = document.getElementById('bookings-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">Loading…</td></tr>';

  const res = await fetch(status ? `/api/bookings?status=${status}` : '/api/bookings', { headers: authHeaders() });
  if (!res.ok) return;
  const bookings = await res.json();

  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><strong>${escapeHtml(b.full_name)}</strong><br><span style="color:#7a7560; font-size:0.82rem;">${escapeHtml(b.email)}</span></td>
      <td>${escapeHtml(b.room_type)}<br><span style="color:#7a7560; font-size:0.82rem;">Room ${escapeHtml(b.room_number)}</span></td>
      <td>${formatDate(b.check_in)}</td>
      <td>${formatDate(b.check_out)}</td>
      <td>${money(b.total_amount)}</td>
      <td>
        <select class="status-select booking-status" data-id="${b.booking_id}">
          ${['pending','confirmed','checked_in','checked_out','cancelled'].map((s) => `<option value="${s}" ${s === b.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.booking-status').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const bookingId = e.target.dataset.id;
      const status = e.target.value;
      await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      loadBookings(document.querySelector('#tabs .tab-btn.active')?.dataset.status || '');
    });
  });
}

let currentReportQuery = { range: '7' };

function reportQueryString(query) {
  return new URLSearchParams(query).toString();
}

async function loadReport(query = currentReportQuery) {
  currentReportQuery = query;
  const labelEl = document.getElementById('report-window-label');
  try {
    const res = await fetch(`${api}/reports/summary?${reportQueryString(query)}`, { headers: authHeaders() });
    const report = await res.json().catch(() => ({}));
    if (!res.ok) {
      labelEl.textContent = report.error || 'Could not load the report. Please try again.';
      return;
    }
    document.getElementById('report-room-revenue').textContent = money(report.room_revenue);
    document.getElementById('report-room-bookings').textContent = report.room_bookings;
    document.getElementById('report-restaurant-sales').textContent = money(report.restaurant_sales);
    document.getElementById('report-bar-sales').textContent = money(report.bar_sales);
    document.getElementById('report-total-revenue').textContent = money(report.total_revenue);
    labelEl.textContent = report.label ? `Showing: ${report.label}` : '';
  } catch (err) {
    labelEl.textContent = 'Network error loading report. Please check your connection.';
  }
}

document.querySelectorAll('#tabs .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadBookings(btn.dataset.status || '');
  });
});

document.querySelectorAll('.panel-head .tab-btn').forEach((btn) => {
  if (!btn.dataset.range) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel-head .tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('report-start-date').value = '';
    document.getElementById('report-end-date').value = '';
    loadReport({ range: btn.dataset.range || '7' });
  });
});

document.getElementById('report-custom-range').addEventListener('click', () => {
  const start = document.getElementById('report-start-date').value;
  const end = document.getElementById('report-end-date').value;
  if (!start || !end) {
    alert('Pick both a start and an end date.');
    return;
  }
  if (start > end) {
    alert('The start date must be before the end date.');
    return;
  }
  document.querySelectorAll('.panel-head .tab-btn').forEach((b) => b.classList.remove('active'));
  loadReport({ start_date: start, end_date: end });
});

document.getElementById('export-report').addEventListener('click', async () => {
  const statusEl = document.getElementById('export-status');
  statusEl.className = 'status-msg';
  statusEl.textContent = 'Preparing export…';
  try {
    const res = await fetch(`${api}/reports/export?${reportQueryString(currentReportQuery)}`, { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not export report.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'dekyiba-report.csv';

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    statusEl.textContent = 'Export downloaded.';
    statusEl.className = 'status-msg show success';
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'status-msg show error';
  }
});

loadRooms();
loadBookings();
loadReport({ range: '7' });
