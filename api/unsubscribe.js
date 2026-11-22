// POST /api/unsubscribe { endpoint } -> forget this device's push endpoint
const { redis, K } = require('./_lib/kv.js');
const { send, readJson, route } = require('./_lib/http.js');
const { emptyRec } = require('./_lib/push.js');

module.exports = route('POST', async (req, res, id) => {
  const body = readJson(req);
  const db = redis();
  const rec = (await db.get(K.push(id))) || emptyRec();
  rec.subs = rec.subs.filter((s) => s.endpoint !== (body && body.endpoint));
  await db.set(K.push(id), rec);
  return send(res, 200, { ok: true });
});
