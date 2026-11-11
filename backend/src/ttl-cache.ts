/**
 * How long live solving keeps a looked-up device, person or WCIF. Every write
 * to those clears its cache; the TTL is a backstop for a write path that
 * doesn't.
 */
export const LIVE_LOOKUP_TTL_MS = 5000;

/**
 * A map whose entries expire `ttlMs` after being stored. Expired entries are
 * replaced on the next read rather than swept, so the size is bounded by the
 * number of distinct keys, which for live solving is the devices and people
 * at one competition.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  async getOrLoad(key: K, load: () => Promise<V>): Promise<V> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    const value = await load();
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  clear() {
    this.entries.clear();
  }
}
