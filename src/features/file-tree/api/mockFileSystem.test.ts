import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockFileSystem, FLAKY_FOLDER_ID } from './mockFileSystem';

const LATENCY_MS = 400;
const EXPECTED_MIN_NODES = 900;
const EXPECTED_MAX_NODES = 1_200;
const EXPECTED_MAX_LEVEL = 6;

describe('createMockFileSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates the same ~1,000 node hierarchy, 6 levels deep, every time', () => {
    const first = createMockFileSystem({ latencyMs: LATENCY_MS });
    const second = createMockFileSystem({ latencyMs: LATENCY_MS });

    const ids = first.searchIndex.map((entry) => entry.id);
    expect(ids.length).toBeGreaterThanOrEqual(EXPECTED_MIN_NODES);
    expect(ids.length).toBeLessThanOrEqual(EXPECTED_MAX_NODES);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...first.searchIndex.map((entry) => entry.ancestorIds.length + 1))).toBe(
      EXPECTED_MAX_LEVEL,
    );
    expect(second.searchIndex.map((entry) => entry.id)).toEqual(ids);
  });

  it('resolves a folder’s children only after the simulated latency', async () => {
    const fileSystem = createMockFileSystem({ latencyMs: LATENCY_MS });
    const [folder] = fileSystem.rootNodes;
    const onLoaded = vi.fn();

    void fileSystem.loadChildren(folder?.id ?? '').then(onLoaded);
    await vi.advanceTimersByTimeAsync(LATENCY_MS - 1);
    expect(onLoaded).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onLoaded).toHaveBeenCalledOnce();
  });

  it('rejects with an AbortError when the signal aborts', async () => {
    const fileSystem = createMockFileSystem({ latencyMs: LATENCY_MS });
    const controller = new AbortController();

    const load = fileSystem.loadChildren(FLAKY_FOLDER_ID, controller.signal);
    controller.abort();

    await expect(load).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fails the first load of a flaky folder and succeeds on retry', async () => {
    const fileSystem = createMockFileSystem({
      latencyMs: 0,
      failFirstLoadOf: [FLAKY_FOLDER_ID],
    });

    const firstAttempt = expect(fileSystem.loadChildren(FLAKY_FOLDER_ID)).rejects.toThrow(
      'Could not reach',
    );
    await vi.runAllTimersAsync();
    await firstAttempt;

    const retry = fileSystem.loadChildren(FLAKY_FOLDER_ID);
    await vi.runAllTimersAsync();
    expect((await retry).length).toBeGreaterThan(0);
  });
});
