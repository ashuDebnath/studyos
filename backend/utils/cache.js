/**
 * Lightweight LRU cache — no Redis needed for a single-instance deployment.
 * Keys expire after `ttlMs`. Max `capacity` items; evicts least-recently-used.
 *
 * Usage:
 *   const cache = require('./cache');
 *   cache.set('key', value, 60_000);   // 60 s TTL
 *   const val = cache.get('key');       // null if missing/expired
 */

class LRUCache {
  constructor(capacity = 500) {
    this.capacity = capacity;
    this.map = new Map(); // key → { value, expiresAt }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.map.delete(key); return null; }
    // Refresh recency
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = 5 * 60 * 1000) {
    if (this.map.has(key)) this.map.delete(key); // remove to re-insert at end
    if (this.map.size >= this.capacity) {
      // Evict oldest (first item in Map insertion order)
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key)   { this.map.delete(key); }
  flush()    { this.map.clear(); }
  size()     { return this.map.size; }

  /** Invalidate all keys matching a prefix */
  delPrefix(prefix) {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }
}

// Singleton shared across the process
const cache = new LRUCache(500);
module.exports = cache;
