import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChildrenCache } from './childrenCache';

const CHILDREN = ['a', 'b'] as const;

describe('createChildrenCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares one request between concurrent loads of the same branch', async () => {
    const cache = createChildrenCache<string>();
    const fetchChildren = vi.fn(() => Promise.resolve(CHILDREN));

    await Promise.all([cache.load('root', fetchChildren), cache.load('root', fetchChildren)]);

    expect(fetchChildren).toHaveBeenCalledOnce();
    expect(cache.getSnapshot().get('root')).toMatchObject({
      status: 'success',
      children: CHILDREN,
    });
  });

  it('never refetches a branch that already loaded', async () => {
    const cache = createChildrenCache<string>();
    const fetchChildren = vi.fn(() => Promise.resolve(CHILDREN));

    await cache.load('root', fetchChildren);
    await cache.load('root', fetchChildren);

    expect(fetchChildren).toHaveBeenCalledOnce();
  });

  it('records a failure and loads again on retry', async () => {
    const cache = createChildrenCache<string>();
    const fetchChildren = vi
      .fn<() => Promise<readonly string[]>>()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(CHILDREN);

    await cache.load('root', fetchChildren);
    expect(cache.getSnapshot().get('root')).toMatchObject({ status: 'error', error: 'Offline' });

    await cache.load('root', fetchChildren);
    expect(fetchChildren).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().get('root')).toMatchObject({
      status: 'success',
      children: CHILDREN,
    });
  });

  it('retries a loader that threw synchronously', async () => {
    const cache = createChildrenCache<string>();
    const fetchChildren = vi
      .fn<() => Promise<readonly string[]>>()
      .mockImplementationOnce(() => {
        throw new Error('Bad request');
      })
      .mockResolvedValueOnce(CHILDREN);

    await cache.load('root', fetchChildren);
    expect(cache.getSnapshot().get('root')).toMatchObject({
      status: 'error',
      error: 'Bad request',
    });

    await cache.load('root', fetchChildren);
    expect(fetchChildren).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().get('root')).toMatchObject({ status: 'success' });
  });

  it('keeps loads alive across a StrictMode disconnect/connect replay', () => {
    const cache = createChildrenCache<string>();
    let signal: AbortSignal | undefined;
    void cache.load('root', (nextSignal) => {
      signal = nextSignal;
      return new Promise<readonly string[]>(() => undefined);
    });

    const disconnect = cache.connect();
    disconnect();
    cache.connect();
    vi.runAllTimers();

    expect(signal?.aborted).toBe(false);
  });

  it('aborts in-flight loads after a real disconnect', () => {
    const cache = createChildrenCache<string>();
    let signal: AbortSignal | undefined;
    void cache.load('root', (nextSignal) => {
      signal = nextSignal;
      return new Promise<readonly string[]>(() => undefined);
    });

    cache.connect()();
    vi.runAllTimers();

    expect(signal?.aborted).toBe(true);
  });
});
