// POST /api/action { date, id, status } -> Done/Skip tapped on a notification: update the server copy, silence follow-ups
const { redis, K } = require('./_lib/kv.js');
const { send, readJson, route } = require('./_lib/http.js');
const { emptyRec } = require('./_lib/push.js');

const ITEM = /^(task:)?[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/; // must start alphanumeric: rules out "__proto__"

module.exports = route('POST', async (req, res, id) => {
  const b = readJson(req) || {};
  const { date, id: itemId, status } = b;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || typeof itemId !== 'string' || !ITEM.test(itemId) || !['done', 'skip'].includes(status)) return send(res, 400, { error: 'bad action' });
  const db = redis();
  const state = (await db.get(K.state(id))) || { v: 1, _m: {}, _t: {} };
  state._m = state._m || {};
  if (itemId.startsWith('task:')) {
    const t = (state.tasks || []).find((x) => 'task:' + x.id === itemId);
    if (t && status === 'done') { t.done = true; state._m.tasks = Date.now(); }
  } else {
    state.done = state.done || {};
    state.done[date] = state.done[date] || {};
    state.done[date][itemId] = status;
    state._m.done = Date.now();
  }
  await db.set(K.state(id), state);
  const rec = (await db.get(K.push(id))) || emptyRec();
  rec.alerts = rec.alerts.filter((a) => !(a.key === date && a.id === itemId));
  rec.pending = rec.pending.filter((a) => !(a.key === date && a.id === itemId));
  await db.set(K.push(id), rec);
  return send(res, 200, { ok: true });
});
