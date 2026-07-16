// Vercel entry point. server.js exports the Express app (it only calls
// app.listen() when run directly with `node server.js`), so we just hand
// that same app to Vercel's Node runtime here. Every request — pages, static
// assets, and /api/* — is routed to this one function by vercel.json.
module.exports = require('../server/server');
