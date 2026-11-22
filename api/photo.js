// PUT/GET /api/photo?id=pXXXX -> end-to-end ENCRYPTED photo/report blobs. The server only ever sees ciphertext.
// Bytes go to Vercel Blob (random, unguessable URL); the id -> URL map is kept in Redis; reads are proxied through
// this function so the owner check always applies.
const { put, del } = require('@vercel/blob');
const { redis, K } = require('./_lib/kv.js');
const { send, guard } = require('./_lib/http.js');

const MAX_BLOB = 4_000_000; // Vercel Functions accept request bodies up to 4.5 MB
const BLOB_URL = /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//; // only ever fetch from Vercel Blob

module.exports = async (req, res) => {
  try {
    if (req.method !== 'PUT' && req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
    const id = await guard(req, res);
    if (!id) return undefined;
    const pid = String((req.query && req.query.id) || '');
    if (!/^p[a-z0-9]{3,24}$/.test(pid)) return send(res, 400, { error: 'bad id' });
    const db = redis();
    const key = K.photo(id, pid);

    if (req.method === 'PUT') {
      const buf = Buffer.isBuffer(req.body) ? req.body : null;
      if (!buf) return send(res, 400, { error: 'bad blob' });
      if (buf.length > MAX_BLOB) return send(res, 413, { error: 'too large' });
      if (buf.length < 29) return send(res, 400, { error: 'bad blob' }); // 12-byte IV + 16-byte tag minimum
      const blob = await put(`forge21/${id.slice(0, 8)}/${pid}`, buf, { access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream' });
      const old = await db.get(key);
      await db.set(key, blob.url);
      if (typeof old === 'string' && old !== blob.url) { try { await del(old); } catch (e) { /* orphan is harmless */ } }
      return send(res, 200, { ok: true });
    }

    const url = await db.get(key);
    if (typeof url !== 'string' || !BLOB_URL.test(url)) return send(res, 404, { error: 'not found' });
    const r = await fetch(url);
    if (!r.ok) return send(res, 404, { error: 'not found' });
    const data = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(data);
  } catch (e) {
    return send(res, 500, { error: 'server error' });
  }
};
