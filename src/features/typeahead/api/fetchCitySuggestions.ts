import { MAX_SUGGESTIONS } from '../model/constants';
import type { CitySuggestion } from '../model/types';

const SEARCH_URL = 'https://dummyjson.com/users/search';
// Ask the API for only the fields we render, keeping the payload small.
const SELECTED_FIELDS = 'firstName,lastName,address';

type ApiUser = Readonly<{
  id: number;
  firstName: string;
  lastName: string;
  address: Readonly<{ city: string }>;
}>;

const isApiUser = (value: unknown): value is ApiUser =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'number' &&
  'firstName' in value &&
  typeof value.firstName === 'string' &&
  'lastName' in value &&
  typeof value.lastName === 'string' &&
  'address' in value &&
  typeof value.address === 'object' &&
  value.address !== null &&
  'city' in value.address &&
  typeof value.address.city === 'string';

/**
 * Narrows the untrusted response body to suggestions, or returns `null` if it doesn't match the
 * contract. A partially valid list is rejected as a whole: a broken contract is an error, not data.
 */
export function parseCitySuggestions(body: unknown): readonly CitySuggestion[] | null {
  if (typeof body !== 'object' || body === null || !('users' in body)) {
    return null;
  }
  const { users } = body;
  if (!Array.isArray(users) || !users.every(isApiUser)) {
    return null;
  }
  return users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    city: user.address.city,
  }));
}

export async function fetchCitySuggestions(
  query: string,
  signal: AbortSignal,
): Promise<readonly CitySuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(MAX_SUGGESTIONS),
    select: SELECTED_FIELDS,
  });
  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Search failed with HTTP ${response.status}`);
  }
  const suggestions = parseCitySuggestions(await response.json());
  if (suggestions === null) {
    throw new Error('Search returned an unexpected response');
  }
  return suggestions;
}
