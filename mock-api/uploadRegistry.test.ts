import { describe, expect, it } from 'vitest';
import { FAILURE_RATE, createUploadRegistry, pickUploadOutcome } from './uploadRegistry.ts';

const FILE = { name: 'report.pdf', size: 1_024 } as const;

describe('createUploadRegistry', () => {
  it('stores a file once when the same idempotency key is sent twice', () => {
    let nextId = 0;
    const registry = createUploadRegistry(() => `file-${String(++nextId)}`);

    const first = registry.register('key-1', FILE);
    const second = registry.register('key-1', FILE);

    expect(first).toEqual({ record: { id: 'file-1', ...FILE }, isDuplicate: false });
    expect(second).toEqual({ record: { id: 'file-1', ...FILE }, isDuplicate: true });
    expect(registry.list()).toHaveLength(1);
  });

  it('stores files with different keys separately', () => {
    const registry = createUploadRegistry();

    registry.register('key-1', FILE);
    registry.register('key-2', FILE);

    expect(registry.list()).toHaveLength(2);
  });
});

describe('pickUploadOutcome', () => {
  it('fails for rolls below the failure rate and succeeds otherwise', () => {
    expect(pickUploadOutcome(() => 0)).toBe('fail-before-store');
    expect(pickUploadOutcome(() => FAILURE_RATE / 2)).toBe('fail-after-store');
    expect(pickUploadOutcome(() => FAILURE_RATE)).toBe('success');
    expect(pickUploadOutcome(() => 0.99)).toBe('success');
  });
});
