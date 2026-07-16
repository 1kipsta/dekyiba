// Home-page staff status + service card behaviour.
// "Take restaurant orders" and "Record bar sales" open dedicated
// order-taking pages (like the Bookings page), reserved for signed-in staff.

function renderStaffStatus() {
  const el = document.getElementById('staff-status');
  if (!el) return;
  if (StaffAuth.isSignedIn()) {
    const info = StaffAuth.info();
    el.innerHTML = `Signed in as ${info.full_name} (${info.role}) &middot; <a href="#" id="staff-signout" style="text-decoration:underline;">Sign out</a>`;
    document.getElementById('staff-signout').addEventListener('click', (e) => {
      e.preventDefault();
      StaffAuth.signOut('/');
    });
  } else {
    el.innerHTML = `<a href="/admin/login.html" style="text-decoration:underline;">Staff login</a>`;
  }
}

document.getElementById('jump-restaurant')?.addEventListener('click', () => {
  if (!StaffAuth.isSignedIn()) {
    window.location.href = '/admin/login.html';
    return;
  }
  window.location.href = '/restaurant-orders.html';
});

document.getElementById('jump-bar')?.addEventListener('click', () => {
  if (!StaffAuth.isSignedIn()) {
    window.location.href = '/admin/login.html';
    return;
  }
  window.location.href = '/bar-orders.html';
});

renderStaffStatus();
