// GET /api/next -> the service worker calls this after an empty push to learn what to show
const { redis, K } = require('./_lib/kv.js');
const { send, route } = require('./_lib/http.js');
const { emptyRec } = require('./_lib/push.js');

module.exports = route('GET', async (req, res, id) => {
  const db = redis();
  const rec = (await db.get(K.push(id))) || emptyRec();
  const alerts = rec.pending || [];
  if (alerts.length) { rec.pending = []; await db.set(K.push(id), rec); }
  return send(res, 200, { alerts });
});
