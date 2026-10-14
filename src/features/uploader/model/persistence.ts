import { loadFromStorage, saveToStorage } from '../../../shared/storage';
import type { UploadItem, UploadQueue, UploadStatus } from './uploadQueue';

export const QUEUE_STORAGE_KEY = 'uploader.queue';
// v2 added lastModified; v1 queues fall back to empty rather than re-attach on name and size.
export const QUEUE_STORAGE_VERSION = 2;

// Only what survives a reload is stored. File objects can't be serialised (and the browser won't
// hand the same file back without the user picking it), progress and timers are transient.
export type PersistedUpload = Readonly<{
  id: string;
  name: string;
  size: number;
  lastModified: number;
  idempotencyKey: string;
  status: UploadStatus;
}>;

// `satisfies` makes a new status a compile error until it is accepted here too.
const KNOWN_STATUSES = {
  queued: true,
  uploading: true,
  retrying: true,
  done: true,
  failed: true,
  cancelled: true,
  'needs-reselect': true,
} as const satisfies Record<UploadStatus, true>;

function isUploadStatus(value: unknown): value is UploadStatus {
  return typeof value === 'string' && Object.hasOwn(KNOWN_STATUSES, value);
}

function isPersistedUpload(value: unknown): value is PersistedUpload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'lastModified' in value &&
    typeof value.lastModified === 'number' &&
    'idempotencyKey' in value &&
    typeof value.idempotencyKey === 'string' &&
    'status' in value &&
    isUploadStatus(value.status)
  );
}

function isPersistedQueue(value: unknown): value is readonly PersistedUpload[] {
  return Array.isArray(value) && value.every(isPersistedUpload);
}

export function toPersistedQueue(queue: UploadQueue): readonly PersistedUpload[] {
  return queue.map(({ id, name, size, lastModified, idempotencyKey, status }) => ({
    id,
    name,
    size,
    lastModified,
    idempotencyKey,
    status,
  }));
}

// Finished uploads stay finished; everything else lost its File and must be picked again.
function rehydrateUpload({ status, ...base }: PersistedUpload): UploadItem {
  return { ...base, attempt: 0, status: status === 'done' ? 'done' : 'needs-reselect' };
}

export function loadQueue(): UploadQueue {
  return loadFromStorage(QUEUE_STORAGE_KEY, QUEUE_STORAGE_VERSION, isPersistedQueue, []).map(
    rehydrateUpload,
  );
}

export function saveQueue(queue: readonly PersistedUpload[]): void {
  saveToStorage(QUEUE_STORAGE_KEY, QUEUE_STORAGE_VERSION, queue);
}
