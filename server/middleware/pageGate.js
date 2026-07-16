const jwt = require('jsonwebtoken');

// Tiny manual cookie parser — avoids pulling in an extra dependency just to
// read one cookie. Not for arbitrary cookie parsing, just "Cookie: a=b; c=d".
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

const COOKIE_NAME = 'dekyiba_session';

// The only page anyone may reach without already being signed in.
const PUBLIC_PAGES = new Set(['/admin/login.html']);

// Anything with a "real" file extension other than .html is a static asset
// (css/js/images) — those are left alone. The page that loads them is
// already gated, so the assets themselves don't need protecting, and the
// login page needs its own css/js to render at all.
function isPageRequest(urlPath) {
  if (urlPath === '/') return true;
  const last = urlPath.split('/').pop();
  if (!last.includes('.')) return true; // extensionless route
  return last.endsWith('.html');
}

function pageGate(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return next(); // API routes have their own auth
  if (!isPageRequest(req.path)) return next();

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];

  let payload = null;
  if (token) {
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      payload = null;
    }
  }

  // Already signed in and heading to the login page — bounce to the right home.
  if (PUBLIC_PAGES.has(req.path)) {
    if (payload) {
      return res.redirect(payload.role === 'manager' ? '/admin/dashboard.html' : '/');
    }
    return next();
  }

  if (!payload) {
    return res.redirect('/admin/login.html');
  }

  // Everything under /admin/ (besides login) is manager-only.
  if (req.path.startsWith('/admin/') && payload.role !== 'manager') {
    return res.redirect('/');
  }

  req.sessionAdmin = payload;
  next();
}

module.exports = pageGate;
module.exports.COOKIE_NAME = COOKIE_NAME;
