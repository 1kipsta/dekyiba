// Shared across every admin page: auth token, small helpers, and the live
// top bar (today's sale / delivered orders / restaurant / bar). Load this
// ONE TIME per page, before the page's own script, so page scripts don't
// need to redeclare token/authHeaders/money/escapeHtml themselves.

const API = '/api';
const token = localStorage.getItem('dekyiba_token');
const adminInfo = JSON.parse(localStorage.getItem('dekyiba_admin') || 'null');
const isManager = adminInfo?.role === 'manager';

if (!token) {
  window.location.href = '/admin/login.html';
} else if (!isManager) {
  // Employee accounts never see the admin area — send them back to the home page.
  window.location.href = '/';
}

function authHeaders() {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function money(n) {
  return `GH₵ ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
}

// Escapes untrusted values (guest/booking data) before they're dropped into
// innerHTML templates, to prevent stored XSS from booking form input.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function handleAuthError(res) {
  if (res.status === 401) {
    localStorage.removeItem('dekyiba_token');
    window.location.href = '/admin/login.html';
    return true;
  }
  return false;
}

const welcomeMsg = document.getElementById('welcome-msg');
if (welcomeMsg && adminInfo) {
  welcomeMsg.textContent = `Welcome back, ${adminInfo.full_name}`;
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', headers: authHeaders() });
    } catch (err) {
      // ignore network errors on logout — clear locally regardless
    }
    localStorage.removeItem('dekyiba_token');
    localStorage.removeItem('dekyiba_admin');
    window.location.href = '/admin/login.html';
  });
}

const managerLinks = document.querySelectorAll('[data-manager-only]');
managerLinks.forEach((link) => {
  if (!isManager) link.style.display = 'none';
});

// ---------- Shared live top bar: today's sales & delivered orders ----------
function injectTopBar() {
  const main = document.querySelector('.main');
  if (!main || document.getElementById('shared-topbar')) return;
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.id = 'shared-topbar';
  bar.innerHTML = `
    <div class="topbar-item"><span class="topbar-label">Today's sale</span><span class="topbar-value" id="topbar-today-sale">—</span></div>
    <div class="topbar-item"><span class="topbar-label">Delivered orders</span><span class="topbar-value" id="topbar-delivered">—</span></div>
    <div class="topbar-item"><span class="topbar-label">Restaurant</span><span class="topbar-value" id="topbar-restaurant">—</span></div>
    <div class="topbar-item"><span class="topbar-label">Bar</span><span class="topbar-value" id="topbar-bar">—</span></div>
  `;
  main.prepend(bar);
}

async function refreshTopBar() {
  if (!document.getElementById('shared-topbar')) injectTopBar();
  if (!document.getElementById('topbar-today-sale')) return;
  try {
    const res = await fetch(`${API}/management/reports/today`, { headers: authHeaders() });
    if (await handleAuthError(res)) return;
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('topbar-today-sale').textContent = money(data.today_sales);
    document.getElementById('topbar-delivered').textContent = data.delivered_orders_today;
    document.getElementById('topbar-restaurant').textContent = money(data.restaurant_sales_today);
    document.getElementById('topbar-bar').textContent = money(data.bar_sales_today);
  } catch (err) {
    // stay silent — the top bar is a nice-to-have, not a blocker
  }
}
window.refreshTopBar = refreshTopBar;
injectTopBar();
refreshTopBar();
setInterval(refreshTopBar, 15000);
