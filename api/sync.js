// POST /api/sync { state, alerts } -> merges the device's state into the stored copy and returns the merged state
const { redis, K } = require('./_lib/kv.js');
const { send, readJson, route } = require('./_lib/http.js');
const { emptyRec, isDone, cleanAlert } = require('./_lib/push.js');
const { mergeStates, sanitize } = require('../public/merge.js'); // the same file the browser uses

module.exports = route('POST', async (req, res, id) => {
  const body = readJson(req);
  if (!body || typeof body.state !== 'object' || body.state === null || Array.isArray(body.state)) return send(res, 400, { error: 'bad body' });
  const db = redis();
  const stored = await db.get(K.state(id));
  const merged = mergeStates(stored || {}, sanitize(body.state));
  await db.set(K.state(id), merged);
  const rec = (await db.get(K.push(id))) || emptyRec();
  if (Array.isArray(body.alerts)) {
    rec.alerts = body.alerts.filter((a) => a && typeof a === 'object').slice(0, 400).map(cleanAlert).filter((a) => a.tag && !isDone(merged, a));
  }
  await db.set(K.push(id), rec);
  return send(res, 200, { state: merged });
});
