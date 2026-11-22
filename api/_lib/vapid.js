// Web Push (VAPID) using only the Web Crypto API (Node 20+), so there are no extra dependencies.
// We send EMPTY pushes: the service worker then fetches the real alert text from /api/next,
// which avoids payload encryption entirely.
const enc = (s) => new TextEncoder().encode(s);
const b64u = (buf) => {
  let s = '';
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function newKeys() {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await subtle.exportKey('raw', kp.publicKey));
  return { jwk, pub };
}

async function vapidHeader(keys, endpoint, subject) {
  const subtle = globalThis.crypto.subtle;
  const part = (o) => b64u(enc(JSON.stringify(o)));
  const head = part({ typ: 'JWT', alg: 'ES256' });
  const body = part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject });
  const key = await subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${body}`)); // raw r||s = JOSE format
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

// returns the HTTP status from the push service (201 = accepted, 404/410 = subscription is gone)
async function sendPush(keys, sub, subject) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(keys, sub.endpoint, subject), TTL: '900', Urgency: 'high' }
  });
  return res.status;
}

module.exports = { newKeys, vapidHeader, sendPush, b64u };
