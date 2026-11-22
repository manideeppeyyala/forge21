/* Forge21 — training program, exercise library and load maths (pure logic, no DOM)

   How the numbers are built (so nothing is a random guess):
   - Weekly volume: 10–20 hard sets per muscle per week. Schoenfeld, Ogborn & Krieger 2017 (J Sports Sci) dose–response meta-analysis.
     In a calorie deficit the plan sits at ~12–16 sets: enough to grow, recoverable on less food.
   - Frequency: every major muscle trained 2× a week (Schoenfeld, Ogborn & Krieger 2016, Sports Med).
   - Effort: sets end 1–3 reps short of failure (RIR). Compounds at ~2 RIR, isolation at ~1 RIR (Refalo et al. 2023, proximity-to-failure).
   - Rest: 2–3 min on big compounds, 60–90 s on isolation (Schoenfeld et al. 2016, J Strength Cond Res: longer rest = more growth).
   - Progression: double progression. Stay at one weight until every set hits the top of the rep range, then add the smallest jump.
   - Starting loads: estimated 1-rep max = lean body mass (Boer 1984 formula) × a per-lift strength ratio × experience × sex factor.
     The working weight then comes from the Epley formula (1RM = w × (1 + reps/30)) solved for "bottom of the rep range + RIR".
     Lean mass is used instead of body weight because fat mass does not lift; body-weight ratios overestimate for anyone carrying extra fat.
     These are first-session estimates. Once you log a set, your own numbers replace the estimate. */
