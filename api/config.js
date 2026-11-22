// GET /api/config -> the public VAPID key the browser needs to subscribe to push (public by design)
const { vapidKeys } = require('./_lib/kv.js');
const { send, route } = require('./_lib/http.js');

module.exports = route('GET', async (req, res) => {
  const keys = await vapidKeys();
  send(res, 200, { publicKey: keys.pub });
}, { auth: false });
