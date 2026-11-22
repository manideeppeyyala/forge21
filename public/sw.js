/* Forge21 service worker: offline shell, notification actions, background checks, push-ready */
const VER = 'forge21-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'data.js', 'merge.js', 'store.js', 'sync.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// stale-while-revalidate for same-origin, cache-first for fonts
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // never cache the API
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VER).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
      return hit || net;
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VER).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); cache.put(req, res.clone()); return res; } catch (err) { return Response.error(); }
    }));
  }
});

/* ---------- IndexedDB (same schema as the page) ---------- */
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('forge21', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('blobs', { keyPath: 'id' }); d.createObjectStore('kv'); d.createObjectStore('pending', { autoIncrement: true }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) { const d = await db(); return new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); }
async function kvSet(k, v) { const d = await db(); return new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); }); }
async function addPending(rec) { const d = await db(); return new Promise((res) => { const t = d.transaction('pending', 'readwrite'); t.objectStore('pending').add(rec); t.oncomplete = () => res(); }); }

/* ---------- notifications ---------- */
const ICON = 'icons/icon-192.png', BADGE = 'icons/badge.png';
function show(a) {
  return self.registration.showNotification(a.title, { body: a.body, tag: a.tag, icon: ICON, badge: BADGE, actions: a.actions, vibrate: [120, 60, 120], data: { key: a.key, id: a.id, kind: a.kind, tag: a.tag } });
}
async function checkDue() {
  const now = Date.now();
  const alerts = (await kvGet('alerts')) || [];
  const shown = (await kvGet('shown')) || {};
  let changed = false;
  for (const a of alerts) {
    if (a.at <= now && a.at > now - 40 * 60e3 && !shown[a.tag]) { shown[a.tag] = now; changed = true; await show(a); }
  }
  if (changed) await kvSet('shown', shown);
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'forge21-check') e.waitUntil(checkDue()); });
self.addEventListener('sync', (e) => { if (e.tag === 'forge21-check') e.waitUntil(checkDue()); });

// The server sends EMPTY pushes. We ask /api/next what is due and show each alert.
// Same tag as the in-page timer, so an alert never shows twice (the newer one replaces the older).
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    const sync = await kvGet('sync');
    let list = [];
    if (sync && sync.id) {
      try {
        const r = await fetch('/api/next', { headers: { 'x-sync': sync.id }, cache: 'no-store' });
        if (r.ok) list = (await r.json()).alerts || [];
      } catch (err) { /* offline: fall through to the generic notice */ }
    }
    if (!list.length) {
      // a push must always show something; this only happens if the page already handled the alert
      return self.registration.showNotification('Forge21', { body: 'Open the app to see what is next.', icon: ICON, badge: BADGE, tag: 'forge21-generic', data: { id: 'generic' } });
    }
    const shown = (await kvGet('shown')) || {};
    for (const a of list) { shown[a.tag] = Date.now(); await show(a); }
    await kvSet('shown', shown);
  })());
});

self.addEventListener('notificationclick', (e) => {
  const n = e.notification, d = n.data || {};
  n.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tell = (m) => wins.forEach((c) => c.postMessage(m));
    if (e.action === 'done' || e.action === 'skip') {
      if (d.id === 'test') return tell({ type: 'testok', action: e.action });
      const status = e.action === 'done' ? 'done' : 'skip';
      await addPending({ date: d.key, id: d.id, status, t: Date.now() });
      const sync = await kvGet('sync');
      if (sync && sync.id) { // tell the server too, so your other devices see it and follow-ups are cancelled
        try { await fetch('/api/action', { method: 'POST', headers: { 'x-sync': sync.id, 'content-type': 'application/json' }, body: JSON.stringify({ date: d.key, id: d.id, status }) }); } catch (err) { /* applied locally; syncs on next open */ }
      }
      return tell({ type: 'pending' });
    }
    if (e.action === 'photo') {
      if (wins.length) { await wins[0].focus(); return wins[0].postMessage({ type: 'cam', key: d.key, id: d.id }); }
      return self.clients.openWindow(`./#cam/${d.key}/${d.id}`);
    }
    if (wins.length) return wins[0].focus();
    return self.clients.openWindow('./#today');
  })());
});
