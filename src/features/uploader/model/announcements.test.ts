import { describe, expect, it } from 'vitest';
import { createUploaderState, describeQueueChange, uploaderReducer } from './announcements';
import type { UploadItem } from './uploadQueue';

function item(id: string, status: 'queued' | 'done' | 'cancelled'): UploadItem {
  return {
    id,
    name: `${id}.txt`,
    size: 1,
    lastModified: 0,
    idempotencyKey: `key-${id}`,
    attempt: 0,
    status,
  };
}

function failed(id: string): UploadItem {
  return { ...item(id, 'done'), attempt: 4, status: 'failed', error: 'Server responded 500' };
}

describe('describeQueueChange', () => {
  it('names a file that gave up', () => {
    expect(
      describeQueueChange(
        [item('a', 'queued'), item('b', 'queued')],
        [failed('a'), item('b', 'queued')],
      ),
    ).toBe('a.txt failed after 4 attempts.');
  });

  it('summarises the batch once nothing is left running', () => {
    expect(
      describeQueueChange(
        [item('a', 'done'), failed('b'), item('c', 'queued')],
        [item('a', 'done'), failed('b'), item('c', 'done')],
      ),
    ).toBe('All uploads finished: 2 uploaded, 1 failed.');
  });

  it('stays silent for non-terminal changes', () => {
    expect(
      describeQueueChange([item('a', 'queued')], [item('a', 'queued'), item('b', 'queued')]),
    ).toBeNull();
  });
});

describe('uploaderReducer', () => {
  it('announces terminal events and clears the message when files are added', () => {
    const started = uploaderReducer(createUploaderState([item('a', 'queued')]), {
      type: 'started',
      id: 'a',
    });
    const finished = uploaderReducer(started, { type: 'succeeded', id: 'a' });
    expect(finished.announcement).toBe('All uploads finished: 1 uploaded.');

    const added = uploaderReducer(finished, {
      type: 'filesAdded',
      newItems: [item('b', 'queued')],
      reattachedIds: [],
    });
    expect(added.announcement).toBe('');
  });
});
