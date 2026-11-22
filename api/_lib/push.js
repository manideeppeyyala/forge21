// Push record helpers: what we keep per user, and how incoming alerts are cleaned.
const emptyRec = () => ({ subs: [], alerts: [], sent: {}, pending: [] });

const isDone = (state, a) => {
  if (!state) return false;
  if (String(a.id).startsWith('task:')) {
    const t = (state.tasks || []).find((x) => 'task:' + x.id === a.id);
    return !!(t && t.done);
  }
  return !!(state.done && state.done[a.key] && state.done[a.key][a.id]);
};

const cleanAlert = (a) => ({
  at: Number(a.at) || 0,
  tag: String(a.tag || '').slice(0, 80),
  key: String(a.key || '').slice(0, 10),
  id: String(a.id || '').slice(0, 45),
  kind: String(a.kind || '').slice(0, 10),
  title: String(a.title || '').slice(0, 120),
  body: String(a.body || '').slice(0, 240),
  actions: Array.isArray(a.actions)
    ? a.actions.slice(0, 2).map((x) => ({ action: ['done', 'skip', 'photo'].includes(x && x.action) ? x.action : 'done', title: String((x && x.title) || '').slice(0, 30) }))
    : []
});

module.exports = { emptyRec, isDone, cleanAlert };
