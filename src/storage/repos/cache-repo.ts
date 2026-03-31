import { getDb } from '../db';

interface CacheEntry {
  value: string;
  updated_at: string;
}

export const cacheRepo = {
  get(key: string): string | undefined {
    const row = getDb().prepare('SELECT value FROM state_cache WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },

  getFresh(key: string, maxAgeMs: number): string | undefined {
    const row = getDb().prepare('SELECT value, updated_at FROM state_cache WHERE key = ?').get(key) as CacheEntry | undefined;
    if (!row) return undefined;

    const updatedAt = Date.parse(row.updated_at.replace(' ', 'T') + 'Z');
    if (Number.isNaN(updatedAt)) return undefined;
    if (Date.now() - updatedAt > maxAgeMs) return undefined;

    return row.value;
  },

  set(key: string, value: string): void {
    getDb().prepare(
      'INSERT INTO state_cache (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).run(key, value);
  },

  delete(key: string): void {
    getDb().prepare('DELETE FROM state_cache WHERE key = ?').run(key);
  },
};