(function () {
  const F = (window.F = window.F || {});

  /* ---------- exercise library ----------
     eq: bb barbell (total kg incl. 20 kg bar) · ez EZ bar (total) · db dumbbell (per hand) · machine · cable · bw bodyweight · time · cardio
     m: primary muscle (counts 1 set) · s: secondary muscles (count ½ set) · r: male, new-lifter 1RM as a fraction of lean mass (null = no kg estimate)
     low: lower-body lift (bigger jumps, smaller sex gap) */
  F.EX = {
    inclineDb: { n: 'Incline dumbbell press', eq: 'db', m: 'chest', s: ['shoulders', 'triceps'], r: 0.25, how: ['Bench at 30°. Higher angles turn it into a shoulder press.', 'Lower for 2–3 s to the outside of the upper chest, elbows ~45° from your body.', 'Press up and slightly in. Do not clank the dumbbells.'] },
    benchBb: { n: 'Flat barbell bench press', eq: 'bb', m: 'chest', s: ['triceps', 'shoulders'], r: 0.85, how: ['Eyes under the bar, shoulder blades squeezed back and down, feet planted.', 'Lower to the lower chest in 2 s, touch, no bounce.', 'Always use a spotter or safety pins near failure.'] },
    flyCable: { n: 'Cable fly or pec-deck', eq: 'cable', m: 'chest', s: [], r: null, how: ['Soft bend in the elbows, fixed through the whole rep.', 'Open wide until you feel a deep chest stretch, pause 1 s.', 'Bring the hands together by squeezing the chest, not by bending the arms.'] },
    ohExt: { n: 'Overhead cable triceps extension', eq: 'cable', m: 'triceps', s: [], r: null, how: ['Face away from the cable, rope behind your head.', 'Elbows point forward and stay still. Only the forearms move.', 'Overhead position stretches the long head: the biggest part of the triceps.'] },
    pushdown: { n: 'Rope pushdown', eq: 'cable', m: 'triceps', s: [], r: null, how: ['Elbows pinned to your sides.', 'Push down and split the rope at the bottom.', 'Control the way up for 2 s.'] },
    cableCrunch: { n: 'Cable crunch', eq: 'cable', m: 'abs', s: [], r: null, how: ['Kneel, rope beside your head, hips stay still.', 'Curl your ribs toward your pelvis. Round the spine, do not just bow at the hips.', 'Belly fat leaves through the deficit. This builds the muscle underneath.'] },
    pulldown: { n: 'Lat pulldown', eq: 'machine', m: 'back', s: ['biceps'], r: null, how: ['Grip just outside shoulder width, slight lean back.', 'Drive the elbows down to your ribs, bar to the upper chest.', 'Let the arms fully straighten at the top for the stretch.'] },
    cableRow: { n: 'Seated cable row', eq: 'cable', m: 'back', s: ['biceps'], r: null, how: ['Chest tall, slight knee bend.', 'Pull the handle to the lower ribs, squeeze the shoulder blades together.', 'Reach forward at the end of each rep to stretch the back. Keep the torso still.'] },
    dbRow: { n: 'One-arm dumbbell row', eq: 'db', m: 'back', s: ['biceps'], r: 0.35, how: ['One hand and knee on the bench, back flat.', 'Pull the dumbbell toward your hip, not your chest.', 'Full stretch at the bottom, no torso twisting.'] },
    facePull: { n: 'Face pull', eq: 'cable', m: 'reardelt', s: ['back'], r: null, how: ['Rope at face height, thumbs pointing back.', 'Pull toward your forehead and spread the rope apart.', 'Great for posture after desk hours.'] },
    ezCurl: { n: 'EZ-bar curl', eq: 'ez', m: 'biceps', s: [], r: 0.4, how: ['Elbows by your sides, no swinging.', 'Curl up, squeeze 1 s, lower in 2–3 s.', 'If you have to lean back, the weight is too heavy.'] },
    hammer: { n: 'Hammer curl', eq: 'db', m: 'biceps', s: ['forearms'], r: 0.17, how: ['Thumbs up the whole time.', 'Curl across the body or straight up, elbows still.', 'Builds the brachialis, which makes the arm look thicker.'] },
    kneeRaise: { n: 'Hanging knee raise', eq: 'bw', m: 'abs', s: [], r: null, how: ['Hang still, no swinging.', 'Bring the knees up and curl the pelvis toward the chest.', 'Lower slowly. Too hard? Do it on a captain\'s chair.'] },
    squat: { n: 'Back squat (or leg press)', eq: 'bb', m: 'quads', s: ['glutes'], r: 1.0, low: true, how: ['Bar on the upper back, feet shoulder width, toes slightly out.', 'Sit down between your heels to at least thigh-parallel, knees track over the toes.', 'Use safety pins. On leg press, go as deep as you can without your lower back lifting.'] },
    rdl: { n: 'Romanian deadlift', eq: 'bb', m: 'hams', s: ['glutes', 'back'], r: 0.9, low: true, how: ['Soft knees, push the hips back like closing a car door with your bum.', 'Bar slides down the thighs to mid-shin, back flat.', 'Stop when the hamstrings are fully stretched, then drive the hips forward.'] },
    legExt: { n: 'Leg extension', eq: 'machine', m: 'quads', s: [], r: null, how: ['Pad on the lower shin, knee lined up with the machine pivot.', 'Lift until the legs are straight, squeeze 1 s.', 'Lower slowly for 2–3 s.'] },
    legCurl: { n: 'Leg curl (seated or lying)', eq: 'machine', m: 'hams', s: [], r: null, how: ['Seated curl is slightly better: the hamstring is stretched at the hip.', 'Curl fully, squeeze, then control the way back.', 'Do not let the hips lift off the pad.'] },
    calfStand: { n: 'Standing calf raise', eq: 'machine', m: 'calves', s: [], r: null, how: ['Full stretch at the bottom, pause 2 s. That pause is where calves grow.', 'Rise onto the big toe, pause at the top.', 'No bouncing.'] },
    plank: { n: 'Plank', eq: 'time', m: 'abs', s: [], r: null, how: ['Forearms under shoulders, body in one straight line.', 'Squeeze glutes and brace like someone is about to poke your belly.', 'Stop the set when the hips start to sag.'] },
    dbPress: { n: 'Seated dumbbell shoulder press', eq: 'db', m: 'shoulders', s: ['triceps'], r: 0.17, how: ['Bench upright, back supported.', 'Lower to ear level, elbows slightly in front of the body.', 'Press up without locking out hard.'] },
    latRaise: { n: 'Lateral raise', eq: 'db', m: 'sidedelt', s: [], r: 0.07, how: ['Slight forward lean, lead with the elbows.', 'Raise to shoulder height, not higher.', 'Light weight and strict form. Side delts give the "wide" look.'] },
    rearFly: { n: 'Rear-delt fly', eq: 'db', m: 'reardelt', s: ['back'], r: 0.06, how: ['Hinge forward with a flat back, or use the reverse pec-deck.', 'Sweep the arms out wide, pinkies leading.', 'Do not squeeze the shoulder blades. Let the rear delts do it.'] },
    shrug: { n: 'Dumbbell shrug', eq: 'db', m: 'traps', s: [], r: 0.45, how: ['Arms straight, shoulders straight up toward the ears.', 'Pause 1 s at the top.', 'No rolling.'] },
    abWheel: { n: 'Ab wheel rollout', eq: 'bw', m: 'abs', s: [], r: null, how: ['Start from the knees, ribs pulled down.', 'Roll out only as far as you can without the lower back arching.', 'Pull back with the abs, not the hips.'] },
    pallof: { n: 'Pallof press', eq: 'cable', m: 'abs', s: [], r: null, how: ['Stand side-on to the cable, handle at the chest.', 'Press straight out and resist the twist for 2 s.', 'Anti-rotation core work: safer for the spine than Russian twists.'] },
    inclineMachine: { n: 'Incline machine press', eq: 'machine', m: 'chest', s: ['shoulders', 'triceps'], r: null, how: ['Seat so the handles start at upper-chest height.', 'Press, then control the way back for 2–3 s.', 'Get a full stretch at the bottom.'] },
    chestMachine: { n: 'Machine chest press', eq: 'machine', m: 'chest', s: ['triceps'], r: null, how: ['Handles at mid-chest height.', 'Shoulder blades back against the pad.', 'Last set: go to 0–1 reps in reserve. Machines make failure safe.'] },
    flyLowHigh: { n: 'Low-to-high cable fly', eq: 'cable', m: 'chest', s: [], r: null, how: ['Cables set low, sweep up to chin height.', 'Targets the upper chest fibres.', 'Pause and squeeze at the top.'] },
    pullup: { n: 'Pull-up (assisted if needed)', eq: 'bw', m: 'back', s: ['biceps'], r: null, how: ['Use the assisted machine or a band so you get the rep range with good form.', 'Chest to the bar, full hang at the bottom.', 'Reduce the assistance as you get stronger.'] },
    wideRow: { n: 'Wide-grip cable row', eq: 'cable', m: 'back', s: ['reardelt'], r: null, how: ['Wide bar, pull to the lower chest with elbows flared ~60°.', 'Hits the upper back and rear delts.', 'Squeeze 1 s, then stretch forward.'] },
    hipThrust: { n: 'Barbell hip thrust', eq: 'bb', m: 'glutes', s: ['hams'], r: 1.1, low: true, how: ['Upper back on the bench, bar on the hip crease with a pad.', 'Drive through the heels, chin tucked, ribs down.', 'Squeeze the glutes for 1 s at the top. Do not arch the lower back.'] },
    bss: { n: 'Bulgarian split squat', eq: 'db', m: 'quads', s: ['glutes'], r: 0.2, low: true, how: ['Rear foot on a bench, front foot far enough forward that the heel stays down.', 'Drop the back knee straight down.', 'Do your weaker leg first, match the reps on the other.'] },
    legPress: { n: 'Leg press', eq: 'machine', m: 'quads', s: ['glutes'], r: null, low: true, how: ['Feet mid-platform, shoulder width.', 'Lower until just before the lower back lifts off the pad.', 'Do not lock the knees out hard at the top.'] },
    calfSeat: { n: 'Seated calf raise', eq: 'machine', m: 'calves', s: [], r: null, how: ['Bent knee hits the soleus, the deeper calf muscle.', 'Full stretch, 2 s pause at the bottom.', 'Rise fully onto the toes.'] },
    legRaise: { n: 'Lying leg raise', eq: 'bw', m: 'abs', s: [], r: null, how: ['Hands under the hips, lower back pressed into the floor.', 'Raise straight legs to vertical, lower slowly.', 'Bend the knees if the lower back lifts.'] },
    inclineWalk: { n: 'Incline treadmill walk', eq: 'cardio', m: 'cardio', s: [], r: null, how: ['Incline 8–12%, speed 4.5–5.5 km/h. No holding the rails.', 'Stay in Zone 2: you can talk in full sentences but would rather not.', 'Burns fat without eating into leg recovery.'] },
    mobility: { n: 'Hip + thoracic mobility', eq: 'time', m: 'mobility', s: [], r: null, how: ['90/90 hip switches, couch stretch, open books, cat-cow.', '30–60 s per position, breathe slowly.', 'Helps posture after long desk hours.'] },
    foam: { n: 'Easy stretch / foam roll', eq: 'time', m: 'mobility', s: [], r: null, how: ['Quads, glutes, upper back, lats.', 'Slow passes, pause on tight spots.', 'Should feel like a massage, not torture.'] },
    walkLong: { n: 'Long walk', eq: 'cardio', m: 'cardio', s: [], r: null, how: ['Rest day still counts for steps.', 'Easy pace, outdoors if you can.', 'Active recovery: blood flow without fatigue.'] }
  };

  /* ---------- weekly program ----------
     each exercise: [id, sets, repLow, repHigh, RIR, rest seconds]   (reps are seconds for 'time', minutes for 'cardio') */
  F.WORKOUTS = {
    1: { name: 'Chest + Triceps', focus: 'Heavy chest day · upper-chest priority', ex: [
      ['inclineDb', 3, 6, 10, 2, 150], ['benchBb', 3, 6, 8, 2, 180], ['flyCable', 3, 10, 15, 1, 90],
      ['ohExt', 3, 10, 15, 1, 75], ['pushdown', 2, 12, 15, 1, 60], ['cableCrunch', 3, 10, 15, 1, 60]] },
    2: { name: 'Back + Biceps', focus: 'Posture and a wider frame', ex: [
      ['pulldown', 3, 8, 12, 2, 150], ['cableRow', 3, 8, 12, 2, 150], ['dbRow', 2, 8, 12, 2, 120],
      ['facePull', 3, 12, 20, 1, 60], ['ezCurl', 3, 8, 12, 1, 90], ['hammer', 2, 10, 15, 1, 60], ['kneeRaise', 3, 10, 15, 1, 60]] },
    3: { name: 'Legs A · quads', focus: 'Biggest calorie burn of the week', ex: [
      ['squat', 4, 6, 10, 2, 180], ['rdl', 3, 6, 10, 2, 180], ['legExt', 3, 10, 15, 1, 90],
      ['legCurl', 3, 10, 15, 1, 90], ['calfStand', 4, 8, 12, 1, 60], ['plank', 3, 30, 60, 1, 60]] },
    4: { name: 'Shoulders + Core', focus: 'Capped shoulders make the waist look smaller', ex: [
      ['dbPress', 3, 6, 10, 2, 150], ['latRaise', 4, 12, 20, 1, 60], ['rearFly', 3, 12, 20, 1, 60],
      ['shrug', 2, 10, 15, 1, 75], ['abWheel', 3, 8, 12, 1, 75], ['pallof', 3, 10, 12, 1, 45]] },
    5: { name: 'Chest + Back · volume', focus: 'Second chest and back session of the week', ex: [
      ['inclineMachine', 3, 8, 12, 2, 120], ['chestMachine', 2, 10, 12, 1, 90], ['flyLowHigh', 2, 12, 15, 1, 60],
      ['pullup', 3, 6, 10, 2, 150], ['wideRow', 3, 10, 12, 1, 90], ['latRaise', 3, 12, 20, 1, 60], ['pushdown', 2, 10, 15, 1, 60]] },
    6: { name: 'Legs B · glutes + abs', focus: 'Second leg day, then core and Zone 2', ex: [
      ['hipThrust', 3, 8, 12, 2, 150], ['bss', 3, 8, 12, 2, 120], ['legPress', 3, 10, 15, 1, 120],
      ['legCurl', 3, 10, 15, 1, 90], ['calfSeat', 3, 10, 15, 1, 60], ['legRaise', 3, 10, 15, 1, 60], ['inclineWalk', 1, 15, 20, 0, 0]] },
    0: { name: 'Rest + mobility', focus: 'No lifting. Muscles grow while you recover.', rest: true, ex: [
      ['mobility', 1, 600, 600, 0, 0], ['foam', 1, 600, 600, 0, 0], ['walkLong', 1, 45, 90, 0, 0]] }
  };

  F.MUSCLES = { chest: 'Chest', back: 'Back (lats + mid)', shoulders: 'Front delts', sidedelt: 'Side delts', reardelt: 'Rear delts', triceps: 'Triceps', biceps: 'Biceps', quads: 'Quads', hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs', traps: 'Traps' };
  // weekly hard-set range that is worth aiming for, per muscle, in a deficit
  F.VOL_BAND = { chest: [12, 18], back: [12, 18], sidedelt: [8, 16], reardelt: [6, 14], triceps: [6, 14], biceps: [6, 14], quads: [10, 18], hams: [8, 16], glutes: [6, 16], calves: [6, 14], abs: [6, 18], shoulders: [4, 12], traps: [0, 10] };

  F.EXP = { new: { label: 'New · under 6 months', mult: 1 }, some: { label: '6 months – 2 years', mult: 1.3 }, pro: { label: '2+ years', mult: 1.6 } };

  /* ---------- body numbers ---------- */
  F.curWeight = (st) => { const ws = Object.keys(st.weights).sort(); return ws.length ? st.weights[ws[ws.length - 1]] : st.profile.startWeight; };
  // lean body mass, Boer (1984). Never more than 90% of body weight, never below 55%.
  F.lbm = (st) => {
    const p = st.profile, w = F.curWeight(st), h = p.heightCm;
    const v = p.sex === 'f' ? 0.252 * w + 0.473 * h - 48.3 : 0.407 * w + 0.267 * h - 19.2;
    return Math.max(w * 0.55, Math.min(w * 0.9, v));
  };
  F.hrMax = (age) => Math.round(208 - 0.7 * age); // Tanaka 2001, more accurate than 220 − age
  F.zone2 = (age) => { const m = F.hrMax(age); return [Math.round(m * 0.6), Math.round(m * 0.7)]; };

  /* ---------- load maths ---------- */
  const roundDown = (kg, eq) => {
    if (eq === 'bb') return Math.max(20, Math.floor(kg / 2.5) * 2.5);
    if (eq === 'ez') return Math.max(10, Math.floor(kg / 2.5) * 2.5);
    if (eq === 'db') return Math.max(2, kg < 10 ? Math.floor(kg) : Math.floor(kg / 2.5) * 2.5);
    return Math.round(kg);
  };
  F.roundLoad = roundDown;
  F.estimate1RM = (id, st) => {
    const ex = F.EX[id]; if (!ex || !ex.r) return null;
    const p = st.profile;
    const sexF = p.sex === 'f' ? (ex.low ? 0.7 : 0.55) : 1;
    const expF = (F.EXP[p.exp] || F.EXP.new).mult;
    return F.lbm(st) * ex.r * sexF * expF;
  };
  // weight for "bottom of the rep range with RIR reps left" (Epley, solved for weight)
  F.loadFor = (oneRM, reps, rir) => oneRM / (1 + (reps + rir) / 30);
  F.jump = (ex) => (ex.eq === 'bb' ? (ex.low ? 5 : 2.5) : ex.eq === 'ez' ? 2.5 : ex.eq === 'db' ? 2 : 0);

  F.lastLog = (id, st) => { const l = (st.lifts || {})[id]; return l && l.length ? l[l.length - 1] : null; };

  /* the recommendation for one exercise today:
     { kind: 'est'|'log'|'feel'|'bw'|'time'|'cardio', kg, text, why } */
  F.recommend = (item, st) => {
    const [id, sets, lo, hi, rir] = item;
    const ex = F.EX[id];
    if (ex.eq === 'time') return { kind: 'time', text: lo === hi ? `${Math.round(lo / 60)} min` : `${lo}–${hi} s holds`, why: 'Time-based. Stop the set when form breaks.' };
    if (ex.eq === 'cardio') return { kind: 'cardio', text: `${lo}–${hi} min`, why: 'Zone 2 pace. See the cardio card for your heart-rate range.' };
    const last = F.lastLog(id, st);
    if (last && last.w > 0) {
      const reps = last.r.filter((x) => x > 0);
      const allTop = reps.length >= sets && reps.slice(0, sets).every((x) => x >= hi);
      const anyLow = reps.some((x) => x < lo);
      const j = F.jump(ex);
      if (allTop) {
        const nk = j ? last.w + j : last.w;
        return { kind: 'log', kg: nk, text: j ? `${fmtKg(nk)} kg${ex.eq === 'db' ? ' each' : ''} × ${lo}–${hi}` : `Next plate up × ${lo}–${hi}`, why: `Last time ${fmtKg(last.w)} kg × ${reps.join(', ')}: every set hit ${hi}. Add the smallest jump and build the reps back up.` };
      }
      if (anyLow && reps.filter((x) => x < lo).length >= 2) {
        const nk = ex.eq === 'machine' || ex.eq === 'cable' || ex.eq === 'bw' ? last.w : roundDown(last.w * 0.92, ex.eq);
        return { kind: 'log', kg: nk, text: `${fmtKg(nk)} kg${ex.eq === 'db' ? ' each' : ''} × ${lo}–${hi}`, why: `Last time ${fmtKg(last.w)} kg × ${reps.join(', ')}: two or more sets fell below ${lo}. ${nk < last.w ? 'Drop about 8% and own the range.' : 'Use one plate lighter and own the range.'}` };
      }
      return { kind: 'log', kg: last.w, text: `${fmtKg(last.w)} kg${ex.eq === 'db' ? ' each' : ''} × ${lo}–${hi}`, why: `Last time ${fmtKg(last.w)} kg × ${reps.join(', ')}. Same weight, beat at least one rep.` };
    }
    if (ex.eq === 'bw') return { kind: 'bw', text: `${lo}–${hi} reps`, why: `Bodyweight. If you get more than ${hi} with ${rir} left in the tank, make it harder (slower, pause, or add weight). If you cannot get ${lo}, use assistance.` };
    const orm = F.estimate1RM(id, st);
    if (orm) {
      const kgv = roundDown(F.loadFor(orm, lo, rir), ex.eq);
      return { kind: 'est', kg: kgv, text: `~${fmtKg(kgv)} kg${ex.eq === 'db' ? ' each' : ''} × ${lo}–${hi}`, why: `First-session estimate from your lean mass (~${Math.round(F.lbm(st))} kg) and experience. Aim for ${lo} reps with ${rir} still in the tank. Too easy or too hard? Adjust and log it: your log replaces this estimate.` };
    }
    return { kind: 'feel', text: `${lo}–${hi} reps`, why: `Machine and cable stacks differ between gyms, so no kg number is given. Pick the plate where you reach ${lo}–${hi} reps with ${rir} left in the tank, then log it. From then on the app tells you when to go up.` };
  };
  const fmtKg = (n) => (Math.round(n * 10) / 10).toString();
  F.fmtKg = fmtKg;

  // ramp-up sets before the first heavy lift of the day
  F.warmup = (kgv, eq) => {
    if (!kgv) return null;
    const base = eq === 'bb' ? 20 : eq === 'ez' ? 10 : 2;
    const mk = (pct, reps) => ({ kg: Math.max(base, roundDown(kgv * pct, eq)), reps });
    const out = [mk(0.5, 8), mk(0.7, 5), mk(0.85, 2)];
    return out.filter((x, i) => i === 0 || x.kg > out[i - 1].kg);
  };

  /* ---------- weekly totals ---------- */
  F.weekVolume = () => {
    const v = {};
    Object.values(F.WORKOUTS).forEach((d) => d.ex.forEach(([id, sets]) => {
      const ex = F.EX[id]; if (!F.MUSCLES[ex.m]) return;
      v[ex.m] = (v[ex.m] || 0) + sets;
      ex.s.forEach((m) => { if (F.MUSCLES[m]) v[m] = (v[m] || 0) + sets / 2; });
    }));
    return v;
  };
  // rough session length: sets × (work + rest) + 10 min warm-up
  F.sessionMin = (dow) => {
    const d = F.WORKOUTS[dow];
    if (d.rest) return d.ex.reduce((a, [id, , lo, hi]) => a + (F.EX[id].eq === 'cardio' ? hi : lo / 60), 0);
    return Math.round(10 + d.ex.reduce((a, [id, sets, lo, hi, , rest]) => a + (F.EX[id].eq === 'cardio' ? hi : sets * (40 + rest) / 60), 0));
  };
  F.hardSets = (dow) => F.WORKOUTS[dow].ex.filter(([id]) => !['time', 'cardio'].includes(F.EX[id].eq)).reduce((a, x) => a + x[1], 0);
})();
