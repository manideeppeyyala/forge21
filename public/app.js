/* Forge21 — UI */
(function () {
  const F = window.F;
  F.load();
  const S = () => F.state;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kg = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const inr = (n) => Number(n).toLocaleString('en-IN');
  const today = () => F.dk();

  /* ---------- icons ---------- */
  const I = {
    today: '<path d="M4 13l5 5L20 6"/><circle cx="12" cy="12" r="10" opacity=".35"/>',
    plan: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    fuel: '<path d="M7 3v8a3 3 0 006 0V3M10 3v18M18 3c-2 2-3 5-3 8h3v10"/>',
    track: '<path d="M3 17l5-6 4 4 8-10"/><path d="M15 5h5v5"/>',
    tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L6.8 5M3.5 12l1.2 1.2L6.8 11M3.5 18l1.2 1.2L6.8 17"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    cam: '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>'
  };
  const svg = (n, cls) => `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${I[n]}</svg>`;
  const TABS = [['today', 'Today'], ['plan', 'Plan'], ['fuel', 'Fuel'], ['track', 'Track'], ['tasks', 'Tasks']];
  const CATC = { move: 'var(--c-move)', food: 'var(--c-food)', content: 'var(--c-content)', work: 'var(--c-work)', sleep: 'var(--c-sleep)', rest: 'var(--c-rest)', life: 'var(--c-life)' };

  /* ---------- state helpers ---------- */
  let cur = 'today', selDay = today(), seg = 'weight', animate = true, justId = null;
  const openBlocks = new Set();
  const ringPrev = {};

  const sortedWeights = () => Object.keys(S().weights).sort().map((k) => [k, S().weights[k]]);
  const lastWeight = () => { const w = sortedWeights(); return w.length ? w[w.length - 1][1] : S().profile.startWeight; };
  const weeklyRate = () => { // kg per week (negative = losing), from last 14 days
    const w = sortedWeights().filter(([k]) => F.diffDays(k, today()) <= 14);
    if (w.length < 3) return null;
    const x0 = F.parse(w[0][0]).getTime();
    const pts = w.map(([k, v]) => [(F.parse(k).getTime() - x0) / 864e5, v]);
    const span = pts[pts.length - 1][0];
    if (span < 5) return null;
    const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
    const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return slope * 7;
  };
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const prettyDate = (k) => { const d = F.parse(k); return `${F.DAYS_LONG[d.getDay()]}, ${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`; };
  const shortDate = (k) => { const d = F.parse(k); return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`; };

  /* ---------- UI primitives ---------- */
  function toast(msg, ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, ms);
  }
  function confetti() {
    const cols = ['#d4ff3f', '#ffb84d', '#ff6b8b', '#5eead4', '#8e9bff'];
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('i');
      c.className = 'cf';
      c.style.left = 50 + (Math.random() - .5) * 30 + 'vw'; c.style.top = '42vh';
      c.style.background = cols[i % cols.length];
      c.style.setProperty('--dx', (Math.random() - .5) * 90 + 'vw'); c.style.setProperty('--dy', (Math.random() * 50 - 5) + 'vh');
      c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(c); setTimeout(() => c.remove(), 1400);
    }
  }
  function ring(id, pct, mid, sub, sm) {
    const r = 52, C = 2 * Math.PI * r, prev = ringPrev[id] || 0;
    ringPrev[id] = Math.min(100, pct);
    return `<div class="ring ${sm ? 'sm' : ''}"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="${r}"/><circle class="fg" cx="60" cy="60" r="${r}" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - prev / 100)}" data-to="${C * (1 - Math.min(100, pct) / 100)}"/></svg><div class="mid"><b>${mid}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
  }
  function openSheet(html, mount) {
    closeSheet(true);
    const root = $('#sheet-root');
    root.innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
    document.body.style.overflow = 'hidden';
    if (mount) mount($('.sheet', root));
    hydrate(root);
  }
  function closeSheet(instant) {
    const root = $('#sheet-root');
    const sh = $('.sheet', root);
    document.body.style.overflow = '';
    if (!sh) return;
    if (instant) { root.innerHTML = ''; return; }
    sh.classList.add('closing');
    setTimeout(() => { root.innerHTML = ''; }, 240);
  }
  function hydrate(root = document) {
    $$('img[data-pid]', root).forEach((img) => {
      if (img.getAttribute('src')) return;
      F.photoURL(img.dataset.pid).then((u) => { if (u) img.src = u; });
    });
  }
  function paintRings() {
    $$('.ring .fg').forEach((c) => requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.to; })));
    $$('.bar > i[data-w]').forEach((i) => requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = i.dataset.w + '%'; })));
  }
  const bar = (pct, cls) => `<div class="bar ${cls || ''}"><i style="width:0" data-w="${Math.max(0, Math.min(100, pct))}"></i></div>`;

  /* ---------- coach ---------- */
  function analyse() {
    const st = S(), t = today(), tips = [];
    const days = [];
    for (let i = 1; i <= 7; i++) { const d = F.addDays(t, -i); if (F.diffDays(st.profile.startDate, d) >= 0) days.push(d); }
    const cats = { move: [0, 0], food: [0, 0], content: [0, 0], sleep: [0, 0] };
    let pctSum = 0;
    days.forEach((d) => {
      const bl = F.buildDay(d, st);
      pctSum += F.dayProgress(d, st, bl).pct;
      bl.filter((b) => !b.info && cats[b.cat]).forEach((b) => { cats[b.cat][1]++; if (F.status(d, b, st) === 'done') cats[b.cat][0]++; });
    });
    const avg = days.length ? Math.round(pctSum / days.length) : null;
    const catPct = {}; Object.keys(cats).forEach((c) => { catPct[c] = cats[c][1] ? Math.round((cats[c][0] / cats[c][1]) * 100) : null; });
    const stepsArr = days.map((d) => st.steps[d] || 0).filter((x) => x > 0);
    const avgSteps = stepsArr.length ? Math.round(stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length) : null;
    const wCount = days.filter((d) => st.weights[d]).length;
    const rate = weeklyRate();
    const w = lastWeight();
    if (days.length >= 2) {
      if (catPct.move !== null && catPct.move < 65) tips.push({ t: 'warn', text: `Movement is at ${catPct.move}% this week. Lock the gym slot first. Everything else bends around it.` });
      if (avgSteps !== null && avgSteps < 8500) tips.push({ t: 'warn', text: `Steps average ${inr(avgSteps)} against a 10K goal. Add a 15-minute walk right after lunch.` });
      if (catPct.content !== null && catPct.content < 60) tips.push({ t: 'warn', text: 'Content is slipping. Batch it: shoot 3 reels on the weekend, then weekdays are only edit and post.' });
      if (catPct.sleep !== null && catPct.sleep < 60) tips.push({ t: 'warn', text: 'Lights-out is being missed. Under 7 h of sleep raises hunger and slows fat loss. Protect it.' });
      if (catPct.food !== null && catPct.food < 70) tips.push({ t: 'warn', text: 'Meals are under-logged. Photo each one. What gets logged gets eaten properly.' });
      if (wCount < 5) tips.push({ t: 'info', text: `Only ${wCount}/${days.length} weigh-ins this week. Daily weights give a trend you can trust.` });
    }
    if (rate !== null) {
      const pctw = Math.abs(rate) / w * 100;
      if (rate > 0.1) tips.push({ t: 'warn', text: `Weight is trending up ${kg(rate)} kg/week. Check portions on self-managed days and hit the step goal.` });
      else if (pctw > 1.2) tips.push({ t: 'warn', text: `You are losing ${kg(-rate)} kg/week, which is fast. Add 150–200 kcal around training to protect muscle.` });
      else if (pctw < 0.25) tips.push({ t: 'info', text: 'Weight is flat. Trim about 150 kcal or add 2,000 steps for a week, then reassess.' });
      else tips.push({ t: 'good', text: `Losing ${kg(-rate)} kg/week. That is the recomposition sweet spot: fat down, muscle kept.` });
    }
    const streak = F.reelStreak(t, st);
    if (streak >= 3) tips.push({ t: 'good', text: `${streak}-day reel streak. Keep the chain alive.` });
    const lm = st.measures.length ? st.measures[st.measures.length - 1].date : null;
    if (!lm || F.diffDays(lm, t) >= 28) tips.push({ t: 'info', text: lm ? 'Monthly body measurements are due. Track → Body.' : 'Record your starting body measurements. Track → Body.' });
    if (!tips.length) tips.push({ t: 'info', text: 'Complete a few days and the coach will start spotting patterns for you.' });
    return { avg, catPct, avgSteps, rate, tips, streak, wCount, days };
  }
  const tipHTML = (x) => `<div class="tip ${x.t === 'warn' ? 'warn' : x.t === 'good' ? 'good' : ''}"><span>${x.t === 'warn' ? '⚠️' : x.t === 'good' ? '🔥' : '💡'}</span><span>${esc(x.text)}</span></div>`;

  /* ---------- status changes ---------- */
  function setStatus(key, id, status, cat) {
    const st = S();
    const d = (st.done[key] = st.done[key] || {});
    const before = F.dayProgress(key, st).pct;
    // undo stores '' / null instead of deleting, so the undo also syncs to other devices
    if (status) d[id] = status; else {
      d[id] = '';
      if (id.startsWith('meal-') && st.meals[key] && st.meals[key][id.slice(5)]) st.meals[key][id.slice(5)] = null;
    }
    justId = status === 'done' ? key + id : null;
    F.save(); render();
    if (status === 'done') {
      toast(F.praise(cat));
      const after = F.dayProgress(key, st).pct;
      if (after === 100 && before < 100) { confetti(); setTimeout(() => toast('Perfect day. Every box ticked 🏆', 3200), 500); }
    }
  }

  /* ---------- views ---------- */
  function topbar(title, sub, extra) {
    return `<div class="top" style="--i:0"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="row">${extra || ''}<button class="ico-btn" data-act="settings" aria-label="Settings">${svg('gear')}</button></div></div>`;
  }
  function dayCtl(key, global) {
    const st = S(), mode = F.modeFor(key, st), wk = F.isWeekend(key);
    let h = `<div class="seg" style="margin-bottom:10px"><button class="${mode === 'home' ? 'on' : ''}" data-act="${global ? 'mode' : 'daymode'}" data-key="${key}" data-v="home">🏠 Home</button><button class="${mode === 'hyd' ? 'on' : ''}" data-act="${global ? 'mode' : 'daymode'}" data-key="${key}" data-v="hyd">📍 Hyderabad</button></div>`;
    if (!wk && mode === 'hyd') {
      const o = F.isOffice(key, st);
      h += `<div class="seg" style="margin-bottom:12px"><button class="${!o ? 'on' : ''}" data-act="office" data-key="${key}" data-v="0">Work from PG</button><button class="${o ? 'on' : ''}" data-act="office" data-key="${key}" data-v="1">Office day</button></div>`;
    }
    if (wk) {
      const tr = F.isTravel(key, st);
      h += `<div class="seg" style="margin-bottom:12px"><button class="${!tr ? 'on' : ''}" data-act="travel" data-key="${key}" data-v="0">Stay local</button><button class="${tr ? 'on' : ''}" data-act="travel" data-key="${key}" data-v="1">Travel day · 25K steps</button></div>`;
    }
    return h;
  }

  function blockHTML(key, b, nowMin, isToday) {
    const st = S();
    const s = F.status(key, b, st);
    const now = isToday && !b.info && !s && nowMin >= b.s && nowMin < b.s + Math.max(b.dur, 20);
    const [h, ap] = F.fmt12(b.t).split(' ');
    const open = openBlocks.has(key + b.id);
    const cc = CATC[b.cat];
    const ml = st.meals[key] && b.meal ? st.meals[key][b.meal] : null;
    let detail = '';
    if (b.workout) {
      const wo = F.WORKOUTS[F.dow(key)];
      detail = `<ul class="exlist">${wo.ex.map((e) => `<li><span>${esc(e[0])}${e[2] ? `<small>${esc(e[2])}</small>` : ''}</span><b>${esc(e[1])}</b></li>`).join('')}</ul>`;
    } else if (b.meal) {
      const m = F.mealFor(key, b.meal, st);
      detail = `<ul class="exlist">${m.items.map((i) => `<li><span>${esc(i)}</span></li>`).join('')}</ul>${m.note ? `<p>${esc(m.note)}</p>` : ''}<p>≈ ${m.kcal} kcal · ${m.p} g protein · ${m.f} g fibre</p>`;
    }
    const acts = !b.info && !(b.auto && b.target) ? `<div class="row" style="margin-top:10px;gap:8px">${s === 'done' ? '' : `<button class="btn pri sm" data-act="tick" data-key="${key}" data-id="${b.id}">Done</button>`}${s === 'skip' ? '' : `<button class="btn sm" data-act="skip" data-key="${key}" data-id="${b.id}">Skip</button>`}${s ? `<button class="btn out sm" data-act="undo" data-key="${key}" data-id="${b.id}">Undo</button>` : ''}</div>` : '';
    const tags = [];
    if (b.meal) tags.push(`<span class="tag">${b.kcal} kcal · ${b.p} g P</span>`);
    if (b.src) tags.push(`<span class="tag c" style="--cc:var(--c-food)">${esc(b.src)}</span>`);
    if (b.flex) tags.push('<span class="tag">flex: use any free gap</span>');
    if (b.dur) tags.push(`<span class="tag">${b.dur >= 60 ? (b.dur / 60).toFixed(b.dur % 60 ? 2 : 0).replace(/\.?0+$/, '') + ' h' : b.dur + ' min'}</span>`);
    const cam = b.meal ? `<button class="cam" data-act="cam" data-key="${key}" data-id="${b.id}">${svg('cam')}${ml ? 'Retake' : 'Add photo'}</button>` : '';
    return `<div class="blk ${b.info ? 'info' : ''} ${s || ''} ${now ? 'now' : ''} ${b.auto && b.target ? 'target' : ''} ${justId === key + b.id ? 'just' : ''}">
      <div class="tm">${h}<small>${ap}</small></div>
      <div class="bx" style="--cc:${cc}" data-act="${b.auto ? 'auto' : 'open'}" data-key="${key}" data-id="${b.id}" data-auto="${b.auto || ''}">
        <h4><span class="t">${esc(b.title)}</span></h4>
        ${b.sub && !b.meal ? `<p>${esc(b.sub)}</p>` : ''}
        ${b.meal ? `<p>${esc(F.mealFor(key, b.meal, st).items.slice(0, 2).join(' · '))}</p>` : ''}
        ${!b.info && !(b.auto && b.target) ? `<div class="meta">${tags.join('')}${cam}</div>` : ''}
        ${ml && ml.photoId ? `<div class="row" style="margin-top:8px"><img class="thumb" data-pid="${ml.photoId}" alt="Meal photo"><span class="mu" style="font-size:12px">Logged ${new Date(ml.time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></div>` : ''}
        ${detail || acts ? `<div class="exp ${open ? 'open' : ''}">${detail}${acts}</div>` : ''}
      </div>
      ${b.info ? '<span></span>' : `<button class="chk" data-act="${b.auto && b.target ? 'auto' : 'tick'}" data-key="${key}" data-id="${b.id}" data-auto="${b.auto || ''}" aria-label="Toggle ${esc(b.title)}">${s === 'skip' ? svg('x') : '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'}</button>`}
    </div>`;
  }
  const timeline = (key) => {
    const bl = F.buildDay(key, S()); const d = new Date(); const nm = d.getHours() * 60 + d.getMinutes();
    return `<div class="tl">${bl.map((b) => blockHTML(key, b, nm, key === today())).join('')}</div>`;
  };

  function nextUp(key, blocks) {
    const st = S(); const d = new Date(); const nm = d.getHours() * 60 + d.getMinutes();
    const open = blocks.filter((b) => !b.info && !(b.auto && b.target) && !F.status(key, b, st));
    let b = open.find((x) => x.s + Math.max(x.dur, 15) > nm);
    const overdue = open.filter((x) => x.s + Math.max(x.dur, 15) + 30 < nm && x !== b).length;
    if (!b) {
      if (!open.length) return `<div class="next" style="--i:2"><div class="lbl">All clear</div><h3>Day is done. Rest up 🌙</h3><p>Everything is ticked or skipped. Sleep is part of the plan.</p></div>`;
      b = open[0];
    }
    const ml = b.meal;
    return `<div class="next" style="--i:2"><div class="lbl">${b.s <= nm ? 'Right now' : 'Up next · ' + F.fmt12(b.t)}</div><h3>${b.emoji ? b.emoji + ' ' : ''}${esc(b.title)}</h3><p>${esc(b.meal ? F.mealFor(key, b.meal, st).items.slice(0, 2).join(' · ') : b.sub)}${overdue ? ` · <b>${overdue} earlier item${overdue > 1 ? 's' : ''} still open</b>` : ''}</p>
      <div class="row" style="gap:8px"><button class="btn" data-act="tick" data-key="${key}" data-id="${b.id}">${ml ? 'Ate it' : 'Done'}</button>${ml ? `<button class="btn ghost" data-act="cam" data-key="${key}" data-id="${b.id}">${svg('cam')}Photo</button>` : ''}<button class="btn ghost" data-act="skip" data-key="${key}" data-id="${b.id}">Skip</button></div></div>`;
  }

  function viewToday() {
    const st = S(), key = today(), blocks = F.buildDay(key, st), pr = F.dayProgress(key, st, blocks);
    const dn = F.dayNumber(st, key), p = st.profile;
    const w = lastWeight(), lost = p.startWeight - w, toGo = w - p.targetWeight;
    const tg = F.targets(st);
    const steps = st.steps[key] || 0, goal = F.stepGoal(key, st), water = st.water[key] || 0;
    const A = analyse();
    const lw = st.weights[key];
    const name = p.name ? ', ' + esc(p.name.split(' ')[0]) : '';
    const msg = pr.pct === 100 ? 'Perfect day. Nothing left to prove.' : pr.pct >= 60 ? 'Strong day. Finish what is left.' : pr.pct > 0 ? 'Momentum is building. Keep ticking.' : 'Fresh day, clean slate. Start with the first tick.';
    const cycle = dn > 21 ? `Reset done · day ${dn}` : `Day ${dn} of 21`;
    return `${topbar(greeting() + name, prettyDate(key) + ` · <span class="chip ac" style="padding:2px 9px">${cycle}</span>`)}
      <div style="--i:1">${dayCtl(key, true)}</div>
      <div class="hero" style="--i:2">${ring('day', pr.pct, pr.pct + '%', 'today')}<div><h2>${pr.done} of ${pr.total} done</h2><p>${msg}</p><div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip">🔥 ${A.streak}d reels</span><span class="chip">🎬 ${F.longVideosThisWeek(key, st)}/${p.twoLong ? 2 : 1} long</span></div></div></div>
      ${nextUp(key, blocks)}
      <div class="stats" style="--i:3">
        <div class="stat tap" data-act="weight"><span>Weight</span><b>${lw ? kg(lw) : kg(w)}<small style="font-size:12px;font-weight:500"> kg</small></b><span class="${lost > 0 ? 'up' : ''}">${lost > 0 ? '−' + kg(lost) + ' kg' : lost < 0 ? '+' + kg(-lost) + ' kg' : 'start'} · ${lw ? 'logged' : 'tap to log'}</span></div>
        <div class="stat tap" data-act="steps"><span>Steps</span><b>${inr(steps)}</b>${bar(steps / goal * 100)}</div>
        <div class="stat tap" data-act="water"><span>Water</span><b>${(water / 1000).toFixed(2).replace(/\.?0+$/, '')}<small style="font-size:12px;font-weight:500"> L</small></b>${bar(water / 3500 * 100)}</div>
      </div>
      <div class="card" style="--i:4"><h3>Coach <small>${A.avg !== null ? `7-day avg ${A.avg}%` : 'warming up'}</small></h3>${A.tips.slice(0, 2).map(tipHTML).join('')}</div>
      <div class="card" style="--i:5"><h3>${cycleCard(dn, toGo, w)}</h3></div>
      <div style="--i:6"><div class="top" style="margin:18px 0 4px"><h1 style="font-size:20px">Today's plan</h1><span class="mu" style="font-size:12px">tap a card for details</span></div>${timeline(key)}</div>`;
  }
  function cycleCard(dn, toGo, w) {
    const p = S().profile, r = weeklyRate();
    const prog = Math.max(0, Math.min(100, ((p.startWeight - w) / (p.startWeight - p.targetWeight)) * 100));
    let proj = 'Log a week of weights to see your projected date.';
    const rate = r !== null && r < -0.1 ? -r : null;
    if (rate) { const wk = toGo / rate; const d = new Date(Date.now() + wk * 7 * 864e5); proj = `At ${kg(rate)} kg/week you reach ${p.targetWeight} kg around ${d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}.`; }
    else if (toGo > 0) proj = `${kg(toGo)} kg to go. A healthy pace is about 0.7–1 kg/week, so ${p.targetWeight} kg is a ~${Math.round(toGo / 0.85)}-week journey. The 21 days are the launch.`;
    return `<div style="width:100%"><div class="row" style="justify-content:space-between"><span>${dn > 21 ? 'Beyond the reset' : '21-day reset'}</span><small class="mu" style="font-family:var(--f-b);font-weight:500;font-size:12px">${p.startWeight} → ${p.targetWeight} kg</small></div><div style="margin:10px 0">${bar(dn > 21 ? 100 : dn / 21 * 100)}</div><div class="mu" style="font-size:12.5px;font-weight:500;font-family:var(--f-b)">${dn > 21 ? 'The 21 days are done. Keep the machine running.' : `${21 - dn} days left in this reset.`}</div><div style="margin:12px 0 6px">${bar(prog)}</div><div class="mu" style="font-size:12.5px;font-weight:500;font-family:var(--f-b)">${esc(proj)}</div></div>`;
  }

  /* ----- Plan ----- */
  function viewPlan() {
    const st = S(), key = selDay, ws = F.weekStart(key), t = today();
    const strip = Array.from({ length: 7 }, (_, i) => {
      const d = F.addDays(ws, i), pr = F.dayProgress(d, st);
      return `<button class="dy ${d === key ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="day" data-key="${d}"><small>${F.DAYS[F.dow(d)]}</small><b>${F.parse(d).getDate()}</b><i class="${pr.pct >= 80 ? 'f' : ''}"></i></button>`;
    }).join('');
    const wo = F.WORKOUTS[F.dow(key)], mac = F.dayMacros(key, st), tg = F.targets(st);
    const wc = F.witchDue(key, st), c = st.commit;
    const lv = F.longVideosThisWeek(key, st);
    return `${topbar('Plan', prettyDate(key))}
      <div class="row" style="margin-bottom:10px;--i:1"><button class="ico-btn" data-act="weekshift" data-n="-7" aria-label="Previous week">‹</button><div class="sp"></div><span class="mu" style="font-size:13px;font-weight:600">${shortDate(ws)} – ${shortDate(F.addDays(ws, 6))}</span><div class="sp"></div><button class="ico-btn" data-act="weekshift" data-n="7" aria-label="Next week">›</button></div>
      <div class="days" style="--i:1">${strip}</div>
      <div style="--i:2">${dayCtl(key, false)}</div>
      <div class="card" style="--i:3"><h3>${F.DAYS_LONG[F.dow(key)]} at a glance</h3><div class="grid2"><div><div class="lbl">Training</div><b class="num" style="font-size:17px">${esc(wo.name)}</b></div><div><div class="lbl">Steps goal</div><b class="num" style="font-size:17px">${inr(F.stepGoal(key, st))}</b></div><div><div class="lbl">Planned food</div><b class="num" style="font-size:17px">${inr(mac.kcal)} kcal</b></div><div><div class="lbl">Planned protein</div><b class="num" style="font-size:17px">${mac.p} g <small class="mu" style="font-size:12px">/ ${tg.protein}</small></b></div></div></div>
      <div class="card" style="--i:4"><h3>Content this week</h3>
        <div class="grid2"><div class="stat"><b>${lv}<small style="font-size:13px"> / ${st.profile.twoLong ? '1–2' : '1'}</small></b><span>long videos uploaded</span></div><div class="stat"><b>${F.reelStreak(t, st)}</b><span>day reel streak</span></div></div>
        <div class="tip"><span>🎥</span><span>Fri 5 PM: plan the long video. Sat/Sun: shoot, edit, upload. Reels: shoot in the morning block, post from any free gap.</span></div></div>
      <div class="card" style="--i:5"><h3>${esc(c.wcName)} <small>visit ~every ${c.wcInterval} days · post every ${c.wcEvery}</small></h3>
        <div class="grid2"><div class="stat"><b>${wc.sinceVisit === null ? '—' : wc.sinceVisit + 'd'}</b><span>since last visit${wc.nextVisit ? ' · next ' + shortDate(wc.nextVisit) : ''}</span></div><div class="stat"><b class="${wc.postDue ? 'down' : ''}">${wc.sincePost === null ? '—' : wc.sincePost + 'd'}</b><span>since last post${wc.postDue ? ' · overdue' : ''}</span></div></div>
        <div class="row" style="margin-top:10px;gap:8px"><button class="btn sm pri" data-act="witch" data-v="visit">Visited today</button><button class="btn sm" data-act="witch" data-v="post">Posted today</button></div></div>
      <div style="--i:6"><div class="top" style="margin:18px 0 4px"><h1 style="font-size:20px">${F.DAYS[F.dow(key)]} timeline</h1></div>${timeline(key)}</div>
      <div class="card" style="--i:7"><h3>Weekly training split</h3>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><b class="num" style="width:44px">${F.DAYS[d]}</b><span class="sp">${esc(F.WORKOUTS[d].name)}</span><span class="mu" style="font-size:12px">${esc(F.WORKOUTS[d].focus.split('·')[0])}</span></div>`).join('')}<div class="tip"><span>💡</span><span>Chest is hit twice a week (Mon heavy, Fri volume). Belly fat leaves through the deficit and steps, while core work builds the muscle underneath. Tell me your real split and I will swap it in.</span></div></div>`;
  }

  /* ----- Fuel ----- */
  function viewFuel() {
    const st = S(), key = today(), tg = F.targets(st), mac = F.dayMacros(key, st);
    let eatK = 0, eatP = 0, fib = 0;
    F.buildDay(key, st).filter((b) => b.meal && F.status(key, b, st) === 'done').forEach((b) => { const m = F.mealFor(key, b.meal, st); eatK += m.kcal; eatP += m.p; fib += m.f; });
    const dayBlocks = F.buildDay(key, st);
    const meals = F.SLOTS.filter((s) => dayBlocks.some((b) => b.meal === s)).map((s) => {
      const m = F.mealFor(key, s, st), blk = dayBlocks.find((b) => b.meal === s);
      const ml = st.meals[key] && st.meals[key][s], dn = blk && F.status(key, blk, st) === 'done';
      return `<div class="row" style="padding:12px 0;border-top:1px solid var(--line);align-items:flex-start"><div class="sp"><div class="row" style="gap:8px"><b class="num" style="font-size:15px">${m.label}</b><span class="tag">${F.fmt12(blk.t)}</span></div><div class="mu" style="font-size:12.5px;margin-top:3px">${m.items.map(esc).join(' · ')}</div><div style="margin-top:6px"><span class="tag">${m.kcal} kcal</span> <span class="tag">${m.p} g protein</span></div></div>
        ${ml && ml.photoId ? `<img class="thumb" data-pid="${ml.photoId}" alt="">` : ''}
        <div style="display:grid;gap:6px;justify-items:end"><button class="cam" data-act="cam" data-key="${key}" data-id="meal-${s}">${svg('cam')}${ml ? 'Retake' : 'Photo'}</button><button class="btn sm ${dn ? '' : 'pri'}" data-act="${dn ? 'undo' : 'tick'}" data-key="${key}" data-id="meal-${s}">${dn ? 'Undo' : 'Ate it'}</button></div></div>`;
    }).join('');
    const pg = [1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="row" style="padding:6px 0"><b class="num" style="width:44px">${F.DAYS[d]}</b><select class="in" data-act="pg" data-d="${d}" style="padding:9px 12px">${Object.keys(F.DAYTYPES).map((k) => `<option value="${k}" ${st.profile.pgPlan[d] === k ? 'selected' : ''}>${F.DAYTYPES[k].label}</option>`).join('')}</select></div>`).join('');
    const recent = st.photos.filter((p) => p.kind === 'meal').sort((a, b) => b.time - a.time).slice(0, 9);
    return `${topbar('Fuel', 'Recomposition: lose fat, keep and build muscle')}
      <div class="card" style="--i:1"><h3>Daily targets <small>auto-adjusts with your weight</small></h3>
        <div class="grid3" style="text-align:center"><div class="stat"><b>${inr(tg.kcal)}</b><span>kcal</span></div><div class="stat"><b>${tg.protein} g</b><span>protein</span></div><div class="stat"><b>${tg.fiber} g</b><span>fibre</span></div><div class="stat"><b>${tg.carbs} g</b><span>carbs</span></div><div class="stat"><b>${tg.fat} g</b><span>fat</span></div><div class="stat"><b>${tg.water} L</b><span>water</span></div></div>
        <div style="margin-top:14px" class="mini"><div class="row"><span class="lbl sp">Protein eaten</span><b class="num">${eatP} / ${tg.protein} g</b></div>${bar(eatP / tg.protein * 100)}<div class="row" style="margin-top:6px"><span class="lbl sp">Calories eaten</span><b class="num">${inr(eatK)} / ${inr(tg.kcal)}</b></div>${bar(eatK / tg.kcal * 100, 'food')}</div>
        <div class="tip"><span>🧮</span><span>Estimated from ${esc(String(S().profile.heightCm))} cm, ${S().profile.age} y, ${kg(tg.weight)} kg: maintenance ≈ ${inr(tg.tdee)} kcal, target ≈ ${inr(tg.kcal)} (about a 650 kcal deficit). Protein is set from your goal weight (2 g/kg). Re-check after 10–14 days of weights.</span></div></div>
      <div class="card" style="--i:2"><h3>Today's meals <small>plan ≈ ${inr(mac.kcal)} kcal · ${mac.p} g P</small></h3>${meals}</div>
      <div class="card" style="--i:3"><h3>PG menu planner</h3><p class="mu" style="margin:0 0 8px;font-size:13px">Set what the PG serves each day. Egg and chicken days use PG food; self-managed days use eggs, soya and curd you buy.</p>${pg}</div>
      <div class="card" style="--i:4"><h3>Budget shopping list <small>per week, approx.</small></h3>${[['Eggs', '~30 (2.5 dozen)'], ['Soya chunks', '500 g'], ['Oats', '500 g'], ['Toned milk', '~2 L'], ['Curd', '~1.5 kg'], ['Roasted chana', '350 g'], ['Bananas, apples, guava', '7 + 7 + 7'], ['Whey (optional, big win)', '1 scoop/day']].map((x) => `<div class="row" style="padding:7px 0;border-top:1px solid var(--line)"><span class="sp">${x[0]}</span><span class="mu">${x[1]}</span></div>`).join('')}</div>
      <div class="card" style="--i:5"><h3>Recomp rules</h3>${[['🍗', 'Protein first at every meal. It protects muscle in a deficit.'], ['🏋️', 'Progressive overload: add reps or weight weekly. Muscle is the reason you keep it.'], ['⚖️', 'Aim for 0.5–1% of body weight lost per week, not more.'], ['🥗', 'Fibre 30–35 g (oats, dal, fruit, salad) keeps hunger quiet.'], ['💧', '3.5 L water. Thirst often disguises itself as hunger.'], ['😴', '7–8 h sleep. It is the cheapest fat-loss tool you own.']].map((x) => `<div class="tip"><span>${x[0]}</span><span>${x[1]}</span></div>`).join('')}</div>
      <div class="card" style="--i:6"><h3>Vitamins and minerals <small>general, not a diagnosis</small></h3><div class="tip"><span>🧪</span><span>Vitamin D, B12, iron and omega-3 are commonly low in desk-bound lifters in India. Upload your blood reports in Track → Vault and share them with me in chat. I will point out what to ask your doctor about. Don't start supplements blind.</span></div></div>
      ${recent.length ? `<div class="card" style="--i:7"><h3>Recent meal photos</h3><div class="pgrid">${recent.map((p) => `<div class="ph" data-act="viewphoto" data-id="${p.id}"><img data-pid="${p.id}" alt="Meal"><span>${shortDate(p.date)}${p.slot ? ' · ' + p.slot : ''}</span></div>`).join('')}</div></div>` : ''}`;
  }

  /* ----- Track ----- */
  function weightChart(list) {
    const W = 340, H = 190, pl = 34, pr = 10, pt = 12, pb = 24;
    const vals = list.map((x) => x[1]); let mn = Math.min(...vals), mx = Math.max(...vals);
    const pad = Math.max(0.6, (mx - mn) * 0.2); mn -= pad; mx += pad;
    const X = (i) => pl + (list.length === 1 ? 0.5 : i / (list.length - 1)) * (W - pl - pr), Y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
    const d = list.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join('');
    const area = `${d}L${X(list.length - 1)},${H - pb}L${X(0)},${H - pb}Z`;
    const ticks = [mx, (mx + mn) / 2, mn].map((v) => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${kg(v)}</text>`).join('');
    const last = list[list.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">${ticks}<path class="ar" d="${area}"/><path class="ln" d="${d}"/><circle cx="${X(list.length - 1)}" cy="${Y(last[1])}" r="5"/><text x="${pl}" y="${H - 6}">${shortDate(list[0][0])}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${shortDate(last[0])}</text></svg>`;
  }
  const MFIELDS = [['chest', 'Chest'], ['belly', 'Belly (navel)'], ['waist', 'Waist (narrowest)'], ['hips', 'Hips'], ['thigh', 'Thigh'], ['arm', 'Arm (flexed)'], ['neck', 'Neck'], ['calf', 'Calf']];

  function viewTrack() {
    const st = S();
    const segs = [['weight', 'Weight'], ['photos', 'Photos'], ['body', 'Body'], ['insights', 'Insights'], ['vault', 'Vault']];
    let body = '';
    if (seg === 'weight') {
      const list = sortedWeights().slice(-30), p = st.profile, w = lastWeight(), r = weeklyRate();
      body = `<div class="card" style="--i:2"><h3>Weight trend <button class="btn pri sm" data-act="weight">${svg('plus')}Log today</button></h3>${list.length >= 2 ? weightChart(list) : '<div class="empty">Log at least two days to see your trend line.</div>'}</div>
        <div class="grid2" style="margin-bottom:12px;--i:3"><div class="stat"><b>${kg(w)} kg</b><span>current</span></div><div class="stat"><b class="${p.startWeight - w > 0 ? 'up' : ''}">${p.startWeight - w >= 0 ? '−' : '+'}${kg(Math.abs(p.startWeight - w))} kg</b><span>since start (${p.startWeight})</span></div><div class="stat"><b>${kg(w - p.targetWeight)} kg</b><span>to ${p.targetWeight} kg goal</span></div><div class="stat"><b class="${r !== null && r < 0 ? 'up' : r > 0 ? 'down' : ''}">${r === null ? '—' : (r > 0 ? '+' : '') + kg(r) + ' kg'}</b><span>per week (14-day trend)</span></div></div>
        ${list.length ? `<div class="card" style="--i:4"><h3>Recent entries</h3><table class="t"><tr><th>Date</th><th>Weight</th><th>Change</th></tr>${list.slice().reverse().slice(0, 10).map((x, i, a) => { const prev = a[i + 1]; const dlt = prev ? x[1] - prev[1] : null; return `<tr><td>${shortDate(x[0])}</td><td>${kg(x[1])} kg</td><td class="${dlt === null ? 'mu' : dlt <= 0 ? 'up' : 'down'}">${dlt === null ? '—' : (dlt > 0 ? '+' : '') + kg(dlt)}</td></tr>`; }).join('')}</table></div>` : ''}`;
    } else if (seg === 'photos') {
      const ph = st.photos.filter((p) => p.kind === 'progress').sort((a, b) => b.time - a.time);
      const first = ph[ph.length - 1], latest = ph[0];
      body = `<div class="card" style="--i:2"><h3>Daily progress photo <button class="btn pri sm" data-act="progresspic">${svg('cam')}Add</button></h3><p class="mu" style="margin:0;font-size:13px">Same spot, same light, same pose. The camera lies less than the scale does.</p></div>
        ${ph.length >= 2 ? `<div class="card" style="--i:3"><h3>First vs latest <small>${shortDate(first.date)} → ${shortDate(latest.date)}</small></h3><div class="grid2"><div class="pgrid" style="grid-template-columns:1fr"><div class="ph" data-act="viewphoto" data-id="${first.id}"><img data-pid="${first.id}" alt="First"><span>Day 1</span></div></div><div class="pgrid" style="grid-template-columns:1fr"><div class="ph" data-act="viewphoto" data-id="${latest.id}"><img data-pid="${latest.id}" alt="Latest"><span>Latest</span></div></div></div></div>` : ''}
        <div class="card" style="--i:4"><h3>Gallery <small>${ph.length} photos</small></h3>${ph.length ? `<div class="pgrid">${ph.map((p) => `<div class="ph" data-act="viewphoto" data-id="${p.id}"><img data-pid="${p.id}" alt="Progress"><span>${shortDate(p.date)}${st.weights[p.date] ? ' · ' + kg(st.weights[p.date]) : ''}</span></div>`).join('')}</div>` : '<div class="empty">No photos yet. Take your day-1 photo today.</div>'}</div>`;
    } else if (seg === 'body') {
      const ms = st.measures, last = ms[ms.length - 1], prev = ms[ms.length - 2];
      const due = !last || F.diffDays(last.date, today()) >= 28;
      body = `<div class="card" style="--i:2"><h3>Monthly measurements <button class="btn pri sm" data-act="measure">${svg('plus')}Record</button></h3>${due ? `<div class="tip warn"><span>📏</span><span>${last ? 'A month has passed. Time to re-measure.' : 'Record your day-1 numbers (cm). Do it every ~4 weeks, same time of day.'}</span></div>` : `<div class="tip good"><span>✅</span><span>Last recorded ${shortDate(last.date)}. Next one around ${shortDate(F.addDays(last.date, 28))}.</span></div>`}</div>
        ${last ? `<div class="card" style="--i:3"><h3>Latest vs ${prev ? 'previous' : 'start'}</h3><table class="t"><tr><th>Site</th><th>Now</th><th>Change</th></tr>${MFIELDS.filter((f) => last[f[0]]).map((f) => { const base = (ms[0] && ms[0] !== last ? ms[0] : null); const ref = prev || null; const dlt = ref && ref[f[0]] ? last[f[0]] - ref[f[0]] : null; return `<tr><td>${f[1]}</td><td>${last[f[0]]} cm</td><td class="${dlt === null ? 'mu' : dlt <= 0 ? 'up' : 'down'}">${dlt === null ? '—' : (dlt > 0 ? '+' : '') + kg(dlt)}</td></tr>`; }).join('')}</table></div>` : ''}
        ${ms.length > 1 ? `<div class="card" style="--i:4"><h3>History</h3>${ms.slice().reverse().map((m) => `<div class="row" style="padding:7px 0;border-top:1px solid var(--line);font-size:13px"><b class="num" style="width:62px">${shortDate(m.date)}</b><span class="mu sp">${MFIELDS.filter((f) => m[f[0]]).map((f) => f[1].split(' ')[0] + ' ' + m[f[0]]).join(' · ')}</span></div>`).join('')}</div>` : ''}`;
    } else if (seg === 'insights') {
      const A = analyse();
      const days14 = Array.from({ length: 14 }, (_, i) => F.addDays(today(), i - 13));
      const bars = days14.map((d) => { const pct = F.diffDays(st.profile.startDate, d) < 0 ? 0 : F.dayProgress(d, st).pct; return `<div style="flex:1;display:grid;gap:4px;justify-items:center"><div style="height:90px;width:100%;display:flex;align-items:flex-end"><i style="display:block;width:100%;border-radius:6px;background:${d === today() ? 'var(--ac)' : 'var(--s3)'};height:${Math.max(4, pct)}%;transition:height .8s var(--ease)"></i></div><small class="mu" style="font-size:10px">${F.parse(d).getDate()}</small></div>`; }).join('');
      const cp = A.catPct;
      body = `<div class="card" style="--i:2"><h3>Last 14 days <small>completion</small></h3><div class="row" style="gap:4px;align-items:flex-end">${bars}</div></div>
        <div class="card" style="--i:3"><h3>Adherence <small>last 7 days</small></h3>${[['move', 'Training + movement'], ['food', 'Meals'], ['content', 'Content'], ['sleep', 'Sleep + wake']].map((c) => `<div style="margin-bottom:12px"><div class="row"><span class="sp">${c[1]}</span><b class="num">${cp[c[0]] === null ? '—' : cp[c[0]] + '%'}</b></div>${bar(cp[c[0]] || 0, c[0] === 'food' ? 'food' : '')}</div>`).join('')}<div class="grid2"><div class="stat"><b>${A.avgSteps === null ? '—' : inr(A.avgSteps)}</b><span>avg steps</span></div><div class="stat"><b>${A.wCount}/7</b><span>weigh-ins</span></div></div></div>
        <div class="card" style="--i:4"><h3>Coach notes</h3>${A.tips.map(tipHTML).join('')}</div>`;
    } else {
      const docs = st.photos.filter((p) => p.kind === 'report').sort((a, b) => b.time - a.time);
      body = `<div class="card" style="--i:2"><h3>Health vault <button class="btn pri sm" data-act="report">${svg('plus')}Add</button></h3><p class="mu" style="margin:0 0 8px;font-size:13px">Keep blood reports and scans here, on this device. To get an analysis, open a chat with me and share the report. I will flag what is low and what to ask your doctor.</p></div>
        <div class="card" style="--i:3"><h3>Documents <small>${docs.length}</small></h3>${docs.length ? docs.map((d) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line)"><span style="width:22px">${svg('file')}</span><div class="sp"><b>${esc(d.note || d.name || 'Report')}</b><div class="mu" style="font-size:12px">${shortDate(d.date)}</div></div><button class="btn sm" data-act="viewphoto" data-id="${d.id}">Open</button></div>`).join('') : '<div class="empty">Nothing here yet.</div>'}</div>`;
    }
    return `${topbar('Track', 'Numbers that keep you honest')}<div class="scroll-x" style="margin-bottom:12px;--i:1"><div class="seg" style="min-width:100%;grid-auto-columns:max-content">${segs.map((s) => `<button class="${seg === s[0] ? 'on' : ''}" data-act="seg" data-v="${s[0]}">${s[1]}</button>`).join('')}</div></div>${body}`;
  }

  /* ----- Tasks ----- */
  function viewTasks() {
    const st = S(), t = today();
    const open = st.tasks.filter((x) => !x.done).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const done = st.tasks.filter((x) => x.done).slice(-6).reverse();
    const row = (x) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line)"><button class="chk" style="margin:0;${x.done ? 'background:var(--ac);border-color:var(--ac)' : ''}" data-act="ttick" data-id="${x.id}" aria-label="Toggle"><svg viewBox="0 0 24 24" style="${x.done ? 'stroke-dashoffset:0' : ''}"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button><div class="sp"><div style="${x.done ? 'text-decoration:line-through;opacity:.6' : ''}"><b>${esc(x.title)}</b></div><div class="mu" style="font-size:12px"><span class="${!x.done && x.date < t ? 'down' : ''}">${x.date === t ? 'Today' : shortDate(x.date)}</span>${x.time ? ' · ' + F.fmt12(x.time) : ''}${x.notify ? ' · 🔔' : ''}</div></div><button class="ico-btn" style="width:34px;height:34px" data-act="tdel" data-id="${x.id}" aria-label="Delete">${svg('x')}</button></div>`;
    const wk = st.tasks.filter((x) => x.done && x.date >= F.weekStart(t)).length;
    return `${topbar('Tasks', `${open.length} open · ${wk} done this week`, `<button class="btn pri sm" data-act="taskadd">${svg('plus')}Reminder</button>`)}
      <div class="card" style="--i:1"><h3>Reminders and tasks</h3>${open.length ? open.map(row).join('') : '<div class="empty">Nothing pending. Add a reminder and I will nudge you.</div>'}${done.length ? `<div class="lbl" style="margin:14px 0 2px">Done recently</div>${done.map(row).join('')}` : ''}</div>
      <div class="card" style="--i:2"><h3>Goals <button class="btn sm" data-act="goaladd">${svg('plus')}Goal</button></h3>${st.goals.length ? st.goals.map((g) => { const pct = g.target ? Math.min(100, (g.current / g.target) * 100) : 0; return `<div style="padding:12px 0;border-top:1px solid var(--line)"><div class="row"><b class="sp">${esc(g.title)}</b><button class="ico-btn" style="width:30px;height:30px" data-act="gdel" data-id="${g.id}" aria-label="Delete">${svg('x')}</button></div><div class="row" style="margin:8px 0 6px;gap:8px"><div class="sp">${bar(pct)}</div><b class="num" style="font-size:13px">${g.current}/${g.target} ${esc(g.unit || '')}</b></div><div class="row" style="gap:6px"><button class="btn sm" data-act="ginc" data-id="${g.id}" data-n="-1">−1</button><button class="btn sm pri" data-act="ginc" data-id="${g.id}" data-n="1">+1</button><button class="btn sm" data-act="ginc" data-id="${g.id}" data-n="5">+5</button>${g.due ? `<span class="mu sp" style="text-align:right;font-size:12px">by ${shortDate(g.due)}</span>` : ''}</div></div>`; }).join('') : '<div class="empty">No goals yet. Try "Post 30 reels" or "Hit 1,000 subscribers".</div>'}</div>`;
  }

  const VIEWS = { today: viewToday, plan: viewPlan, fuel: viewFuel, track: viewTrack, tasks: viewTasks };

  /* ---------- render ---------- */
  function paintNav() {
    const html = TABS.map((t) => `<button class="tab ${cur === t[0] ? 'on' : ''}" data-act="nav" data-v="${t[0]}" aria-label="${t[1]}">${svg(t[0])}<span>${t[1]}</span></button>`).join('');
    $('#tabs').innerHTML = html;
    $('#rail').innerHTML = `<div class="logo"><svg width="30" height="30" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--s3)" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="var(--ac)" stroke-width="10" stroke-linecap="round" stroke-dasharray="200 264" transform="rotate(-90 50 50)"/></svg>Forge21</div>${html}`;
  }
  function render() {
    const v = $('#view');
    v.innerHTML = VIEWS[cur]();
    v.classList.toggle('enter', animate); animate = false;
    paintNav(); hydrate(v); paintRings();
    justId = null;
  }
  function go(t) { cur = t; animate = true; if (t === 'plan') selDay = today(); history.replaceState(null, '', '#' + t); render(); window.scrollTo(0, 0); }

  /* ---------- sheets ---------- */
  function photoSheet(o) {
    // o: {title, lead, camera:'environment'|'user'|null, accept, onSave(file, note)}
    openSheet(`<h2>${o.title}</h2><p class="lead">${o.lead || ''}</p>
      <div id="ps-pick" class="pick">${o.camera ? `<button class="opt" id="ps-c">${svg('cam')}Camera</button>` : ''}<button class="opt" id="ps-g" ${o.camera ? '' : 'style="grid-column:1/-1"'}>${svg('img')}${o.camera ? 'Gallery' : 'Choose file'}</button></div>
      <div id="ps-prev" style="display:none">${o.noPreview ? '' : '<img class="preview" id="ps-img" alt="Preview">'}<div class="field"><label>${o.noteLabel || 'Note (optional)'}</label><input class="in" id="ps-note" placeholder="${o.notePh || ''}"></div><button class="btn pri block" id="ps-save">Save</button></div>
      <input type="file" id="in-c" accept="image/*" capture="${o.camera || 'environment'}" hidden><input type="file" id="in-g" accept="${o.accept || 'image/*'}" hidden>`, (sh) => {
      let file = null;
      const chosen = (f) => {
        if (!f) return; file = f;
        $('#ps-pick', sh).style.display = 'none'; $('#ps-prev', sh).style.display = 'block';
        if (!o.noPreview && f.type.startsWith('image/')) $('#ps-img', sh).src = URL.createObjectURL(f); else if ($('#ps-img', sh)) $('#ps-img', sh).style.display = 'none';
        if (o.noteDefault) $('#ps-note', sh).value = o.noteDefault;
      };
      const c = $('#ps-c', sh); if (c) c.onclick = () => $('#in-c', sh).click();
      $('#ps-g', sh).onclick = () => $('#in-g', sh).click();
      $('#in-c', sh).onchange = (e) => chosen(e.target.files[0]);
      $('#in-g', sh).onchange = (e) => chosen(e.target.files[0]);
      $('#ps-save', sh).onclick = async () => { const btn = $('#ps-save', sh); btn.disabled = true; btn.textContent = 'Saving…'; await o.onSave(file, $('#ps-note', sh).value.trim()); closeSheet(); };
    });
  }
  function mealPhoto(key, id) {
    const slot = id.replace('meal-', ''), m = F.mealFor(key, slot, S());
    photoSheet({ title: `${m.label} photo`, lead: 'Snap it or pick one from your gallery. I will log the meal and tick it off.', camera: 'environment', notePh: 'What did you actually eat?', onSave: async (f, note) => {
      const rec = await F.addPhoto(f, { kind: 'meal', date: key, slot, note });
      S().meals[key] = S().meals[key] || {}; S().meals[key][slot] = { photoId: rec.id, note, time: Date.now() };
      S().done[key] = S().done[key] || {}; S().done[key][id] = 'done'; justId = key + id;
      F.save(); render(); toast(`${F.praise('food')} (~${m.p} g protein)`);
      const pr = F.dayProgress(key, S()); if (pr.pct === 100) confetti();
    } });
  }
  function progressPic() {
    photoSheet({ title: 'Progress photo', lead: 'Same place, same light, same pose.', camera: 'user', notePh: 'Front / side / back', onSave: async (f, note) => {
      await F.addPhoto(f, { kind: 'progress', date: today(), note }); render(); toast('Photo saved. Future you says thanks 📸');
    } });
  }
  function reportSheet() {
    photoSheet({ title: 'Add a report', lead: 'Blood test, scan or prescription: photo or PDF. Stays on this device.', camera: 'environment', accept: 'image/*,application/pdf', noteLabel: 'Label', notePh: 'e.g. Lipid + Vitamin D, Oct 2026', onSave: async (f, note) => {
      if (f.type === 'application/pdf') { const id = 'p' + Date.now().toString(36); await F.blobPut({ id, blob: f }); F.sync.uploadBlob(id); S().photos.push({ id, time: Date.now(), type: f.type, name: f.name, kind: 'report', date: today(), note }); F.save(); }
      else await F.addPhoto(f, { kind: 'report', date: today(), note });
      render(); toast('Report saved to your vault 🗂️');
    } });
  }
  async function viewPhoto(id) {
    const p = S().photos.find((x) => x.id === id); if (!p) return;
    const isPdf = (p.type || '').includes('pdf');
    if (isPdf) { const u = await F.photoURL(id); window.open(u, '_blank'); return; }
    openSheet(`<img class="preview" data-pid="${id}" alt="Photo" style="max-height:62dvh;object-fit:contain"><div class="row"><div class="sp"><b>${shortDate(p.date)}</b><div class="mu" style="font-size:13px">${esc(p.note || '')}${p.slot ? ' · ' + p.slot : ''}</div></div><button class="btn danger sm" id="pdel">Delete</button><button class="btn sm" data-act="close">Close</button></div>`, (sh) => {
      $('#pdel', sh).onclick = async () => { if (confirm('Delete this photo for good?')) { await F.removePhoto(id); closeSheet(); render(); } };
    });
  }
  function numberSheet(o) {
    openSheet(`<h2>${o.title}</h2><p class="lead">${o.lead || ''}</p><div class="field"><label>${o.label}</label><input class="in num" id="ns-v" type="number" inputmode="decimal" step="${o.step || 1}" value="${o.value ?? ''}" placeholder="${o.ph || ''}" style="font-size:26px;text-align:center"></div>${o.quick ? `<div class="sw" style="margin-bottom:14px">${o.quick.map((q) => `<button class="btn sm" data-q="${q[1]}">${q[0]}</button>`).join('')}</div>` : ''}<button class="btn pri block" id="ns-save">Save</button>`, (sh) => {
      const inp = $('#ns-v', sh); setTimeout(() => inp.focus(), 250);
      $$('[data-q]', sh).forEach((b) => (b.onclick = () => { inp.value = Math.max(0, (parseFloat(inp.value) || 0) + parseFloat(b.dataset.q)); }));
      const save = () => { const v = parseFloat(inp.value); if (isNaN(v) || v < 0) { toast('Enter a number'); return; } o.onSave(v); closeSheet(); };
      $('#ns-save', sh).onclick = save; inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    });
  }
  function weightSheet() {
    const key = today();
    numberSheet({ title: 'Log weight', lead: 'Morning, after the toilet, before food and water. Same scale every day.', label: 'Weight (kg)', step: 0.1, value: S().weights[key] || lastWeight(), onSave: (v) => {
      const prev = sortedWeights().filter((x) => x[0] < key).pop();
      S().weights[key] = Math.round(v * 10) / 10; F.save(); render();
      toast(prev ? (v < prev[1] ? `${kg(prev[1] - v)} kg down since ${shortDate(prev[0])}. Nice 🔥` : v > prev[1] ? `Up ${kg(v - prev[1])} kg. Water swings are normal. Watch the trend.` : 'Same as last time. Steady.') : 'First weigh-in logged. Day one done 💪');
    } });
  }
  function stepsSheet() {
    const key = today(), goal = F.stepGoal(key, S());
    numberSheet({ title: 'Steps today', lead: `Goal: ${inr(goal)}. Copy the number from your phone's health app.`, label: 'Steps', value: S().steps[key] || '', ph: '0', quick: [['+1,000', 1000], ['+5,000', 5000]], onSave: (v) => {
      const before = (S().steps[key] || 0) >= goal; S().steps[key] = Math.round(v); F.save(); render();
      if (!before && v >= goal) { toast(`${inr(goal)} steps. Goal crushed 👟`); confetti(); }
    } });
  }
  function waterSheet() {
    const key = today();
    numberSheet({ title: 'Water today', lead: 'Target 3.5 L. Enter total millilitres.', label: 'Millilitres', value: S().water[key] || '', ph: '0', step: 50, quick: [['+250 ml', 250], ['+500 ml', 500], ['+1 L', 1000]], onSave: (v) => { S().water[key] = Math.round(v); F.save(); render(); if (v >= 3500) toast('Hydration goal hit 💧'); } });
  }
  function measureSheet() {
    const last = S().measures[S().measures.length - 1] || {};
    openSheet(`<h2>Body measurements</h2><p class="lead">In cm, relaxed, over bare skin. Measure the same spots each month.</p><div class="grid2">${MFIELDS.map((f) => `<div class="field"><label>${f[1]}</label><input class="in" data-m="${f[0]}" type="number" inputmode="decimal" step="0.1" value="${last[f[0]] || ''}"></div>`).join('')}</div><button class="btn pri block" id="ms-save">Save</button>`, (sh) => {
      $('#ms-save', sh).onclick = () => {
        const rec = { date: today() }; let any = false;
        $$('[data-m]', sh).forEach((i) => { const v = parseFloat(i.value); if (!isNaN(v) && v > 0) { rec[i.dataset.m] = v; any = true; } });
        if (!any) return toast('Enter at least one measurement');
        const ms = S().measures; const idx = ms.findIndex((m) => m.date === rec.date); if (idx >= 0) ms[idx] = rec; else ms.push(rec);
        ms.sort((a, b) => a.date.localeCompare(b.date)); F.save(); closeSheet(); render(); toast('Measurements saved 📏');
      };
    });
  }
  function taskSheet() {
    openSheet(`<h2>New reminder</h2><p class="lead">A thing to do, with an optional nudge.</p><div class="field"><label>What?</label><input class="in" id="t-title" placeholder="e.g. Renew gym membership"></div><div class="grid2"><div class="field"><label>Date</label><input class="in" id="t-date" type="date" value="${today()}"></div><div class="field"><label>Time</label><input class="in" id="t-time" type="time"></div></div><label class="row" style="margin:4px 0 16px;gap:10px"><input type="checkbox" id="t-n" checked style="width:20px;height:20px;accent-color:var(--ac)"><span>Notify me at that time</span></label><button class="btn pri block" id="t-save">Add reminder</button>`, (sh) => {
      $('#t-save', sh).onclick = () => {
        const title = $('#t-title', sh).value.trim(); if (!title) return toast('Give it a title');
        S().tasks.push({ id: 't' + Date.now().toString(36), title, date: $('#t-date', sh).value || today(), time: $('#t-time', sh).value || '', notify: $('#t-n', sh).checked, done: false });
        F.save(); closeSheet(); render(); toast('Reminder added ✅');
      };
    });
  }
  function goalSheet() {
    openSheet(`<h2>New goal</h2><p class="lead">Something measurable you can chip away at.</p><div class="field"><label>Goal</label><input class="in" id="g-title" placeholder="e.g. Post 30 reels this month"></div><div class="grid3"><div class="field"><label>Target</label><input class="in" id="g-target" type="number" inputmode="numeric" placeholder="30"></div><div class="field"><label>Unit</label><input class="in" id="g-unit" placeholder="reels"></div><div class="field"><label>By</label><input class="in" id="g-due" type="date"></div></div><button class="btn pri block" id="g-save">Add goal</button>`, (sh) => {
      $('#g-save', sh).onclick = () => {
        const title = $('#g-title', sh).value.trim(), target = parseFloat($('#g-target', sh).value);
        if (!title || !target) return toast('Add a title and a target number');
        S().goals.push({ id: 'g' + Date.now().toString(36), title, target, current: 0, unit: $('#g-unit', sh).value.trim(), due: $('#g-due', sh).value });
        F.save(); closeSheet(); render(); toast('Goal set 🎯');
      };
    });
  }

  function onboarding() {
    const p = S().profile;
    openSheet(`<h2>Let's set up your 21 days</h2><p class="lead">Takes 30 seconds. These numbers set your calorie and protein targets. Everything stays on your device.</p>
      <div class="field"><label>What should I call you?</label><input class="in" id="o-name" value="${esc(p.name)}" placeholder="Your name"></div>
      <div class="grid3"><div class="field"><label>Height (cm)</label><input class="in" id="o-h" type="number" inputmode="decimal" value="${p.heightCm}"></div><div class="field"><label>Age</label><input class="in" id="o-a" type="number" inputmode="numeric" value="${p.age}"></div><div class="field"><label>Sex</label><select class="in" id="o-s"><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Female</option></select></div></div>
      <div class="grid2"><div class="field"><label>Weight now (kg)</label><input class="in" id="o-w" type="number" inputmode="decimal" step="0.1" placeholder="e.g. 90"></div><div class="field"><label>Goal weight (kg)</label><input class="in" id="o-t" type="number" inputmode="decimal" step="0.1" placeholder="e.g. 75"></div></div>
      <div class="field"><label>Where are you right now?</label><div class="seg"><button class="on" data-o="hyd">📍 Hyderabad</button><button data-o="home">🏠 Home</button></div></div>
      <div class="tip"><span>🩺</span><span>This app is a planning and tracking tool, not medical advice. If you have a lot of weight to lose, check in with a doctor before big diet changes. A large goal is a months-long road, not a three-week one. The 21 days are the launch.</span></div>
      <button class="btn pri block" id="o-go" style="margin-top:14px">Start my 21 days</button>
      <div class="field" style="margin:18px 0 0"><label>Already use Forge21 on another device? Enter your sync code instead</label><div class="row" style="gap:8px"><input class="in" id="o-code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off"><button class="btn sm" id="o-link">Link</button></div></div>`, (sh) => {
      let mode = 'hyd';
      $('#o-link', sh).onclick = async () => { try { await F.sync.connect($('#o-code', sh).value); closeSheet(); render(); toast('Linked ✅ Your routine is here'); } catch (e) { toast(syncErr(e)); } };
      $$('[data-o]', sh).forEach((b) => (b.onclick = () => { mode = b.dataset.o; $$('[data-o]', sh).forEach((x) => x.classList.toggle('on', x === b)); }));
      $('#o-go', sh).onclick = () => {
        const q = S().profile;
        const w = parseFloat($('#o-w', sh).value), tw = parseFloat($('#o-t', sh).value);
        if (!(w >= 30 && w <= 300) || !(tw >= 30 && tw <= 300)) return toast('Enter your current and goal weight in kg');
        q.name = $('#o-name', sh).value.trim().slice(0, 60); q.heightCm = parseFloat($('#o-h', sh).value) || 172; q.age = parseInt($('#o-a', sh).value, 10) || 28; q.sex = $('#o-s', sh).value;
        q.startWeight = w; q.targetWeight = tw; q.mode = mode; q.startDate = today();
        S().onboarded = true; F.save(); closeSheet(); render(); toast(`Let's go${q.name ? ', ' + q.name.split(' ')[0] : ''}. Day 1 starts now 🔥`);
        setTimeout(askNotif, 700);
      };
    });
  }
  function askNotif() {
    if (!('Notification' in window) || S().notif.on || Notification.permission === 'denied') return;
    openSheet(`<h2>Want nudges?</h2><p class="lead">I can remind you at every block: gym, meals, reels, walk, bed. Notifications have <b>Done</b> and <b>Skip</b> buttons, so one tap logs it here too. Meal reminders offer <b>Add photo</b>.</p><div class="tip"><span>📱</span><span>Install the app first for the most reliable alerts: Chrome menu → <b>Install app</b> / <b>Add to Home screen</b>.</span></div><button class="btn pri block" id="n-yes" style="margin-top:14px">Turn on notifications</button><button class="btn block" data-act="close" style="margin-top:8px">Not now</button>`, (sh) => { $('#n-yes', sh).onclick = async () => { closeSheet(); await enableNotif(); }; });
  }

  /* ----- sync + push card ----- */
  const syncErr = (e) => ({ short: 'That code looks too short', 'http-403': 'This server is already linked to a different sync code. Use your original code.', 'no-server': 'Server not found. Sync needs the deployed backend (Vercel + Redis, see README).' }[e.message] || 'Could not connect. Check your internet and try again.');
  function syncStatusHTML() {
    const sy = F.sync, c = sy.cfg();
    if (sy.busy) return 'Syncing…';
    if (sy.error === 'no-server') return '⚠️ Server not found. Sync needs the deployed backend (Vercel + Redis, see README).';
    if (sy.error === 'http-403') return '⚠️ This server belongs to a different sync code.';
    if (sy.error) return '⚠️ Last sync failed. Will retry automatically.';
    const t = sy.last || (c && c.last);
    return t ? `✅ Synced at ${new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet';
  }
  function syncCard() {
    const c = F.sync.cfg();
    if (!c) return `<div class="card" style="margin-bottom:10px"><h3>Sync + push <small>off</small></h3><p class="mu" style="margin:0 0 10px;font-size:13px">Link your phone and laptop so they share one routine, and get notifications that arrive on time even when the app is closed.</p>
      <button class="btn sm pri" id="sy-new">First device: create my code</button>
      <div class="field" style="margin:14px 0 0"><label>Already have a code? Enter it here</label><div class="row" style="gap:8px"><input class="in" id="sy-code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off"><button class="btn sm" id="sy-join">Link</button></div></div></div>`;
    return `<div class="card" style="margin-bottom:10px"><h3>Sync + push</h3>
      <div id="sy-status" style="font-size:13px;margin:-4px 0 12px">${syncStatusHTML()}</div>
      <div class="lbl">Your sync code</div>
      <button id="sy-copy" class="in num" style="text-align:center;font-size:15px;letter-spacing:.02em;margin:6px 0 4px;white-space:nowrap">${esc(c.code)}</button>
      <p class="mu" style="margin:0 0 12px;font-size:12.5px">Tap to copy. Enter this code on your other devices. Anyone with it can read your data, so keep it private.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" id="sy-now">Sync now</button><button class="btn sm pri" id="sy-push">Push: checking…</button><button class="btn sm danger" id="sy-off">Unlink</button></div></div>`;
  }
  function bindSync(sh) {
    const again = () => settingsSheet();
    const on = (id, fn) => { const el = $(id, sh); if (el) el.onclick = fn; };
    on('#sy-new', async () => { try { await F.sync.connect(F.sync.newCode()); toast('Synced. Save your code somewhere safe 🔐'); again(); } catch (e) { toast(syncErr(e)); } });
    on('#sy-join', async () => { try { await F.sync.connect($('#sy-code', sh).value); toast('Linked ✅'); closeSheet(); render(); } catch (e) { toast(syncErr(e)); } });
    on('#sy-now', async () => { await F.sync.now(); if (F.sync.error) toast(syncErr({ message: F.sync.error })); else toast('Synced ✅'); });
    on('#sy-copy', async () => { try { await navigator.clipboard.writeText(F.sync.cfg().code); toast('Code copied'); } catch (e) { toast('Copy it by hand: ' + F.sync.cfg().code, 5000); } });
    on('#sy-off', async () => { if (confirm('Unlink this device? Your data stays here, it just stops syncing and pushing.')) { await F.sync.disconnect(); toast('Unlinked'); again(); } });
    const pb = $('#sy-push', sh);
    if (pb) {
      F.sync.pushOn().then((v) => { pb.textContent = v ? 'Push: on ✓' : 'Turn on push'; pb.dataset.on = v ? '1' : ''; }).catch(() => { pb.textContent = 'Push unsupported'; });
      pb.onclick = async () => {
        try {
          if (pb.dataset.on) { await F.sync.pushOff(); pb.textContent = 'Turn on push'; pb.dataset.on = ''; toast('Push off for this device'); }
          else { await F.sync.pushEnable(); pb.textContent = 'Push: on ✓'; pb.dataset.on = '1'; toast('Push on 🔔 Notifications will arrive even when the app is closed'); }
        } catch (e) { toast(e.message === 'denied' ? 'Notifications are blocked in the browser settings' : e.message === 'unsupported' ? 'This browser does not support push. Install the app first.' : e.message === 'no-server' ? syncErr(e) : 'Could not turn on push'); }
      };
    }
  }

  function settingsSheet() {
    const p = S().profile, perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const theme = document.documentElement.dataset.theme || 'auto';
    openSheet(`<h2>Settings</h2>
      <div class="card" style="margin:14px 0 10px"><h3>Profile</h3>
        <div class="field"><label>Name</label><input class="in" data-p="name" value="${esc(p.name)}"></div>
        <div class="grid3"><div class="field"><label>Height cm</label><input class="in" data-p="heightCm" type="number" value="${p.heightCm}"></div><div class="field"><label>Age</label><input class="in" data-p="age" type="number" value="${p.age}"></div><div class="field"><label>Goal kg</label><input class="in" data-p="targetWeight" type="number" step="0.1" value="${p.targetWeight}"></div></div>
        <div class="grid2"><div class="field"><label>Start weight kg</label><input class="in" data-p="startWeight" type="number" step="0.1" value="${p.startWeight}"></div><div class="field"><label>21-day start</label><input class="in" data-p="startDate" type="date" value="${p.startDate}"></div></div>
        <div class="grid2"><div class="field"><label>Wake</label><input class="in" data-p="wake" type="time" value="${p.wake}"></div><div class="field"><label>Lights out</label><input class="in" data-p="bed" type="time" value="${p.bed}"></div></div>
        <label class="row" style="gap:10px;margin-bottom:6px"><input type="checkbox" data-p="twoLong" ${p.twoLong ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ac)"><span>Plan a second long video each week</span></label></div>
      <div class="card" style="margin-bottom:10px"><h3>Recurring venue shoot</h3><div class="field"><label>Name</label><input class="in" data-c="wcName" maxlength="40" value="${esc(S().commit.wcName)}"></div><div class="grid2"><div class="field"><label>Visit every (days)</label><input class="in" data-c="wcInterval" type="number" value="${S().commit.wcInterval}"></div><div class="field"><label>Post every (days)</label><input class="in" data-c="wcEvery" type="number" value="${S().commit.wcEvery}"></div></div></div>
      <div class="card" style="margin-bottom:10px"><h3>Notifications <small>${perm}</small></h3><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm pri" id="s-n">${S().notif.on ? 'Re-enable' : 'Enable'}</button><button class="btn sm" id="s-nt">Send a test</button></div><div class="tip"><span>ℹ️</span><span>These alerts fire while the app is alive in the background. For on-time delivery even when your phone has been idle for hours, link a sync code below and turn on <b>Push</b>.</span></div></div>
      ${syncCard()}
      <div class="card" style="margin-bottom:10px"><h3>Appearance and data</h3><div class="seg" style="margin-bottom:12px">${['auto', 'dark', 'light'].map((t) => `<button class="${theme === t ? 'on' : ''}" data-th="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" id="s-ex">Export backup</button><button class="btn sm" id="s-im">Import backup</button><button class="btn sm danger" id="s-rs">Reset everything</button></div><input type="file" id="s-file" accept=".json,application/json" hidden></div>
      <button class="btn pri block" id="s-done">Done</button>`, (sh) => {
      $$('[data-p]', sh).forEach((el) => (el.onchange = () => {
        const k = el.dataset.p, q = S().profile;
        q[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) || q[k] : el.value || q[k];
        F.save(); render();
      }));
      $$('[data-c]', sh).forEach((el) => (el.onchange = () => {
        const k = el.dataset.c;
        S().commit[k] = el.type === 'number' ? parseInt(el.value, 10) || S().commit[k] : el.value.trim().slice(0, 40) || S().commit[k];
        F.save(); render();
      }));
      $$('[data-th]', sh).forEach((b) => (b.onclick = () => { setTheme(b.dataset.th); $$('[data-th]', sh).forEach((x) => x.classList.toggle('on', x === b)); }));
      $('#s-n', sh).onclick = async () => { await enableNotif(); };
      $('#s-nt', sh).onclick = async () => { const ok = await showNote({ title: '🔔 Test from Forge21', body: 'Tap Done. If it ticks in the app, notifications work.', tag: 'test-' + Date.now(), key: today(), id: 'test', actions: [{ action: 'done', title: '✅ Done' }, { action: 'skip', title: '⏭ Skip' }] }); if (!ok) toast('Enable notifications first'); };
      $('#s-ex', sh).onclick = async () => { const txt = await F.exportAll(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `forge21-backup-${today()}.json`; a.click(); toast('Backup downloaded'); };
      $('#s-im', sh).onclick = () => $('#s-file', sh).click();
      $('#s-file', sh).onchange = async (e) => { try { await F.importAll(await e.target.files[0].text()); closeSheet(); render(); toast('Backup restored ✅'); } catch (err) { toast('That file is not a Forge21 backup'); } };
      $('#s-rs', sh).onclick = () => { if (confirm('Delete ALL data on this device? This cannot be undone.') && confirm('Really sure?')) { localStorage.removeItem('forge21.v1'); indexedDB.deleteDatabase('forge21'); location.reload(); } };
      $('#s-done', sh).onclick = () => closeSheet();
      bindSync(sh);
    });
  }
  function setTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('forge21.theme', t); } catch (e) { /* ignore */ }
    const lt = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
    $('meta[name=theme-color]').content = lt ? '#f3f2ec' : '#0b0c0e';
  }

  /* ---------- notifications ---------- */
  let swReg = null, shown = {};
  async function initSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      swReg = await navigator.serviceWorker.register('sw.js');
      navigator.serviceWorker.addEventListener('message', async (e) => {
        const d = e.data || {};
        if (d.type === 'pending') { const n = await F.mergePending(); if (n) { render(); toast('Logged from your notification ✅'); } }
        if (d.type === 'cam') { go('today'); mealPhoto(d.key, d.id); }
        if (d.type === 'testok') toast(`Notification button works: ${d.action === 'done' ? 'Done ✅' : 'Skip ⏭'}`);
      });
    } catch (err) { /* offline-only features unavailable */ }
  }
  async function enableNotif() {
    if (!('Notification' in window)) return toast('This browser does not support notifications');
    const r = await Notification.requestPermission();
    if (r !== 'granted') return toast('Notifications blocked. Allow them in the browser site settings.');
    S().notif.on = true; F.save(); syncAlerts();
    try { const reg = swReg || (await navigator.serviceWorker.ready); if (reg.periodicSync) await reg.periodicSync.register('forge21-check', { minInterval: 15 * 60 * 1000 }); } catch (e) { /* not supported / not installed */ }
    toast('Notifications on 🔔');
  }
  async function showNote(a) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const reg = swReg || (await navigator.serviceWorker.ready);
      await reg.showNotification(a.title, { body: a.body, tag: a.tag, icon: 'icons/icon-192.png', badge: 'icons/badge.png', actions: a.actions, data: { key: a.key, id: a.id, kind: a.kind, tag: a.tag }, vibrate: [120, 60, 120] });
      return true;
    } catch (e) { try { new Notification(a.title, { body: a.body, tag: a.tag }); return true; } catch (e2) { return false; } }
  }
  let syncT = 0;
  function syncAlerts() {
    clearTimeout(syncT);
    syncT = setTimeout(() => { F.kvSet('alerts', F.alerts(S(), Date.now() - 3600e3)).catch(() => {}); }, 800);
  }
  F.onSaved = () => { syncAlerts(); if (!F.sync.applying) F.sync.schedule(); };
  async function tickAlerts() {
    if (!S().notif.on) return;
    const now = Date.now();
    shown = (await F.kvGet('shown')) || shown;
    const due = F.alerts(S(), now - 3600e3, 0).filter((a) => a.at <= now && a.at > now - 40 * 60e3 && !shown[a.tag]);
    for (const a of due) {
      shown[a.tag] = now;
      const ok = await showNote(a);
      if (!ok && document.visibilityState === 'visible') toast(a.title);
    }
    if (due.length) { Object.keys(shown).forEach((k) => { if (now - shown[k] > 3 * 864e5) delete shown[k]; }); F.kvSet('shown', shown).catch(() => {}); }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, d = el.dataset, st = S();
    if (a === 'scrim') { if (e.target === el) closeSheet(); return; }
    if (a === 'close') return closeSheet();
    if (a === 'nav') return go(d.v);
    if (a === 'settings') return settingsSheet();
    if (a === 'open') { const k = d.key + d.id; if (e.target.closest('button')) { /* inner buttons handled separately */ } else { openBlocks.has(k) ? openBlocks.delete(k) : openBlocks.add(k); const ex = el.querySelector('.exp'); if (ex) ex.classList.toggle('open'); } return; }
    if (a === 'tick') {
      e.stopPropagation();
      const b = F.buildDay(d.key, st).find((x) => x.id === d.id); if (!b) return;
      const cur2 = F.status(d.key, b, st);
      return setStatus(d.key, d.id, cur2 === 'done' ? null : 'done', b.cat);
    }
    if (a === 'skip') { e.stopPropagation(); return setStatus(d.key, d.id, 'skip', 'life'); }
    if (a === 'undo') { e.stopPropagation(); return setStatus(d.key, d.id, null); }
    if (a === 'auto') { e.stopPropagation(); return ({ weigh: weightSheet, steps: stepsSheet, water: waterSheet }[d.auto] || (() => {}))(); }
    if (a === 'cam') { e.stopPropagation(); return mealPhoto(d.key, d.id); }
    if (a === 'mode') { st.profile.mode = d.v; if (st.dayMeta[d.key]) delete st.dayMeta[d.key].mode; F.save(); return render(); }
    if (a === 'daymode') { (st.dayMeta[d.key] = st.dayMeta[d.key] || {}).mode = d.v; F.save(); return render(); }
    if (a === 'office') { (st.dayMeta[d.key] = st.dayMeta[d.key] || {}).office = d.v === '1'; F.save(); return render(); }
    if (a === 'travel') { (st.dayMeta[d.key] = st.dayMeta[d.key] || {}).travel = d.v === '1'; F.save(); return render(); }
    if (a === 'day') { selDay = d.key; return render(); }
    if (a === 'weekshift') { selDay = F.addDays(selDay, parseInt(d.n, 10)); return render(); }
    if (a === 'weight') return weightSheet();
    if (a === 'steps') return stepsSheet();
    if (a === 'water') return waterSheet();
    if (a === 'seg') { seg = d.v; animate = true; return render(); }
    if (a === 'progresspic') return progressPic();
    if (a === 'report') return reportSheet();
    if (a === 'measure') return measureSheet();
    if (a === 'viewphoto') return viewPhoto(d.id);
    if (a === 'taskadd') return taskSheet();
    if (a === 'goaladd') return goalSheet();
    if (a === 'ttick') { const t = st.tasks.find((x) => x.id === d.id); if (t) { t.done = !t.done; if (t.done) toast(F.praise('life')); F.save(); render(); } return; }
    if (a === 'tdel') { st.tasks = st.tasks.filter((x) => x.id !== d.id); F.tomb(d.id); F.save(); return render(); }
    if (a === 'ginc') { const g = st.goals.find((x) => x.id === d.id); if (g) { g.current = Math.max(0, g.current + parseFloat(d.n)); if (g.current >= g.target) { toast(`Goal reached: ${g.title} 🏆`); confetti(); } F.save(); render(); } return; }
    if (a === 'gdel') { st.goals = st.goals.filter((x) => x.id !== d.id); F.tomb(d.id); F.save(); return render(); }
    if (a === 'witch') { st.commit[d.v === 'visit' ? 'wcVisit' : 'wcPost'] = today(); if (d.v === 'visit') st.commit.wcPost = today(); F.save(); render(); return toast(d.v === 'visit' ? 'Visit logged. Edit, then post within 3 days 🏏' : 'Posted. Chain unbroken 📲'); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="pg"]');
    if (el) { S().profile.pgPlan[el.dataset.d] = el.value; F.save(); render(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const n = await F.mergePending(); if (n) toast('Logged from your notification ✅');
    if (!$('.sheet')) render(); tickAlerts();
  });
  window.addEventListener('online', () => toast('Back online'));

  /* ---------- boot ---------- */
  try { const t = localStorage.getItem('forge21.theme'); if (t) setTheme(t); } catch (e) { /* ignore */ }
  function handleHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('cam/')) { const [, key, id] = h.split('/'); history.replaceState(null, '', '#today'); cur = 'today'; render(); setTimeout(() => mealPhoto(key, id), 300); return true; }
    if (VIEWS[h]) cur = h;
    return false;
  }
  async function boot() {
    initSW();
    await F.mergePending().catch(() => {});
    if (!handleHash()) render();
    const sp = $('#splash');
    const hideSplash = () => { sp.classList.add('gone'); setTimeout(() => sp.remove(), 500); };
    let seen = false; try { seen = sessionStorage.getItem('f21s'); sessionStorage.setItem('f21s', '1'); } catch (e) { /* ignore */ }
    setTimeout(hideSplash, seen ? 80 : 900);
    if (!S().onboarded) setTimeout(onboarding, seen ? 150 : 1000);
    syncAlerts(); tickAlerts();
    F.sync.onStatus = () => { const el = $('#sy-status'); if (el) el.innerHTML = syncStatusHTML(); };
    F.sync.init();
    setInterval(tickAlerts, 20000);
    setInterval(() => { if (document.visibilityState === 'visible' && !$('.sheet') && !document.activeElement.matches('input,select,textarea')) render(); }, 60000);
  }
  window.addEventListener('hashchange', handleHash);
  boot();
  F.ui = { render, toast, go };
})();
