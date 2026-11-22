/* Forge21 — schedule, diet and workout engine (pure logic, no DOM) */
(function () {
  const F = (window.F = window.F || {});

  /* ---------- date & time helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  F.dk = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  F.parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  F.addDays = (k, n) => { const d = F.parse(k); d.setDate(d.getDate() + n); return F.dk(d); };
  F.dow = (k) => F.parse(k).getDay(); // 0 = Sunday
  F.diffDays = (a, b) => Math.round((F.parse(b) - F.parse(a)) / 864e5);
  F.weekStart = (k) => { const d = F.dow(k); return F.addDays(k, d === 0 ? -6 : 1 - d); }; // Monday
  const m2t = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const t2m = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  F.m2t = m2t; F.t2m = t2m;
  F.fmt12 = (t) => { const m = t2m(t); let h = Math.floor(m / 60); const mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(mm)} ${ap}`; };
  F.DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  F.DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- workouts (index = weekday, 0 = Sunday) ---------- */
  F.WORKOUTS = {
    1: { name: 'Chest + Triceps', focus: 'Heavy chest day · upper-chest priority', ex: [
      ['Incline DB press', '4 × 8–10', 'Your priority lift. Slow 3-sec lowering.'],
      ['Flat barbell / DB press', '4 × 6–8', 'Add weight when all reps feel clean.'],
      ['Pec-deck or cable fly', '3 × 12–15', 'Pause 1 sec at the stretch.'],
      ['Dips (assisted if needed)', '3 × 8–12'],
      ['Rope pushdown', '3 × 12'],
      ['Overhead triceps extension', '3 × 12'],
      ['Cable crunch', '3 × 15', 'Belly = deficit + core strength. You cannot spot-burn it.']] },
    2: { name: 'Back + Biceps', focus: 'Posture and a wider frame', ex: [
      ['Lat pulldown', '4 × 10'],
      ['Seated cable row', '4 × 10'],
      ['One-arm DB row', '3 × 10'],
      ['Face pull', '3 × 15'],
      ['EZ-bar curl', '3 × 12'],
      ['Hammer curl', '3 × 12'],
      ['Plank', '3 × 45 sec'],
      ['Hanging knee raise', '3 × 12']] },
    3: { name: 'Legs', focus: 'Biggest calorie burn of the week', ex: [
      ['Squat or leg press', '4 × 10'],
      ['Romanian deadlift', '3 × 10'],
      ['Walking lunges', '3 × 12 / leg'],
      ['Leg curl', '3 × 12'],
      ['Standing calf raise', '4 × 15'],
      ['Incline treadmill walk', '10 min', 'Cool-down, steady pace.']] },
    4: { name: 'Shoulders + Core', focus: 'Capped shoulders make the waist look smaller', ex: [
      ['Overhead press', '4 × 8'],
      ['Lateral raise', '4 × 15'],
      ['Rear-delt fly', '3 × 15'],
      ['DB shrug', '3 × 12'],
      ['Ab-wheel or decline crunch', '3 × 12'],
      ['Russian twist', '3 × 20'],
      ['Leg raise', '3 × 12']] },
    5: { name: 'Chest + Upper', focus: 'Second chest session of the week · volume', ex: [
      ['Incline machine press', '4 × 10'],
      ['Machine / DB chest press', '3 × 12'],
      ['Cable crossover (low → high)', '4 × 15'],
      ['Push-ups to near failure', '2 sets'],
      ['Assisted pull-up', '3 × 8'],
      ['Lateral raise', '3 × 15']] },
    6: { name: 'Full body + Abs', focus: 'Metabolic circuit, then core', ex: [
      ['Goblet squat', '3 × 12'],
      ['DB bench press', '3 × 12'],
      ['Cable row', '3 × 12'],
      ['Farmer walk', '4 × 40 m'],
      ['Incline treadmill walk', '20 min'],
      ['Plank + side plank', '3 rounds'],
      ['Bicycle crunch', '3 × 20']] },
    0: { name: 'Rest + mobility', focus: 'No lifting. Muscles grow while you recover.', ex: [
      ['Hip + thoracic mobility', '10 min'],
      ['Easy stretch / foam roll', '10 min'],
      ['Long walk or Hyderabad explore', 'steps goal']] }
  };

  /* ---------- meal database (approximate, per serving) ---------- */
  F.MEAL_DB = {
    pre: { label: 'Pre-workout', items: ['Black coffee, no sugar', '1 banana'], kcal: 105, p: 1, f: 3 },
    post: { label: 'Post-workout shake', items: ['1 scoop whey in 250 ml toned milk', 'Budget swap: 4 egg whites + 1 glass milk'], kcal: 280, p: 33, f: 0 },
    bfast: { label: 'Breakfast', items: ['Oats 60 g cooked in milk or water', '3 boiled eggs', '1 apple or papaya bowl'], kcal: 520, p: 26, f: 10, note: 'If the PG breakfast is light (idli, upma, poha) eat it, then add the 3 eggs.' },
    snack: { label: 'Evening snack', items: ['Roasted chana 50 g', 'Curd 150 g', '1 guava'], kcal: 340, p: 18, f: 13 },
    lunch: {
      egg: { items: ['Rice 1 cup', 'Dal 1 cup', 'Egg curry (3 eggs)', 'Salad'], kcal: 720, p: 38, f: 10 },
      chicken: { items: ['Chicken 150 g (grilled or curry)', 'Rice 1 cup', 'Dal', 'Salad'], kcal: 740, p: 60, f: 9 },
      soya: { items: ['Soya chunks 50 g dry, as curry', 'Rice 1 cup', 'Dal', 'Curd 100 g'], kcal: 760, p: 45, f: 14 }
    },
    dinner: {
      egg: { items: ['Omelette: 2 whole eggs + 4 whites', '2 roti', 'Sabzi + salad'], kcal: 600, p: 38, f: 7 },
      chicken: { items: ['Chicken 150 g', '2 roti', 'Sabzi + salad'], kcal: 600, p: 55, f: 7 },
      soya: { items: ['Soya chunks 40 g dry', 'Paneer 50 g or extra curd', '2 roti', 'Sabzi'], kcal: 610, p: 38, f: 8 }
    }
  };
  // what a day looks like for each PG menu type
  F.DAYTYPES = {
    egg: { label: 'PG egg day', lunch: 'egg', dinner: 'soya' },
    chicken: { label: 'PG chicken day', lunch: 'chicken', dinner: 'egg' },
    self: { label: 'Self-managed', lunch: 'soya', dinner: 'egg' }
  };
  F.SLOTS = ['pre', 'post', 'bfast', 'lunch', 'snack', 'dinner'];

  F.dayType = (key, st) => (st.profile.pgPlan && st.profile.pgPlan[F.dow(key)]) || 'self';

  F.mealFor = (key, slot, st) => {
    const dt = F.DAYTYPES[F.dayType(key, st)];
    let m = F.MEAL_DB[slot];
    if (slot === 'lunch') m = F.MEAL_DB.lunch[dt.lunch];
    if (slot === 'dinner') m = F.MEAL_DB.dinner[dt.dinner];
    const label = { pre: 'Pre-workout', post: 'Post-workout shake', bfast: 'Breakfast', lunch: 'Lunch', snack: 'Evening snack', dinner: 'Dinner' }[slot];
    return Object.assign({ slot, label }, m);
  };

  F.dayMacros = (key, st) => {
    const t = { kcal: 0, p: 0, f: 0 };
    F.buildDay(key, st).filter((b) => b.meal).forEach((b) => { const m = F.mealFor(key, b.meal, st); t.kcal += m.kcal; t.p += m.p; t.f += m.f; });
    return t;
  };

  /* ---------- targets (recomposition: moderate deficit, high protein) ---------- */
  F.targets = (st) => {
    const p = st.profile;
    const ws = Object.keys(st.weights).sort();
    const w = ws.length ? st.weights[ws[ws.length - 1]] : p.startWeight;
    const bmr = 10 * w + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'f' ? -161 : 5);
    const tdee = bmr * 1.55;
    const kcal = Math.max(1800, Math.round((tdee - 650) / 50) * 50);
    const protein = Math.round((2.0 * p.targetWeight) / 5) * 5;
    const fat = Math.max(55, Math.round(0.8 * p.targetWeight));
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, fiber: 35, water: 3.5, weight: w };
  };

  /* ---------- day rules ---------- */
  F.modeFor = (key, st) => (st.dayMeta[key] && st.dayMeta[key].mode) || st.profile.mode;
  F.isWeekend = (key) => { const d = F.dow(key); return d === 0 || d === 6; };
  F.isOffice = (key, st) => {
    if (F.modeFor(key, st) === 'home' || F.isWeekend(key)) return false;
    const m = st.dayMeta[key];
    if (m && m.office !== undefined) return m.office;
    return [1, 2].includes(F.dow(key)); // Mon + Tue by default
  };
  F.isTravel = (key, st) => {
    if (!F.isWeekend(key)) return false;
    const m = st.dayMeta[key];
    if (m && m.travel !== undefined) return m.travel;
    return F.dow(key) === 0; // Sunday by default
  };
  F.stepGoal = (key, st) => {
    if (F.isWeekend(key)) return F.isTravel(key, st) ? 25000 : 12000;
    return 10000;
  };

  /* ---------- the schedule builder ---------- */
  F.buildDay = (key, st) => {
    const p = st.profile;
    const dow = F.dow(key);
    const wkend = F.isWeekend(key);
    const home = F.modeFor(key, st) === 'home';
    const office = F.isOffice(key, st);
    const travel = F.isTravel(key, st);
    const wo = F.WORKOUTS[dow];
    const B = [];
    const add = (t, dur, id, title, sub, cat, o) => {
      B.push(Object.assign({ id, s: t, t: m2t(t), e: m2t(t + dur), dur, title, sub: sub || '', cat }, o || {}));
      return t + dur;
    };
    const meal = (t, dur, slot) => {
      const m = F.mealFor(key, slot, st);
      const src = slot === 'lunch' || slot === 'dinner' ? (home ? 'Home kitchen' : F.DAYTYPES[F.dayType(key, st)].label) : '';
      return add(t, dur, 'meal-' + slot, m.label, `${m.items[0]}${m.items.length > 1 ? ' + ' + (m.items.length - 1) + ' more' : ''}`, 'food', {
        meal: slot, notify: 1, follow: 25, photo: 1, kcal: m.kcal, p: m.p, src
      });
    };
    const WALK_SUB = 'Brisk, phone away. Voice-note content ideas as you go.';

    if (!wkend) {
      const W = t2m(p.wake);
      let c = add(W, 10, 'wake', 'Wake up', '500 ml water first. No snooze.', 'sleep', { notify: 1, emoji: '☀️' });
      c = add(c, 5, 'weigh', 'Weigh-in', 'Same scale, same time. Log it in Track.', 'life', { notify: 1, auto: 'weigh', emoji: '⚖️' });
      c = meal(c, 15, 'pre');
      c = add(c, office ? 90 : 105, 'gym', 'Gym · ' + wo.name, wo.focus, 'move', { notify: 1, follow: 30, emoji: '🏋️', workout: true });
      c = meal(c, 15, 'post');
      c = add(c, home ? 45 : 75, 'prep', home ? 'Shower + get ready' : office ? 'Cook, pack lunch, get ready' : 'Cook + shower + get ready',
        office ? 'Dress for office. Bag, ID, charger.' : 'Food prep and a proper reset before work.', 'life', {});
      c = meal(c, 30, 'bfast');
      if (office) {
        const reelEnd = t2m('10:10');
        if (reelEnd - c >= 20) add(c, reelEnd - c, 'reel-a', 'Reel: idea + script', 'Quick prep slot. Shoot later in a free gap.', 'content', { notify: 1, emoji: '🎬' });
        add(t2m('10:15'), 25, 'commute-in', 'Commute · 2 km', 'Walk (best) or bike. Counts toward steps.', 'move', { notify: 1, emoji: '🚶' });
      } else {
        const end = t2m('10:45');
        if (end - c >= 20) add(c, end - c, 'reel-a', 'Reel: shoot + edit', 'Distraction-free creation block before work.', 'content', { notify: 1, follow: 30, emoji: '🎬' });
      }
      add(t2m('10:45'), 30, 'desk', 'Desk ready', 'Shift 11:00 · stand-up 11:15. Top 3 priorities for today.', 'work', { notify: 1 });
      add(t2m('11:15'), 15, 'stand', 'Daily stand-up', '', 'work', { notify: 1 });
      add(t2m('11:30'), 90, 'work-am', 'Focus work', 'Meetings may land here. DMs on hold.', 'work', { info: 1 });
      meal(t2m('13:00'), 60, 'lunch');
      add(t2m('14:00'), 120, 'work-pm1', 'Focus work', 'Short walk every hour you can.', 'work', { info: 1 });
      meal(t2m('16:00'), 15, 'snack');
      add(t2m('16:15'), 45, 'reel-b', 'Reel: post + reply', 'Caption, post to IG + YouTube Shorts, reply to comments. Use any free gap.', 'content', { notify: 1, follow: 30, emoji: '📲', flex: 1 });
      const fri = dow === 5;
      if (fri) add(t2m('17:00'), 30, 'long-plan', 'Plan the long video', 'Topic, title, thumbnail idea, shot list. Shoot it this weekend.', 'content', { notify: 1, emoji: '📝' });
      add(t2m(fri ? '17:30' : '17:00'), t2m('20:00') - t2m(fri ? '17:30' : '17:00'), 'work-pm2', 'Focus work', 'Shift ends 20:00.', 'work', { info: 1 });
      let d;
      if (office) {
        d = add(t2m('20:00'), 25, 'commute-out', 'Commute home', 'Walk it if the weather is fine.', 'move', { notify: 1, emoji: '🚶' });
        d = meal(d + 5, 30, 'dinner');
        d = add(d, 50, 'walk', 'Night walk', WALK_SUB, 'move', { notify: 1, follow: 30, emoji: '👟' });
      } else {
        d = meal(t2m('20:00'), 30, 'dinner');
        d = add(d, 60, 'walk', 'Night walk · 10K push', WALK_SUB, 'move', { notify: 1, follow: 30, emoji: '👟' });
      }
      const bed = t2m(p.bed);
      if (bed - d >= 15) add(d, bed - d, 'wind', 'Wind-down', 'Screens off, 10 min stretch, plan tomorrow.', 'rest', { notify: 1 });
      add(d, 0, 'steps', `Hit ${F.stepGoal(key, st).toLocaleString('en-IN')} steps`, 'Auto-ticks from your step count.', 'move', { auto: 'steps', target: 1 });
      add(d, 0, 'water', 'Drink 3.5 L water', 'Auto-ticks from the water counter.', 'life', { auto: 'water', target: 1 });
      add(bed, 0, 'bed', 'Lights out', `Asleep by ${F.fmt12(p.bed)} · wake ${F.fmt12(p.wake)} = ${((24 * 60 - bed + W) / 60).toFixed(1)} h sleep`, 'sleep', { notify: 1, emoji: '🌙' });
    } else {
      const W = t2m(p.wake) + 45;
      let c = add(W, 10, 'wake', 'Wake up', 'Weekend: a small lie-in, still early.', 'sleep', { notify: 1, emoji: '☀️' });
      c = add(c, 5, 'weigh', 'Weigh-in', 'Same scale, same time.', 'life', { notify: 1, auto: 'weigh', emoji: '⚖️' });
      if (dow === 6) {
        c = meal(c, 15, 'pre');
        c = add(c, 90, 'gym', 'Gym · ' + wo.name, wo.focus, 'move', { notify: 1, follow: 30, emoji: '🏋️', workout: true });
        c = meal(c, 15, 'post');
        c = meal(Math.max(c, t2m('09:00')), 30, 'bfast');
      } else {
        c = add(c, 20, 'mobility', 'Mobility + stretch', wo.focus, 'move', { notify: 1, follow: 30, emoji: '🧘', workout: true });
        c = meal(Math.max(c, t2m('08:00')), 30, 'bfast');
      }
      const second = p.twoLong; // optional second long video
      if (travel) {
        add(t2m('09:30'), 240, 'explore', home ? 'Local outing + vlog' : 'Hyderabad explore + vlog', `Goal ${F.stepGoal(key, st).toLocaleString('en-IN')} steps. Carry water, shoot b-roll for the long video.`, 'life', { notify: 1, follow: 60, emoji: '🧭' });
        meal(t2m('13:30'), 45, 'lunch');
        add(t2m('14:15'), 135, 'explore2', 'Keep exploring', 'Keep the steps ticking. Stop for a coffee-free break.', 'life', { info: 1 });
        meal(t2m('16:30'), 15, 'snack');
        add(t2m('17:15'), 45, 'reel-a', 'Reel: pick clip + edit', 'Best moment of the day, cut it down.', 'content', { notify: 1, emoji: '🎬' });
        add(t2m('18:00'), 15, 'reel-b', 'Reel: post', 'IG + YouTube Shorts.', 'content', { notify: 1, follow: 30, emoji: '📲', flex: 1 });
        if (dow === 0) {
          add(t2m('18:15'), 75, 'long-edit', 'Long video: edit', 'Cut the vlog, thumbnail, title.', 'content', { notify: 1, emoji: '✂️' });
          add(t2m('19:30'), 20, 'long-upload', 'Long video: upload to YouTube', 'Title, description, thumbnail. Hit publish.', 'content', { notify: 1, follow: 30, emoji: '▶️' });
        } else {
          add(t2m('18:15'), 105, 'long-edit', 'Long video: edit', 'Rough cut tonight, finish tomorrow.', 'content', { notify: 1, emoji: '✂️' });
        }
      } else {
        if (dow === 6) add(t2m('10:00'), 150, 'long-shoot', 'Long video: shoot', 'Record the full video. Batch b-roll too.', 'content', { notify: 1, follow: 30, emoji: '🎥' });
        else add(t2m('10:00'), 150, 'long-edit', 'Long video: edit', 'Cut, captions, thumbnail.', 'content', { notify: 1, emoji: '✂️' });
        meal(t2m('13:30'), 45, 'lunch');
        if (second && dow === 6) {
          add(t2m('14:30'), 120, 'long2', 'Long video #2: shoot + edit', 'Optional second video of the week.', 'content', { notify: 1, emoji: '🎥' });
          meal(t2m('16:30'), 15, 'snack');
          add(t2m('16:45'), 45, 'reel-a', 'Reel: shoot + edit', '', 'content', { notify: 1, emoji: '🎬' });
          add(t2m('17:30'), 15, 'reel-b', 'Reel: post', 'IG + YouTube Shorts.', 'content', { notify: 1, follow: 30, emoji: '📲', flex: 1 });
        } else {
          add(t2m('14:30'), 60, 'reel-a', 'Reel: shoot + edit', '', 'content', { notify: 1, emoji: '🎬' });
          add(t2m('15:30'), 20, 'reel-b', 'Reel: post', 'IG + YouTube Shorts.', 'content', { notify: 1, follow: 30, emoji: '📲', flex: 1 });
          meal(t2m('16:00'), 15, 'snack');
          if (dow === 6) add(t2m('16:30'), 120, 'long-edit', 'Long video: edit', 'Rough cut today, finish tomorrow.', 'content', { notify: 1, emoji: '✂️' });
          else add(t2m('17:00'), 20, 'long-upload', 'Long video: upload to YouTube', 'Title, description, thumbnail. Hit publish.', 'content', { notify: 1, follow: 30, emoji: '▶️' });
        }
        if (dow === 0) {
          if (second) add(t2m('17:30'), 120, 'long2', 'Long video #2: shoot + edit + upload', 'Optional second video of the week.', 'content', { notify: 1, emoji: '🎥' });
          add(t2m(second ? '19:30' : '18:00'), 30, 'review-week', 'Weekly review', 'Wins, misses, next week plan. Check Insights.', 'life', { notify: 1, emoji: '📊' });
        }
      }
      let d = meal(t2m('20:00'), 30, 'dinner');
      d = add(d, 60, 'walk', 'Night walk', WALK_SUB, 'move', { notify: 1, follow: 30, emoji: '👟' });
      const bed = t2m(p.bed);
      if (bed - d >= 15) add(d, bed - d, 'wind', 'Wind-down', 'Screens off, stretch, plan the week.', 'rest', { notify: 1 });
      add(d, 0, 'steps', `Hit ${F.stepGoal(key, st).toLocaleString('en-IN')} steps`, 'Auto-ticks from your step count.', 'move', { auto: 'steps', target: 1 });
      add(d, 0, 'water', 'Drink 3.5 L water', 'Auto-ticks from the water counter.', 'life', { auto: 'water', target: 1 });
      add(bed, 0, 'bed', 'Lights out', `Asleep by ${F.fmt12(p.bed)}`, 'sleep', { notify: 1, emoji: '🌙' });
    }

    // recurring venue-shoot commitment: surface on weekend afternoons when a visit is due
    if (wkend && F.witchDue(key, st).visitDue) {
      add(t2m('15:00'), 90, 'witch', st.commit.wcName || 'Venue shoot', `Shoot there, then post within ${st.commit.wcEvery} days.`, 'content', { notify: 1, follow: 30, emoji: '📍' });
    }
    // custom blocks in the order of time
    B.sort((a, b) => a.s - b.s || (a.info ? -1 : 0));
    return B;
  };

  /* ---------- commitments ---------- */
  F.witchDue = (key, st) => {
    const c = st.commit;
    const sinceVisit = c.wcVisit ? F.diffDays(c.wcVisit, key) : null;
    const sincePost = c.wcPost ? F.diffDays(c.wcPost, key) : null;
    return {
      sinceVisit, sincePost,
      visitDue: sinceVisit === null ? false : sinceVisit >= c.wcInterval,
      postDue: sincePost === null ? false : sincePost >= c.wcEvery,
      nextVisit: c.wcVisit ? F.addDays(c.wcVisit, c.wcInterval) : null
    };
  };

  /* ---------- completion helpers ---------- */
  F.status = (key, b, st) => {
    const d = st.done[key] && st.done[key][b.id];
    if (d) return d;
    if (b.auto === 'weigh' && st.weights[key]) return 'done';
    if (b.auto === 'steps' && (st.steps[key] || 0) >= F.stepGoal(key, st)) return 'done';
    if (b.auto === 'water' && (st.water[key] || 0) >= 3500) return 'done';
    if (b.meal && st.meals[key] && st.meals[key][b.meal]) return 'done';
    return null;
  };
  F.isDone = (key, b, st) => !!F.status(key, b, st);
  F.dayProgress = (key, st, blocks) => {
    const list = (blocks || F.buildDay(key, st)).filter((b) => !b.info);
    const done = list.filter((b) => F.status(key, b, st) === 'done').length;
    return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  };
  F.longVideosThisWeek = (key, st) => {
    const ws = F.weekStart(key);
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = st.done[F.addDays(ws, i)] || {};
      if (d['long-upload'] === 'done') n++;
      if (d['long2'] === 'done') n++;
    }
    return n;
  };
  F.reelStreak = (key, st) => {
    let n = 0; let k = key;
    // today may not be done yet; start from yesterday in that case
    if (!(st.done[k] && st.done[k]['reel-b'] === 'done')) k = F.addDays(k, -1);
    while (st.done[k] && st.done[k]['reel-b'] === 'done') { n++; k = F.addDays(k, -1); }
    return n;
  };
  F.dayNumber = (st, key) => F.diffDays(st.profile.startDate, key || F.dk()) + 1;

  /* ---------- notifications content ---------- */
  F.alertText = (b, kind) => {
    const e = b.emoji || (b.meal ? '🍽️' : '⏰');
    if (kind === 'check') {
      return { title: `Did you do it? ${e}`, body: `${b.title} was at ${F.fmt12(b.t)}. Tap Done if it's ticked off, or Skip.` };
    }
    if (b.meal) return { title: `${e || '🍽️'} ${b.title}: time to eat`, body: `~${b.p} g protein planned. Snap a photo and I'll log it.` };
    if (b.id === 'gym') return { title: `🏋️ ${b.title}`, body: 'Warm up, then lift with intent. Chest and core are the priority.' };
    if (b.id === 'bed') return { title: '🌙 Lights out', body: 'Sleep is where the fat loss and muscle gain actually happen.' };
    if (b.id === 'weigh') return { title: '⚖️ Weigh-in', body: 'Step on the scale and log it. Trends beat single days.' };
    return { title: `${e} ${b.title}`, body: b.sub || F.fmt12(b.t) };
  };
  F.alertActions = (b) => b.meal
    ? [{ action: 'photo', title: '📸 Add photo' }, { action: 'done', title: '✅ Ate it' }]
    : [{ action: 'done', title: '✅ Done' }, { action: 'skip', title: '⏭ Skip' }];

  // alerts for the next ~2 days, minus anything already done/skipped
  F.alerts = (st, fromTs, days = 2) => {
    const out = [];
    const startKey = F.dk(new Date(fromTs));
    for (let i = 0; i <= days; i++) {
      const key = F.addDays(startKey, i);
      const base = F.parse(key).getTime();
      F.buildDay(key, st).forEach((b) => {
        if (!b.notify || F.isDone(key, b, st)) return;
        const mk = (offsetMin, kind) => {
          const at = base + (b.s + offsetMin) * 60000;
          if (at < fromTs - 6 * 3600e3) return;
          const tx = F.alertText(b, kind);
          out.push({ at, tag: `${key}:${b.id}:${kind}`, key, id: b.id, kind, title: tx.title, body: tx.body, actions: F.alertActions(b) });
        };
        mk(0, 'start');
        if (b.follow) mk(b.follow, 'check');
      });
      (st.tasks || []).forEach((t) => {
        if (t.done || !t.notify || t.date !== key || !t.time) return;
        const at = base + t2m(t.time) * 60000;
        out.push({ at, tag: `task:${t.id}`, key, id: 'task:' + t.id, kind: 'task', title: '🔔 Reminder', body: t.title, actions: [{ action: 'done', title: '✅ Done' }, { action: 'skip', title: '⏭ Later' }] });
      });
    }
    return out.sort((a, b) => a.at - b.at);
  };

  /* ---------- encouragement ---------- */
  F.PRAISE = {
    move: ['Beast mode. That session is banked 💪', 'Another rep for the new you.', 'Showing up is the whole game.'],
    food: ['Fuel logged. That is how you keep the muscle while the fat leaves.', 'Protein on point. Nice.', 'Clean plate, clear goal.'],
    content: ['Posted is better than perfect. Consistency wins 365.', 'Another brick in the channel.', 'The algorithm loves a creator who shows up.'],
    sleep: ['Recovery is training too.', 'Good call. Your body does the real work tonight.'],
    life: ['Logged. Trends beat guesses.', 'Small check, big picture.'],
    rest: ['Calm close to the day. Nice.'],
    work: ['Done and dusted.']
  };
  F.praise = (cat) => { const a = F.PRAISE[cat] || F.PRAISE.life; return a[Math.floor(Math.random() * a.length)]; };
})();
