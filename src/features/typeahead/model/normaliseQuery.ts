/**
 * Canonical form of a search query, used both as the request term and the cache key, so
 * "Del", " del " and "del" share one request and one cache entry.
 */
export function normaliseQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}
