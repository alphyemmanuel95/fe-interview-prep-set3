import { describe, expect, it } from 'vitest';
import type { UploadItem, UploadQueue, UploadQueueAction } from './uploadQueue';
import { MAX_CONCURRENT_UPLOADS, selectItemsToStart, uploadQueueReducer } from './uploadQueue';

function queued(id: string): UploadItem {
  return {
    id,
    name: `${id}.txt`,
    size: 10,
    idempotencyKey: `key-${id}`,
    attempt: 0,
    status: 'queued',
  };
}

function reduce(queue: UploadQueue, ...actions: readonly UploadQueueAction[]): UploadQueue {
  return actions.reduce(uploadQueueReducer, queue);
}

function statusOf(queue: UploadQueue, id: string): UploadItem['status'] | undefined {
  return queue.find((item) => item.id === id)?.status;
}

describe('selectItemsToStart', () => {
  it(`starts at most ${MAX_CONCURRENT_UPLOADS} uploads, in list order`, () => {
    const queue = ['a', 'b', 'c', 'd', 'e'].map(queued);

    expect(selectItemsToStart(queue).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('only fills the slots left by uploads already running', () => {
    const queue = reduce(
      ['a', 'b', 'c', 'd'].map(queued),
      { type: 'started', id: 'a' },
      { type: 'started', id: 'b' },
    );

    expect(selectItemsToStart(queue).map((item) => item.id)).toEqual(['c']);
    expect(selectItemsToStart(queue, 2)).toEqual([]);
  });
});

describe('uploadQueueReducer', () => {
  it('moves an upload through started, progress and done', () => {
    const queue = reduce(
      [queued('a')],
      { type: 'started', id: 'a' },
      { type: 'progressed', id: 'a', progress: 0.5 },
    );
    expect(queue[0]).toMatchObject({ status: 'uploading', progress: 0.5, attempt: 1 });

    expect(statusOf(uploadQueueReducer(queue, { type: 'succeeded', id: 'a' }), 'a')).toBe('done');
  });

  it('ignores late events for an upload that was cancelled', () => {
    const cancelled = reduce(
      [queued('a')],
      { type: 'started', id: 'a' },
      { type: 'cancelled', id: 'a' },
    );

    expect(uploadQueueReducer(cancelled, { type: 'succeeded', id: 'a' })).toBe(cancelled);
    expect(uploadQueueReducer(cancelled, { type: 'progressed', id: 'a', progress: 1 })).toBe(
      cancelled,
    );
  });

  it('requeues a cancelled upload on retry and keeps its idempotency key', () => {
    const queue = reduce(
      [queued('a')],
      { type: 'started', id: 'a' },
      { type: 'cancelled', id: 'a' },
      { type: 'retryRequested', id: 'a' },
    );

    expect(queue[0]).toEqual(queued('a'));
  });

  it('removes an item', () => {
    expect(reduce([queued('a'), queued('b')], { type: 'removed', id: 'a' })).toEqual([queued('b')]);
  });
});
