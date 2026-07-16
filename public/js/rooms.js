const API = '/api';
let ROOMS = [];
let selectedRoom = null;

const roomGrid = document.getElementById('room-grid');
const modal = document.getElementById('booking-modal');

function money(n) {
  return `GH₵ ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
}

function roomCardHTML(room) {
  return `
    <div class="room-card">
      <div class="room-image">${room.room_type}</div>
      <div class="room-body">
        <div class="room-type">Room ${room.room_number}</div>
        <h3>${room.room_type}</h3>
        <p>${room.description || ''}</p>
        <div class="room-footer">
          <div class="price">${money(room.price_per_night)}<span> / night</span></div>
          <button class="btn btn-outline" onclick="openBooking(${room.room_id})">Reserve</button>
        </div>
      </div>
    </div>
  `;
}

async function loadRooms(checkIn, checkOut) {
  roomGrid.innerHTML = '<p style="color:#7a7560;">Loading rooms…</p>';
  try {
    let url = `${API}/rooms`;
    if (checkIn && checkOut) url += `?check_in=${checkIn}&check_out=${checkOut}`;

    const res = await fetch(url);
    ROOMS = await res.json();

    if (ROOMS.length === 0) {
      roomGrid.innerHTML = '<p style="color:#7a7560;">No rooms available for those dates. Try different dates.</p>';
      return;
    }
    roomGrid.innerHTML = ROOMS.map(roomCardHTML).join('');
  } catch (err) {
    roomGrid.innerHTML = '<p style="color:#B7472A;">Could not load rooms. Please check your connection and try again.</p>';
  }
}

document.getElementById('search-btn').addEventListener('click', () => {
  const checkIn = document.getElementById('s-checkin').value;
  const checkOut = document.getElementById('s-checkout').value;
  if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
    alert('Check-out date must be after check-in date.');
    return;
  }
  loadRooms(checkIn, checkOut);
  document.getElementById('rooms').scrollIntoView({ behavior: 'smooth' });
});

function openBooking(roomId) {
  selectedRoom = ROOMS.find(r => r.room_id === roomId);
  if (!selectedRoom) return;

  document.getElementById('modal-room-title').textContent = `${selectedRoom.room_type} — Room ${selectedRoom.room_number}`;
  document.getElementById('modal-room-sub').textContent = `${money(selectedRoom.price_per_night)} per night · sleeps ${selectedRoom.capacity}`;
  document.getElementById('b-room-id').value = selectedRoom.room_id;

  const checkIn = document.getElementById('s-checkin').value;
  const checkOut = document.getElementById('s-checkout').value;
  if (checkIn) document.getElementById('b-checkin').value = checkIn;
  if (checkOut) document.getElementById('b-checkout').value = checkOut;

  document.getElementById('booking-status').className = 'status-msg';
  document.getElementById('booking-summary').style.display = 'none';
  updateSummary();

  modal.classList.add('open');
}

function closeBooking() {
  modal.classList.remove('open');
  document.getElementById('booking-form').reset();
}

document.getElementById('modal-close').addEventListener('click', closeBooking);
modal.addEventListener('click', (e) => { if (e.target === modal) closeBooking(); });

function updateSummary() {
  const checkIn = document.getElementById('b-checkin').value;
  const checkOut = document.getElementById('b-checkout').value;
  const box = document.getElementById('booking-summary');

  if (!checkIn || !checkOut || !selectedRoom || new Date(checkOut) <= new Date(checkIn)) {
    box.style.display = 'none';
    return;
  }

  const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  const total = nights * selectedRoom.price_per_night;

  document.getElementById('sum-nights').textContent = `${nights} night${nights > 1 ? 's' : ''}`;
  document.getElementById('sum-rate').textContent = money(selectedRoom.price_per_night) + ' / night';
  document.getElementById('sum-total').textContent = money(total);
  box.style.display = 'block';
}

document.getElementById('b-checkin').addEventListener('change', updateSummary);
document.getElementById('b-checkout').addEventListener('change', updateSummary);

document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('booking-status');
  statusEl.className = 'status-msg';

  const payload = {
    room_id: Number(document.getElementById('b-room-id').value),
    check_in: document.getElementById('b-checkin').value,
    check_out: document.getElementById('b-checkout').value,
    num_guests: Number(document.getElementById('b-guests').value),
    special_request: document.getElementById('b-request').value,
    full_name: document.getElementById('b-name').value,
    email: document.getElementById('b-email').value,
    phone: document.getElementById('b-phone').value
  };

  try {
    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || 'Something went wrong. Please try again.';
      statusEl.className = 'status-msg show error';
      return;
    }

    statusEl.textContent = `Booking #${data.booking_id} received! Total: ${money(data.total_amount)}. We'll confirm shortly.`;
    statusEl.className = 'status-msg show success';
    document.getElementById('booking-form').querySelector('button[type="submit"]').disabled = true;

    setTimeout(() => {
      closeBooking();
      document.getElementById('booking-form').querySelector('button[type="submit"]').disabled = false;
      loadRooms(document.getElementById('s-checkin').value, document.getElementById('s-checkout').value);
    }, 2200);
  } catch (err) {
    statusEl.textContent = 'Network error. Please check your connection and try again.';
    statusEl.className = 'status-msg show error';
  }
});

// Prevent past dates
const today = new Date().toISOString().split('T')[0];
['s-checkin', 's-checkout', 'b-checkin', 'b-checkout'].forEach(id => {
  document.getElementById(id).setAttribute('min', today);
});

loadRooms();
