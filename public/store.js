/* Forge21 — state, persistence (localStorage + IndexedDB), photo handling */
(function () {
  const F = window.F;
  const KEY = 'forge21.v1';

  F.defaults = () => ({
    v: 1,
    onboarded: false,
    profile: {
      name: '', heightCm: 172, age: 28, sex: 'm',
      startWeight: 90, targetWeight: 75, startDate: F.dk(), // neutral placeholders; real numbers are entered at onboarding
      mode: 'hyd', wake: '05:45', bed: '22:15', twoLong: false,
      pgPlan: { 0: 'chicken', 1: 'self', 2: 'egg', 3: 'chicken', 4: 'self', 5: 'egg', 6: 'self' }
    },
    notif: { on: false },
    dayMeta: {}, done: {}, steps: {}, water: {}, weights: {},
    measures: [], meals: {}, photos: [], tasks: [], goals: [],
    commit: { wcVisit: null, wcInterval: 12, wcPost: null, wcEvery: 3, wcName: 'Venue shoot' },
    _m: {}, _t: {} // sync: per-key modified times, deleted-item tombstones
  });

  const merge = (base, over) => {
    if (over === null || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
    const out = Object.assign({}, base);
    for (const k of Object.keys(over)) out[k] = k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  };

  F.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      F.state = raw ? merge(F.defaults(), JSON.parse(raw)) : F.defaults();
    } catch (e) { F.state = F.defaults(); }
    F.state = F.sanitize(F.state); // never trust stored data blindly
    F.snapHash();
    return F.state;
  };
  // remember a fingerprint of every synced key so we can stamp only the ones that really changed
  F.snapHash = () => { F._h = {}; F.SYNC_KEYS.forEach((k) => { F._h[k] = JSON.stringify(F.state[k]); }); };
  F.tomb = (id) => { F.state._t[id] = Date.now(); };
  let timer = 0;
  F.save = () => {
    clearTimeout(timer);
    timer = setTimeout(F.saveNow, 120);
  };
  F.saveNow = () => {
    const st = F.state;
    st._m = st._m || {}; st._t = st._t || {};
    F.SYNC_KEYS.forEach((k) => {
      const h = JSON.stringify(st[k]);
      if (F._h[k] !== h) { st._m[k] = Date.now(); F._h[k] = h; }
    });
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage full or blocked */ }
    if (F.onSaved) F.onSaved();
  };

  /* ---------- IndexedDB ---------- */
  const open = () => F._db ? Promise.resolve(F._db) : new Promise((res, rej) => {
    const r = indexedDB.open('forge21', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('blobs', { keyPath: 'id' });
      d.createObjectStore('kv');
      d.createObjectStore('pending', { autoIncrement: true });
    };
    r.onsuccess = () => { F._db = r.result; res(r.result); };
    r.onerror = () => rej(r.error);
  });
  const run = (store, mode, fn) => open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  }));
  F.kvGet = (k) => run('kv', 'readonly', (s) => s.get(k));
  F.kvSet = (k, v) => run('kv', 'readwrite', (s) => s.put(v, k));
  F.blobPut = (rec) => run('blobs', 'readwrite', (s) => s.put(rec));
  F.blobGet = (id) => run('blobs', 'readonly', (s) => s.get(id));
  F.blobDel = (id) => run('blobs', 'readwrite', (s) => s.delete(id));

  const urls = {};
  F.photoURL = async (id) => {
    if (urls[id]) return urls[id];
    let rec = await F.blobGet(id);
    if (!rec && F.fetchRemoteBlob) { // photo taken on another device
      const blob = await F.fetchRemoteBlob(id);
      if (blob) { rec = { id, blob }; await F.blobPut(rec); }
    }
    if (!rec) return '';
    return (urls[id] = URL.createObjectURL(rec.blob));
  };
  F.dropURL = (id) => { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } };

  // actions tapped on notifications while the app was closed
  F.mergePending = async () => {
    const db = await open();
    const items = await new Promise((res) => {
      const t = db.transaction('pending', 'readwrite');
      const s = t.objectStore('pending');
      const r = s.getAll();
      t.oncomplete = () => res(r.result || []);
      s.clear();
    });
    const st = F.state;
    items.forEach((a) => {
      if (String(a.id).startsWith('task:')) {
        const t = st.tasks.find((x) => 'task:' + x.id === a.id);
        if (t && a.status === 'done') t.done = true;
        return;
      }
      st.done[a.date] = st.done[a.date] || {};
      st.done[a.date][a.id] = a.status;
    });
    if (items.length) F.save();
    return items.length;
  };

  /* ---------- images ---------- */
  F.compress = (file, max = 1280, q = 0.82) => new Promise((res) => {
    if (!file.type.startsWith('image/')) return res(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); res(b || file); }, 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });

  F.addPhoto = async (file, meta) => {
    const blob = await F.compress(file);
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await F.blobPut({ id, blob });
    const rec = Object.assign({ id, time: Date.now(), type: blob.type, name: file.name || '' }, meta);
    F.state.photos.push(rec);
    F.save();
    if (F.sync) F.sync.uploadBlob(id);
    return rec;
  };
  F.removePhoto = async (id) => {
    F.state.photos = F.state.photos.filter((p) => p.id !== id);
    Object.values(F.state.meals).forEach((day) => Object.keys(day).forEach((s) => { if (day[s] && day[s].photoId === id) day[s] = null; }));
    F.tomb(id);
    F.dropURL(id);
    await F.blobDel(id);
    F.save();
  };

  /* ---------- backup ---------- */
  F.exportAll = async () => {
    const blobs = {};
    for (const p of F.state.photos) {
      const rec = await F.blobGet(p.id);
      if (!rec) continue;
      blobs[p.id] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(rec.blob); });
    }
    return JSON.stringify({ app: 'forge21', exported: new Date().toISOString(), state: F.state, blobs });
  };
  F.importAll = async (text) => {
    const d = JSON.parse(text);
    if (d.app !== 'forge21') throw new Error('Not a Forge21 backup');
    F.state = F.sanitize(merge(F.defaults(), d.state));
    const known = new Set(F.state.photos.map((p) => p.id));
    for (const id of Object.keys(d.blobs || {})) {
      if (!known.has(id) || typeof d.blobs[id] !== 'string' || !/^data:(image\/[a-z]+|application\/pdf);base64,/.test(d.blobs[id])) continue;
      const blob = await (await fetch(d.blobs[id])).blob();
      await F.blobPut({ id, blob });
    }
    F.saveNow();
  };
})();
