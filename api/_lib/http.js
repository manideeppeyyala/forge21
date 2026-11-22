// Small helpers shared by every API route.
const { isOwner } = require('./kv.js');

const send = (res, status, obj) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
};

// Vercel parses JSON bodies for us; octet-stream arrives as a Buffer.
function readJson(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  try {
    if (typeof b === 'string') return JSON.parse(b);
    if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8'));
  } catch (e) { /* fall through */ }
  return null;
}

// returns the caller's sync id, or sends 401/403 and returns null
async function guard(req, res) {
  const id = req.headers['x-sync'];
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) { send(res, 401, { error: 'unauthorised' }); return null; }
  if (!(await isOwner(id))) { send(res, 403, { error: 'locked' }); return null; }
  return id;
}

// wraps a route: method check, auth, error handling
const route = (method, fn, { auth = true } = {}) => async (req, res) => {
  try {
    if (req.method !== method) return send(res, 405, { error: 'method not allowed' });
    const id = auth ? await guard(req, res) : null;
    if (auth && !id) return undefined;
    return await fn(req, res, id);
  } catch (e) {
    return send(res, 500, { error: 'server error' });
  }
};

module.exports = { send, readJson, guard, route };
