// POST /api/subscribe { sub } -> remember this device's push endpoint
const { redis, K } = require('./_lib/kv.js');
const { send, readJson, route } = require('./_lib/http.js');
const { emptyRec } = require('./_lib/push.js');

module.exports = route('POST', async (req, res, id) => {
  const body = readJson(req);
  const sub = body && body.sub;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000 || !sub.endpoint.startsWith('https://')) return send(res, 400, { error: 'bad subscription' });
  const db = redis();
  const rec = (await db.get(K.push(id))) || emptyRec();
  rec.subs = rec.subs.filter((s) => s.endpoint !== sub.endpoint).concat([{ endpoint: sub.endpoint }]).slice(-6);
  await db.set(K.push(id), rec);
  return send(res, 200, { ok: true, devices: rec.subs.length });
});
