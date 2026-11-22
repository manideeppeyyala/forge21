// GET /api/tick -> call this every minute (external cron, see README). Finds due alerts and sends an empty Web Push.
// Protected by CRON_SECRET: send "Authorization: Bearer <CRON_SECRET>" (Vercel's own cron does this automatically).
const crypto = require('crypto');
const { redis, K, vapidKeys } = require('./_lib/kv.js');
const { send } = require('./_lib/http.js');
const { emptyRec } = require('./_lib/push.js');
const { sendPush } = require('./_lib/vapid.js');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16) return send(res, 503, { error: 'CRON_SECRET is not set (min 16 chars)' });
    const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!safeEqual(got, secret)) return send(res, 401, { error: 'unauthorised' });

    const db = redis();
    const owner = await db.get(K.owner); // single-owner app: there is only one user to check
    if (!owner || !owner.id) return send(res, 200, { due: 0, note: 'no owner yet' });
    const id = owner.id;
    const rec = await db.get(K.push(id));
    if (!rec || !rec.subs || !rec.subs.length) return send(res, 200, { due: 0, note: 'no devices' });

    const now = Date.now();
    rec.sent = rec.sent || {}; rec.pending = rec.pending || [];
    const due = (rec.alerts || []).filter((a) => a.at <= now && a.at > now - 30 * 60e3 && !rec.sent[a.tag]);
    if (!due.length) return send(res, 200, { due: 0 });
    due.forEach((a) => { rec.sent[a.tag] = now; });
    rec.pending = rec.pending.concat(due).slice(-40);
    rec.alerts = (rec.alerts || []).filter((a) => a.at > now - 6 * 3600e3); // housekeeping
    Object.keys(rec.sent).forEach((t) => { if (now - rec.sent[t] > 2 * 864e5) delete rec.sent[t]; });

    const keys = await vapidKeys();
    const subject = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://forge21.vercel.app';
    const dead = new Set();
    let ok = 0;
    await Promise.all(rec.subs.map(async (s) => {
      try {
        const st = await sendPush(keys, s, subject);
        if (st === 404 || st === 410) dead.add(s.endpoint); else if (st >= 200 && st < 300) ok++;
      } catch (e) { /* alerts stay in "pending"; the next successful push delivers them */ }
    }));
    rec.subs = rec.subs.filter((s) => !dead.has(s.endpoint));
    await db.set(K.push(id), rec);
    return send(res, 200, { due: due.length, pushed: ok, removed: dead.size });
  } catch (e) {
    return send(res, 500, { error: 'server error' });
  }
};
