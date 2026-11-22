/* Forge21 — cross-device sync + Web Push subscription (talks to /api, see netlify/functions) */
(function () {
  const F = window.F;
  const K = 'forge21.sync';
  const S = () => F.state;
  const sy = (F.sync = { applying: false, busy: false, dirty: false, last: 0, error: '' });

  const cfg = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch (e) { return null; } };
  sy.cfg = cfg;
  const sha256 = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  sy.newCode = () => {
    const b = crypto.getRandomValues(new Uint8Array(20));
    const s = Array.from(b, (x) => ALPHA[x % 32]).join('');
    return s.match(/.{4}/g).join('-');
  };

  const api = async (path, opts = {}) => {
    const c = cfg();
    const res = await fetch('/api/' + path, Object.assign({}, opts, { headers: Object.assign({ 'x-sync': c ? c.id : '' }, opts.headers || {}) }));
    if (!res.ok) throw new Error(res.status === 404 ? 'no-server' : 'http-' + res.status);
    // (the server answers 403 when another sync code already owns this deployment)
    return res;
  };

  const exportable = () => {
    const o = { v: 1, _m: Object.assign({}, S()._m), _t: Object.assign({}, S()._t) };
    F.SYNC_KEYS.forEach((k) => { if (S()[k] !== undefined) o[k] = S()[k]; });
    return o;
  };
  const hashKeys = () => F.SYNC_KEYS.map((k) => JSON.stringify(S()[k])).join('|') + JSON.stringify(S()._t);

  sy.applyRemote = (remote) => {
    const merged = F.syncMerge(exportable(), remote); // local edits made while the request was in flight are kept
    sy.applying = true;
    F.state = Object.assign({}, F.state, merged);
    F.snapHash();
    F.saveNow();
    sy.applying = false;
    if (F.ui && !document.querySelector('.sheet')) F.ui.render();
  };

  sy.now = async () => {
    if (!cfg() || !navigator.onLine) return;
    if (sy.busy) { sy.dirty = true; return; }
    sy.busy = true; sy.error = '';
    const sent = hashKeys();
    try {
      const alerts = S().notif && S().notif.on !== undefined ? F.alerts(S(), Date.now() - 3600e3) : [];
      const res = await api('sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: exportable(), alerts }) });
      const { state } = await res.json();
      sy.applyRemote(state);
      sy.last = Date.now();
      try { localStorage.setItem(K, JSON.stringify(Object.assign(cfg(), { last: sy.last }))); } catch (e) { /* ignore */ }
      if (hashKeys() !== sent) sy.dirty = true;
    } catch (e) { sy.error = ['no-server', 'http-403'].includes(e.message) ? e.message : 'failed'; }
    sy.busy = false;
    if (sy.dirty) { sy.dirty = false; sy.schedule(1500); }
    if (sy.onStatus) sy.onStatus();
  };
  let t = 0;
  sy.schedule = (ms = 3000) => { if (!cfg()) return; clearTimeout(t); t = setTimeout(sy.now, ms); };

  sy.connect = async (code) => {
    const n = norm(code);
    if (n.length < 20) throw new Error('short');
    const pretty = n.match(/.{4}/g).join('-');
    localStorage.setItem(K, JSON.stringify({ code: pretty, id: await sha256(n), last: 0 }));
    await F.kvSet('sync', { id: cfg().id });
    await sy.now();
    if (sy.error) { const e = sy.error; await sy.disconnect(true); throw new Error(e); }
    if (S().profile && (S().profile.name || S().weights && Object.keys(S().weights).length)) S().onboarded = true;
    F.save();
  };
  sy.disconnect = async (keepPush) => {
    if (!keepPush) await sy.pushOff().catch(() => {}); // needs the credentials, so do it first
    localStorage.removeItem(K);
    F.kvSet('sync', null).catch(() => {});
  };

  /* ---------- push ---------- */
  const b64uToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  sy.pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  sy.pushOn = async () => {
    if (!sy.pushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  };
  sy.pushEnable = async () => {
    if (!cfg()) throw new Error('not-linked');
    if (!sy.pushSupported()) throw new Error('unsupported');
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch('/api/config')).json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
    await api('subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
    S().notif.on = true; F.save();
    sy.now();
  };
  sy.pushOff = async () => {
    if (!sy.pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try { await api('unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (e) { /* ignore */ }
    await sub.unsubscribe();
  };

  /* ---------- photo blobs: end-to-end encrypted ----------
     AES-GCM 256, key derived (PBKDF2, 150k rounds) from your sync code, which the server never sees
     (it only gets the SHA-256 of the code). The server stores random-looking bytes. */
  const te = new TextEncoder(), td = new TextDecoder();
  const MTYPE = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;
  let keyCache = null;
  const encKey = async () => {
    const code = norm(cfg().code);
    if (keyCache && keyCache.code === code) return keyCache.key;
    const base = await crypto.subtle.importKey('raw', te.encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('forge21/blobs/v1'), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    keyCache = { code, key };
    return key;
  };
  sy.encrypt = async (blob) => {
    const type = te.encode(MTYPE.test(blob.type) ? blob.type : 'application/octet-stream');
    const data = new Uint8Array(await blob.arrayBuffer());
    const plain = new Uint8Array(2 + type.length + data.length);
    plain[0] = type.length >> 8; plain[1] = type.length & 255; plain.set(type, 2); plain.set(data, 2 + type.length);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encKey(), plain));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return new Blob([out], { type: 'application/octet-stream' });
  };
  sy.decrypt = async (buf) => {
    const b = new Uint8Array(buf);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await encKey(), b.slice(12)));
    const tl = (pt[0] << 8) | pt[1];
    const type = td.decode(pt.slice(2, 2 + tl));
    return new Blob([pt.slice(2 + tl)], { type: MTYPE.test(type) ? type : 'application/octet-stream' }); // whitelist: never html/svg/js
  };
  sy.uploadBlob = async (id) => {
    if (!cfg()) return;
    try {
      const rec = await F.blobGet(id);
      if (!rec) return;
      await api('photo?id=' + encodeURIComponent(id), { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: await sy.encrypt(rec.blob) });
    } catch (e) { /* stays local; retried next launch */ }
  };
  F.fetchRemoteBlob = async (id) => {
    if (!cfg() || !navigator.onLine) return null;
    try { return await sy.decrypt(await (await api('photo?id=' + encodeURIComponent(id))).arrayBuffer()); } catch (e) { return null; }
  };

  sy.init = () => {
    if (!cfg()) return;
    F.kvSet('sync', { id: cfg().id }).catch(() => {});
    sy.now();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sy.now(); });
    window.addEventListener('online', () => sy.now());
    setInterval(() => { if (document.visibilityState === 'visible') sy.now(); }, 120000);
  };
})();
