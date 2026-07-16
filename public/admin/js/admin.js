// Shared token/authHeaders/money/escapeHtml/handleAuthError/welcome/logout/top-bar
// now live in shared.js, loaded before this file on dashboard.html.

async function loadStats() {
  if (!document.getElementById('stat-total')) return;

  const res = await fetch(`${API}/bookings/stats/summary`, { headers: authHeaders() });
  if (await handleAuthError(res)) return;
  const data = await res.json();

  document.getElementById('stat-total').textContent = data.total_rooms;
  document.getElementById('stat-occupied').textContent = data.occupied;
  document.getElementById('stat-pending').textContent = data.pending_bookings;
  document.getElementById('stat-revenue').textContent = money(data.monthly_revenue);
}

let ROOMS = [];

async function loadRooms() {
  const tbody = document.getElementById('rooms-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">Loading…</td></tr>';

  const res = await fetch(`${API}/rooms`, { headers: authHeaders() });
  if (await handleAuthError(res)) return;
  const rooms = await res.json();
  ROOMS = rooms;

  if (rooms.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No rooms found.</td></tr>';
    return;
  }

  tbody.innerHTML = rooms.map(room => `
    <tr>
      <td>Room ${escapeHtml(room.room_number)}</td>
      <td>${escapeHtml(room.room_type)}</td>
      <td>${escapeHtml(room.capacity)}</td>
      <td>${money(room.price_per_night)}</td>
      <td>${escapeHtml(room.status)}</td>
      <td><button type="button" class="btn btn-outline edit-room-btn" data-id="${room.room_id}" style="padding:6px 12px; font-size:0.82rem;">Edit</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.edit-room-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditRoom(Number(btn.dataset.id)));
  });
}

const editRoomModal = document.getElementById('edit-room-modal');

function openEditRoom(roomId) {
  const room = ROOMS.find(r => r.room_id === roomId);
  if (!room || !editRoomModal) return;

  document.getElementById('edit-room-id').value = room.room_id;
  document.getElementById('edit-room-number').value = room.room_number;
  document.getElementById('edit-room-type').value = room.room_type;
  document.getElementById('edit-room-price').value = room.price_per_night;
  document.getElementById('edit-room-capacity').value = room.capacity;
  document.getElementById('edit-room-status').value = room.status;
  document.getElementById('edit-room-description').value = room.description || '';
  document.getElementById('edit-room-sub').textContent = `Room ${room.room_number} · ${room.room_type}`;
  document.getElementById('edit-room-status-msg').textContent = '';

  editRoomModal.classList.add('open');
}

function closeEditRoom() {
  editRoomModal?.classList.remove('open');
}

document.getElementById('edit-room-close')?.addEventListener('click', closeEditRoom);
editRoomModal?.addEventListener('click', (e) => { if (e.target === editRoomModal) closeEditRoom(); });

document.getElementById('edit-room-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('edit-room-status-msg');
  statusEl.textContent = 'Saving…';

  const roomId = document.getElementById('edit-room-id').value;
  const payload = {
    room_number: document.getElementById('edit-room-number').value,
    room_type: document.getElementById('edit-room-type').value,
    description: document.getElementById('edit-room-description').value,
    price_per_night: document.getElementById('edit-room-price').value,
    capacity: document.getElementById('edit-room-capacity').value,
    status: document.getElementById('edit-room-status').value
  };

  try {
    const res = await fetch(`${API}/rooms/${roomId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not update room');
    statusEl.textContent = 'Room updated successfully.';
    loadRooms();
    loadStats();
    setTimeout(closeEditRoom, 900);
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

document.getElementById('delete-room-btn')?.addEventListener('click', async () => {
  const roomId = document.getElementById('edit-room-id').value;
  if (!confirm('Delete this room? This cannot be undone.')) return;

  const statusEl = document.getElementById('edit-room-status-msg');
  statusEl.textContent = 'Deleting…';

  try {
    const res = await fetch(`${API}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not delete room');
    closeEditRoom();
    loadRooms();
    loadStats();
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

async function loadBookings(status = '') {
  const tbody = document.getElementById('bookings-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">Loading…</td></tr>';

  const url = status ? `${API}/bookings?status=${status}` : `${API}/bookings`;
  const res = await fetch(url, { headers: authHeaders() });
  if (await handleAuthError(res)) return;
  const bookings = await res.json();

  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7a7560;">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td>
        <strong>${escapeHtml(b.full_name)}</strong><br>
        <span style="color:#7a7560; font-size:0.82rem;">${escapeHtml(b.email)}</span>
      </td>
      <td>${escapeHtml(b.room_type)}<br><span style="color:#7a7560; font-size:0.82rem;">Room ${escapeHtml(b.room_number)}</span></td>
      <td>${formatDate(b.check_in)}</td>
      <td>${formatDate(b.check_out)}</td>
      <td>${money(b.total_amount)}</td>
      <td>
        <select class="status-select" data-id="${b.booking_id}">
          ${['pending','confirmed','checked_in','checked_out','cancelled'].map(s =>
            `<option value="${s}" ${s === b.status ? 'selected' : ''}>${s.replace('_',' ')}</option>`
          ).join('')}
        </select>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const bookingId = e.target.dataset.id;
      const newStatus = e.target.value;
      try {
        const res = await fetch(`${API}/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error();
        loadStats();
      } catch {
        alert('Could not update booking status. Please try again.');
      }
    });
  });
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


document.getElementById('room-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('room-status');
  statusEl.textContent = 'Saving…';

  const payload = {
    room_number: document.getElementById('room-number').value,
    room_type: document.getElementById('room-type').value,
    description: document.getElementById('room-description').value,
    price_per_night: document.getElementById('room-price').value,
    capacity: document.getElementById('room-capacity').value,
    image_url: null
  };

  try {
    const res = await fetch(`${API}/rooms`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not add room');
    statusEl.textContent = 'Room added successfully.';
    document.getElementById('room-form').reset();
    document.getElementById('room-capacity').value = '2';
    loadRooms();
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

const tabs = document.getElementById('tabs');
if (tabs) {
  tabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    loadBookings(e.target.dataset.status);
  });
}

loadStats();
loadRooms();
if (document.getElementById('bookings-body')) {
  loadBookings();
}
