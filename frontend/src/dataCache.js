/**
 * Simple in-memory data cache (module-level Map).
 *
 * - **How it works**: callers store JSON-ish data by string key via `setCached()`.
 *   Reads use `getCached()` which returns `null` on miss or when the entry is stale.
 * - **TTL**: default max age is 5 minutes. Override per call via `getCached(key, maxAgeMs)`.
 * - **How to bust**: `clearCache()` wipes everything. `invalidateTab(tab)` deletes entries
 *   whose keys start with `${tab}:` (tab-scoped invalidation).
 * - **Stale-data fallback**: if the backend is temporarily offline, callers may read the
 *   raw entry via `getCacheEntry()` and decide to use stale data anyway (with a UI toast).
 */
const cache = new Map()

// key: string  value: { data, timestamp }
// maxAge: ms before a cached entry is considered stale (default 5 minutes)
export function getCached(key, maxAgeMs = 5 * 60 * 1000) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > maxAgeMs) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCache() {
  cache.clear()
}

export function invalidateTab(tab) {
  for (const key of cache.keys()) {
    if (key.startsWith(tab + ':')) cache.delete(key)
  }
}

export function getCacheEntry(key) {
  return cache.get(key) || null
}
