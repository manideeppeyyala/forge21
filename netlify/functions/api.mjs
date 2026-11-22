// Forge21 API: sync, encrypted photo blobs, push subscriptions and notification actions.
// Auth: header x-sync = sha256(sync code), computed in the browser. The code itself never leaves the device.
// Single-owner lock: the first sync id to connect owns this deployment; every other id is refused (403),
// so strangers who find the URL cannot store anything.
import { getStore } from '@netlify/blobs';
import mergeLib from '../../public/merge.js';
import { vapidKeys } from '../lib/vapid.mjs';

const { mergeStates, sanitize } = mergeLib;
export const config = { path: '/api/*' };

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const store = (name) => getStore({ name, consistency: 'strong' });
const MAX_JSON = 1_000_000;
const MAX_BLOB = 5_000_000;
const ITEM = /^(task:)?[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/; // must start alphanumeric: rules out "__proto__"

const emptyRec = () => ({ subs: [], alerts: [], sent: {}, pending: [] });

async function isOwner(id) {
  const cfg = store('config');
  let owner = await cfg.get('owner', { type: 'json' });
  if (!owner) {
    await cfg.setJSON('owner', { id, at: Date.now() }, { onlyIfNew: true });
    owner = await cfg.get('owner', { type: 'json' }); // re-read: if two requests raced, exactly one wins
  }
  return !!owner && owner.id === id;
}
const isDone = (state, a) => {
  if (!state) return false;
  if (String(a.id).startsWith('task:')) { const t = (state.tasks || []).find((x) => 'task:' + x.id === a.id); return !!(t && t.done); }
  return !!(state.done && state.done[a.key] && state.done[a.key][a.id]);
};
const cleanAlert = (a) => ({
  at: Number(a.at) || 0, tag: String(a.tag || '').slice(0, 80), key: String(a.key || '').slice(0, 10), id: String(a.id || '').slice(0, 45), kind: String(a.kind || '').slice(0, 10),
  title: String(a.title || '').slice(0, 120), body: String(a.body || '').slice(0, 240),
  actions: Array.isArray(a.actions) ? a.actions.slice(0, 2).map((x) => ({ action: ['done', 'skip', 'photo'].includes(x.action) ? x.action : 'done', title: String(x.title).slice(0, 30) })) : []
});
async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_JSON) throw Object.assign(new Error('too large'), { status: 413 });
  try { return JSON.parse(text); } catch (e) { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  if (route === 'config' && req.method === 'GET') {
    const keys = await vapidKeys(store('config'));
    return json({ publicKey: keys.pub });
  }

  const id = req.headers.get('x-sync') || '';
  if (!/^[a-f0-9]{64}$/.test(id)) return json({ error: 'unauthorised' }, 401);

  try {
    if (!(await isOwner(id))) return json({ error: 'locked' }, 403);
    const push = store('push');

    if (route === 'sync' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body || typeof body.state !== 'object' || body.state === null || Array.isArray(body.state)) return json({ error: 'bad body' }, 400);
      const states = store('state');
      const stored = await states.get(id, { type: 'json' });
      const merged = mergeStates(stored || {}, sanitize(body.state));
      await states.setJSON(id, merged);
      const rec = (await push.get(id, { type: 'json' })) || emptyRec();
      if (Array.isArray(body.alerts)) rec.alerts = body.alerts.filter((a) => a && typeof a === 'object').slice(0, 400).map(cleanAlert).filter((a) => a.tag && !isDone(merged, a));
      await push.setJSON(id, rec);
      return json({ state: merged });
    }

    if (route === 'subscribe' && req.method === 'POST') {
      const { sub } = await readJson(req);
      if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000 || !sub.endpoint.startsWith('https://')) return json({ error: 'bad subscription' }, 400);
      const rec = (await push.get(id, { type: 'json' })) || emptyRec();
      rec.subs = rec.subs.filter((s) => s.endpoint !== sub.endpoint).concat([{ endpoint: sub.endpoint }]).slice(-6);
      await push.setJSON(id, rec);
      return json({ ok: true, devices: rec.subs.length });
    }

    if (route === 'unsubscribe' && req.method === 'POST') {
      const { endpoint } = await readJson(req);
      const rec = (await push.get(id, { type: 'json' })) || emptyRec();
      rec.subs = rec.subs.filter((s) => s.endpoint !== endpoint);
      await push.setJSON(id, rec);
      return json({ ok: true });
    }

    // Done / Skip tapped on a notification: update the server copy and silence follow-ups
    if (route === 'action' && req.method === 'POST') {
      const { date, id: itemId, status } = await readJson(req);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || typeof itemId !== 'string' || !ITEM.test(itemId) || !['done', 'skip'].includes(status)) return json({ error: 'bad action' }, 400);
      const states = store('state');
      const state = (await states.get(id, { type: 'json' })) || { v: 1, _m: {}, _t: {} };
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
      await states.setJSON(id, state);
      const rec = (await push.get(id, { type: 'json' })) || emptyRec();
      rec.alerts = rec.alerts.filter((a) => !(a.key === date && a.id === itemId));
      rec.pending = rec.pending.filter((a) => !(a.key === date && a.id === itemId));
      await push.setJSON(id, rec);
      return json({ ok: true });
    }

    // the service worker calls this after an empty push to learn what to show
    if (route === 'next' && req.method === 'GET') {
      const rec = (await push.get(id, { type: 'json' })) || emptyRec();
      const alerts = rec.pending || [];
      if (alerts.length) { rec.pending = []; await push.setJSON(id, rec); }
      return json({ alerts });
    }

    if (route === 'photo') {
      const pid = url.searchParams.get('id') || '';
      if (!/^p[a-z0-9]{3,24}$/.test(pid)) return json({ error: 'bad id' }, 400);
      const photos = store('photos');
      const key = `${id}/${pid}`;
      if (req.method === 'PUT') {
        const buf = await req.arrayBuffer();
        if (buf.byteLength > MAX_BLOB) return json({ error: 'too large' }, 413);
        if (buf.byteLength < 29) return json({ error: 'bad blob' }, 400); // 12-byte IV + 16-byte tag minimum
        await photos.set(key, buf, { metadata: { enc: 'aes-gcm' } });
        return json({ ok: true });
      }
      if (req.method === 'GET') {
        const r = await photos.getWithMetadata(key, { type: 'arrayBuffer' });
        if (!r) return json({ error: 'not found' }, 404);
        return new Response(r.data, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
      }
    }
  } catch (e) {
    return json({ error: e && e.status ? e.message : 'server error' }, (e && e.status) || 500);
  }
  return json({ error: 'not found' }, 404);
};
