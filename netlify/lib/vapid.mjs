// Web Push (VAPID) using only the Web Crypto API, so no dependencies are needed.
// We send EMPTY pushes: the service worker then fetches the real alert text from /api/next.
// That avoids payload encryption entirely.
const enc = (s) => new TextEncoder().encode(s);
export const b64u = (buf) => {
  let s = '';
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// The keypair is created on first use and kept in Netlify Blobs, so there are no env vars to set.
export async function vapidKeys(store) {
  const existing = await store.get('vapid', { type: 'json' });
  if (existing) return existing;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const keys = { jwk, pub };
  const res = await store.setJSON('vapid', keys, { onlyIfNew: true });
  if (res && res.modified === false) return (await store.get('vapid', { type: 'json' })) || keys; // another request won the race
  return keys;
}

export async function vapidHeader(keys, endpoint, subject) {
  const part = (o) => b64u(enc(JSON.stringify(o)));
  const head = part({ typ: 'JWT', alg: 'ES256' });
  const body = part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject });
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${body}`)); // raw r||s = JOSE format
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

// returns the HTTP status from the push service (201 = accepted, 404/410 = subscription is gone)
export async function sendPush(keys, sub, subject) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(keys, sub.endpoint, subject), TTL: '900', Urgency: 'high' }
  });
  return res.status;
}
