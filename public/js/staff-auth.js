// Shared helper for public-facing staff pages (home page, restaurant-orders,
// bar-orders). Any signed-in staff member — manager or employee — counts as
// "staff" here; only the /admin/* pages are restricted to managers.
const StaffAuth = {
  token() {
    return localStorage.getItem('dekyiba_token');
  },
  info() {
    return JSON.parse(localStorage.getItem('dekyiba_admin') || 'null');
  },
  isSignedIn() {
    return Boolean(this.token() && this.info());
  },
  headers() {
    return { Authorization: `Bearer ${this.token()}`, 'Content-Type': 'application/json' };
  },
  requireStaff() {
    if (!this.isSignedIn()) {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  },
  async signOut(redirectTo = '/') {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: this.headers() });
    } catch (err) {
      // ignore network errors on logout — clear locally regardless
    }
    localStorage.removeItem('dekyiba_token');
    localStorage.removeItem('dekyiba_admin');
    window.location.href = redirectTo;
  }
};
