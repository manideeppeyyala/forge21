/* Forge21 state merge + validation: used by the browser AND the Vercel functions in /api (same file, so both sides agree).
   Each synced top-level key carries a modified-time in state._m. Map-like keys (done, steps, weights, ...)
   are unioned entry by entry; when the same entry exists on both sides, the side with the newer key time wins.
   Deleted list items are remembered in state._t (tombstones) so they cannot come back.
   sanitize() is a strict whitelist: anything unexpected (wrong types, odd keys, __proto__, huge strings) is dropped,
   so corrupt or hostile data can never break the app or inject markup. */
(function (root) {
  const KEYS = ['onboarded', 'profile', 'dayMeta', 'done', 'steps', 'water', 'weights', 'measures', 'meals', 'photos', 'tasks', 'goals', 'commit'];
  const LISTS = { measures: 'date', photos: 'id', tasks: 'id', goals: 'id' };
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const bad = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
  const keysOf = (o) => (isObj(o) ? Object.keys(o).filter((k) => !bad(k)) : []);

  /* ---------- validation ---------- */
  const DATE = /^\d{4}-\d{2}-\d{2}$/, HM = /^([01]\d|2[0-3]):[0-5]\d$/, ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, DID = /^[A-Za-z0-9][\w:-]{0,39}$/;
  const copy = (o) => { const c = {}; keysOf(o).forEach((k) => { c[k] = o[k]; }); return c; }; // own, safe keys only (never sets a prototype)
  const SLOTS = ['pre', 'post', 'bfast', 'lunch', 'snack', 'dinner'], DONE = ['done', 'skip', ''], KINDS = ['meal', 'progress', 'report'];
  const MTYPE = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;
  const MKEYS = ['chest', 'belly', 'waist', 'hips', 'thigh', 'arm', 'neck', 'calf'];
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v, lo, hi, d) => {
    if (typeof v === 'string' && v.trim() === '') return d;
    const x = Number(v);
    return typeof v !== 'boolean' && v !== null && Number.isFinite(x) && x >= lo && x <= hi ? x : d;
  };
  const dateMap = (m, leaf) => {
    const o = {};
    keysOf(m).forEach((k) => { if (!DATE.test(k)) return; const v = leaf(m[k]); if (v !== undefined) o[k] = v; });
    return o;
  };
  const nowDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function sanitize(s) {
    s = isObj(s) ? s : {};
    const o = copy(s);
    if ('onboarded' in s) o.onboarded = s.onboarded === true;
    if ('profile' in s) {
      const p = isObj(s.profile) ? s.profile : {};
      const plan = isObj(p.pgPlan) ? p.pgPlan : {};
      const pg = {};
      for (let d = 0; d < 7; d++) pg[d] = ['egg', 'chicken', 'self'].includes(plan[d]) ? plan[d] : 'self';
      o.profile = {
        name: str(p.name, 60), heightCm: num(p.heightCm, 100, 250, 172), age: num(p.age, 10, 100, 28), sex: p.sex === 'f' ? 'f' : 'm',
        startWeight: num(p.startWeight, 30, 300, 90), targetWeight: num(p.targetWeight, 30, 300, 75),
        startDate: DATE.test(p.startDate) ? p.startDate : nowDate(), mode: p.mode === 'home' ? 'home' : 'hyd',
        wake: HM.test(p.wake) ? p.wake : '05:45', bed: HM.test(p.bed) ? p.bed : '22:15', twoLong: p.twoLong === true, pgPlan: pg
      };
    }
    if ('dayMeta' in s) o.dayMeta = dateMap(s.dayMeta, (v) => {
      if (!isObj(v)) return undefined;
      const x = {};
      if (v.mode === 'home' || v.mode === 'hyd') x.mode = v.mode;
      if (typeof v.office === 'boolean') x.office = v.office;
      if (typeof v.travel === 'boolean') x.travel = v.travel;
      return x;
    });
    if ('done' in s) o.done = dateMap(s.done, (v) => {
      if (!isObj(v)) return undefined;
      const x = {};
      keysOf(v).forEach((id) => { if (DID.test(id) && DONE.includes(v[id])) x[id] = v[id]; });
      return x;
    });
    if ('steps' in s) o.steps = dateMap(s.steps, (v) => num(v, 0, 200000, undefined));
    if ('water' in s) o.water = dateMap(s.water, (v) => num(v, 0, 20000, undefined));
    if ('weights' in s) o.weights = dateMap(s.weights, (v) => num(v, 20, 400, undefined));
    if ('meals' in s) o.meals = dateMap(s.meals, (v) => {
      if (!isObj(v)) return undefined;
      const x = {};
      keysOf(v).forEach((sl) => {
        if (!SLOTS.includes(sl)) return;
        const e = v[sl];
        if (e === null) x[sl] = null;
        else if (isObj(e) && typeof e.photoId === 'string' && ID.test(e.photoId)) x[sl] = { photoId: e.photoId, note: str(e.note, 200), time: num(e.time, 0, 9e15, 0) };
      });
      return x;
    });
    const arr = (a) => (Array.isArray(a) ? a.filter(isObj).slice(0, 5000) : []);
    if ('measures' in s) o.measures = arr(s.measures).filter((m) => typeof m.date === 'string' && DATE.test(m.date)).map((m) => {
      const x = { date: m.date };
      MKEYS.forEach((k) => { const v = num(m[k], 10, 300, undefined); if (v !== undefined) x[k] = v; });
      return x;
    });
    if ('photos' in s) o.photos = arr(s.photos).filter((p) => typeof p.id === 'string' && ID.test(p.id) && typeof p.date === 'string' && DATE.test(p.date)).map((p) => {
      const x = { id: p.id, time: num(p.time, 0, 9e15, 0), type: MTYPE.test(p.type) ? p.type : 'image/jpeg', name: str(p.name, 100), kind: KINDS.includes(p.kind) ? p.kind : 'meal', date: p.date, note: str(p.note, 200) };
      if (SLOTS.includes(p.slot)) x.slot = p.slot;
      return x;
    });
    if ('tasks' in s) o.tasks = arr(s.tasks).filter((t) => typeof t.id === 'string' && ID.test(t.id) && typeof t.date === 'string' && DATE.test(t.date)).map((t) => ({
      id: t.id, title: str(t.title, 200), date: t.date, time: typeof t.time === 'string' && HM.test(t.time) ? t.time : '', notify: t.notify === true, done: t.done === true
    }));
    if ('goals' in s) o.goals = arr(s.goals).filter((g) => typeof g.id === 'string' && ID.test(g.id)).map((g) => ({
      id: g.id, title: str(g.title, 120), target: num(g.target, 0, 1e9, 1), current: num(g.current, 0, 1e9, 0), unit: str(g.unit, 20), due: typeof g.due === 'string' && DATE.test(g.due) ? g.due : ''
    }));
    if ('commit' in s) {
      const c = isObj(s.commit) ? s.commit : {};
      o.commit = {
        wcVisit: typeof c.wcVisit === 'string' && DATE.test(c.wcVisit) ? c.wcVisit : null, wcPost: typeof c.wcPost === 'string' && DATE.test(c.wcPost) ? c.wcPost : null,
        wcInterval: Math.round(num(c.wcInterval, 1, 365, 12)), wcEvery: Math.round(num(c.wcEvery, 1, 365, 3)), wcName: str(c.wcName, 40).trim() || 'Venue shoot'
      };
    }
    if ('_m' in s) { const m = {}; KEYS.forEach((k) => { const v = num(isObj(s._m) ? s._m[k] : 0, 0, 9e15, 0); if (v) m[k] = v; }); o._m = m; }
    if ('_t' in s) { const t = {}; keysOf(s._t).forEach((k) => { if (ID.test(k)) { const v = num(s._t[k], 0, 9e15, 0); if (v) t[k] = v; } }); o._t = t; }
    return o;
  }

  /* ---------- merge ---------- */
  function union(lo, win) { // win overrides lo on conflicting leaves
    if (isObj(lo) && isObj(win)) {
      const o = copy(lo);
      for (const k of keysOf(win)) o[k] = k in lo ? union(lo[k], win[k]) : win[k];
      return o;
    }
    return win === undefined ? lo : win;
  }
  function unionList(lo, win, idKey) {
    const m = new Map();
    (Array.isArray(lo) ? lo : []).forEach((x) => { if (isObj(x)) m.set(x[idKey], x); });
    (Array.isArray(win) ? win : []).forEach((x) => { if (isObj(x)) m.set(x[idKey], x); });
    return Array.from(m.values());
  }

  // ties go to b (the "incoming" side). The result is always sanitized.
  function mergeStates(a, b) {
    a = isObj(a) ? a : {}; b = isObj(b) ? b : {};
    const ma = isObj(a._m) ? a._m : {}, mb = isObj(b._m) ? b._m : {};
    const t = {};
    keysOf(a._t).forEach((k) => { t[k] = Number(a._t[k]) || 0; });
    keysOf(b._t).forEach((k) => { t[k] = Math.max(t[k] || 0, Number(b._t[k]) || 0); });
    const out = { v: 1, _m: {}, _t: t };
    for (const k of KEYS) {
      const aWins = (Number(ma[k]) || 0) > (Number(mb[k]) || 0);
      const win = aWins ? a : b, lo = aWins ? b : a;
      let v;
      if (LISTS[k]) {
        v = unionList(lo[k], win[k], LISTS[k]);
        if (k !== 'measures') v = v.filter((x) => !t[x.id]);
        if (k === 'measures') v = v.filter((x) => typeof x.date === 'string').sort((x, y) => x.date.localeCompare(y.date));
      } else if (k in lo && k in win) v = union(lo[k], win[k]);
      else v = k in win ? win[k] : lo[k];
      if (v !== undefined) out[k] = v;
      out._m[k] = Math.max(Number(ma[k]) || 0, Number(mb[k]) || 0);
    }
    return sanitize(out);
  }

  const api = { SYNC_KEYS: KEYS, mergeStates, sanitize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.F = root.F || {}; root.F.SYNC_KEYS = KEYS; root.F.syncMerge = mergeStates; root.F.sanitize = sanitize; }
})(typeof window !== 'undefined' ? window : globalThis);
