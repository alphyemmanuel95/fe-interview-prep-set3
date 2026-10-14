import { describe, expect, it } from 'vitest';
import type { PersistedUpload } from './persistence';
import { saveToStorage } from '../../../shared/storage';
import {
  QUEUE_STORAGE_KEY,
  QUEUE_STORAGE_VERSION,
  loadQueue,
  saveQueue,
  toPersistedQueue,
} from './persistence';
import type { UploadItem } from './uploadQueue';

function persisted(id: string, status: PersistedUpload['status']): PersistedUpload {
  return { id, name: `${id}.txt`, size: 10, lastModified: 0, idempotencyKey: `key-${id}`, status };
}

describe('upload queue persistence', () => {
  it('keeps finished uploads and marks every unfinished one as needing re-select', () => {
    saveQueue([
      persisted('a', 'done'),
      persisted('b', 'uploading'),
      persisted('c', 'queued'),
      persisted('d', 'retrying'),
      persisted('e', 'failed'),
      persisted('f', 'cancelled'),
    ]);

    expect(loadQueue().map((item) => [item.id, item.status])).toEqual([
      ['a', 'done'],
      ['b', 'needs-reselect'],
      ['c', 'needs-reselect'],
      ['d', 'needs-reselect'],
      ['e', 'needs-reselect'],
      ['f', 'needs-reselect'],
    ]);
  });

  it('keeps the idempotency key so a resumed upload is recognised by the server', () => {
    saveQueue([persisted('a', 'uploading')]);

    expect(loadQueue()[0]?.idempotencyKey).toBe('key-a');
  });

  it('stores only metadata, not transient upload state', () => {
    const uploading: UploadItem = {
      ...persisted('a', 'uploading'),
      attempt: 2,
      status: 'uploading',
      progress: 0.4,
    };

    expect(toPersistedQueue([uploading])).toEqual([persisted('a', 'uploading')]);
  });

  it('falls back to an empty queue for invalid stored data', () => {
    saveToStorage(QUEUE_STORAGE_KEY, QUEUE_STORAGE_VERSION, [
      { ...persisted('a', 'done'), status: 'exploded' },
    ]);

    expect(loadQueue()).toEqual([]);
  });
});
