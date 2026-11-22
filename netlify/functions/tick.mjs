// Runs every minute. For each user, finds alerts that are due and sends an empty Web Push to their devices.
// The service worker then calls /api/next to fetch the text and shows the notification with its buttons.
import { getStore } from '@netlify/blobs';
import { vapidKeys, sendPush } from '../lib/vapid.mjs';

export const config = { schedule: '* * * * *' };

export default async () => {
  const now = Date.now();
  const push = getStore({ name: 'push', consistency: 'strong' });
  const keys = await vapidKeys(getStore({ name: 'config', consistency: 'strong' }));
  const subject = process.env.URL || 'https://forge21.netlify.app';
  const { blobs } = await push.list();

  await Promise.all(blobs.map(async ({ key: id }) => {
    try {
      const rec = await push.get(id, { type: 'json' });
      if (!rec || !rec.subs || !rec.subs.length) return;
      rec.sent = rec.sent || {}; rec.pending = rec.pending || [];
      const due = (rec.alerts || []).filter((a) => a.at <= now && a.at > now - 30 * 60e3 && !rec.sent[a.tag]);
      if (!due.length) return;
      due.forEach((a) => { rec.sent[a.tag] = now; });
      rec.pending = rec.pending.concat(due).slice(-40);
      // housekeeping
      rec.alerts = rec.alerts.filter((a) => a.at > now - 6 * 3600e3);
      Object.keys(rec.sent).forEach((t) => { if (now - rec.sent[t] > 2 * 864e5) delete rec.sent[t]; });
      const dead = new Set();
      await Promise.all(rec.subs.map(async (s) => {
        try { const st = await sendPush(keys, s, subject); if (st === 404 || st === 410) dead.add(s.endpoint); } catch (e) { /* retry next minute via pending */ }
      }));
      rec.subs = rec.subs.filter((s) => !dead.has(s.endpoint));
      await push.setJSON(id, rec);
    } catch (e) { /* one user failing must not stop the rest */ }
  }));
};
