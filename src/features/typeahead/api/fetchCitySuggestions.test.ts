import { describe, expect, it, vi } from 'vitest';
import { fetchCitySuggestions, parseCitySuggestions } from './fetchCitySuggestions';

const validUser = {
  id: 1,
  firstName: 'Adele',
  lastName: 'Hart',
  address: { address: '1 Main St', city: 'Delhi' },
};

describe('parseCitySuggestions', () => {
  it('maps users to suggestions with full name and city', () => {
    expect(parseCitySuggestions({ users: [validUser], total: 1 })).toEqual([
      { id: 1, name: 'Adele Hart', city: 'Delhi' },
    ]);
  });

  it('accepts an empty user list', () => {
    expect(parseCitySuggestions({ users: [] })).toEqual([]);
  });

  it.each([
    ['null', null],
    ['a missing users field', { total: 0 }],
    ['users that is not an array', { users: 'nope' }],
    ['a user without an address', { users: [{ ...validUser, address: null }] }],
    ['a user with a non-string city', { users: [{ ...validUser, address: { city: 42 } }] }],
  ])('rejects %s', (_label, body) => {
    expect(parseCitySuggestions(body)).toBeNull();
  });
});

describe('fetchCitySuggestions', () => {
  it('requests only the needed fields and forwards the abort signal', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ users: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await fetchCitySuggestions('del', controller.signal);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof input !== 'string') {
      throw new Error('Expected fetch to be called with a URL string');
    }
    const url = new URL(input);
    expect(url.searchParams.get('q')).toBe('del');
    expect(url.searchParams.get('select')).toBe('firstName,lastName,address');
    expect(init?.signal).toBe(controller.signal);
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(fetchCitySuggestions('del', new AbortController().signal)).rejects.toThrow(
      'HTTP 503',
    );
  });

  it('throws the contract error when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Bad gateway</html>')),
    );

    await expect(fetchCitySuggestions('del', new AbortController().signal)).rejects.toThrow(
      'unexpected response',
    );
  });

  it('throws when the body does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] })));

    await expect(fetchCitySuggestions('del', new AbortController().signal)).rejects.toThrow(
      'unexpected response',
    );
  });
});
