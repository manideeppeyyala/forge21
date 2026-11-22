// Storage: Upstash Redis (state, push records, owner lock, VAPID keys). Photos live in Vercel Blob (see photo.js).
// Env vars are injected automatically when you connect an Upstash Redis store to the Vercel project.
const { Redis } = require('@upstash/redis');
const { newKeys } = require('./vapid.js');

let client;
const redis = () => client || (client = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
}));

const K = {
  owner: 'f21:owner',
  vapid: 'f21:vapid',
  state: (id) => `f21:state:${id}`,
  push: (id) => `f21:push:${id}`,
  photo: (id, pid) => `f21:photo:${id}:${pid}`
};

// Single-owner lock: the first sync id to connect owns this deployment; every other id is refused.
async function isOwner(id) {
  const db = redis();
  await db.set(K.owner, { id, at: Date.now() }, { nx: true }); // no-op if someone already owns it
  const owner = await db.get(K.owner); // re-read: if two requests raced, exactly one wins
  return !!owner && owner.id === id;
}

// VAPID key pair: created on first use, kept in Redis (no env var to set).
async function vapidKeys() {
  const db = redis();
  const existing = await db.get(K.vapid);
  if (existing) return existing;
  const keys = await newKeys();
  await db.set(K.vapid, keys, { nx: true });
  return (await db.get(K.vapid)) || keys;
}

module.exports = { redis, K, isOwner, vapidKeys };
