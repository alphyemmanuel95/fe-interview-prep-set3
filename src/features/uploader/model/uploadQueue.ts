import { assertNever } from '../../../shared/assertNever';

// Single source of truth for the limit: changing it to 2 is a one-line change.
export const MAX_CONCURRENT_UPLOADS = 3;

type UploadItemBase = Readonly<{
  id: string;
  name: string;
  size: number;
  // Generated once when the file is added and reused for every retry, so the server can
  // recognise a repeat of a request it already completed and never store the file twice.
  idempotencyKey: string;
  // Attempts started since the file was added or last manually retried.
  attempt: number;
}>;

export type UploadItem = UploadItemBase &
  (
    | Readonly<{ status: 'queued' }>
    | Readonly<{ status: 'uploading'; progress: number }>
    | Readonly<{ status: 'done' }>
    | Readonly<{ status: 'failed'; error: string }>
    | Readonly<{ status: 'cancelled' }>
  );

export type UploadStatus = UploadItem['status'];

export type UploadQueue = readonly UploadItem[];

export type UploadQueueAction =
  | Readonly<{ type: 'filesAdded'; items: readonly UploadItem[] }>
  | Readonly<{ type: 'started'; id: string }>
  | Readonly<{ type: 'progressed'; id: string; progress: number }>
  | Readonly<{ type: 'succeeded'; id: string }>
  | Readonly<{ type: 'attemptFailed'; id: string; error: string }>
  | Readonly<{ type: 'cancelled'; id: string }>
  | Readonly<{ type: 'retryRequested'; id: string }>
  | Readonly<{ type: 'removed'; id: string }>;

// Rebuilding from the shared fields drops variant-only fields (progress, error) on transition.
function toBase({ id, name, size, idempotencyKey, attempt }: UploadItem): UploadItemBase {
  return { id, name, size, idempotencyKey, attempt };
}

export function createQueuedItem(
  file: Readonly<{ name: string; size: number }>,
  createId: () => string,
): UploadItem {
  return {
    id: createId(),
    name: file.name,
    size: file.size,
    idempotencyKey: createId(),
    attempt: 0,
    status: 'queued',
  };
}

export function isActive(item: UploadItem): boolean {
  return item.status === 'queued' || item.status === 'uploading';
}

export function canRetry(item: UploadItem): boolean {
  return item.status === 'failed' || item.status === 'cancelled';
}

// Items that may start now: queued ones, in list order, up to the free concurrency slots.
export function selectItemsToStart(
  queue: UploadQueue,
  maxConcurrent: number = MAX_CONCURRENT_UPLOADS,
): readonly UploadItem[] {
  const uploadingCount = queue.filter((item) => item.status === 'uploading').length;
  const freeSlots = Math.max(0, maxConcurrent - uploadingCount);
  return queue.filter((item) => item.status === 'queued').slice(0, freeSlots);
}

// Transitions return the same object when they don't apply, so late events for an item that has
// already moved on (e.g. progress after cancel) are ignored and cause no re-render.
function transition(item: UploadItem, action: UploadQueueAction): UploadItem {
  switch (action.type) {
    case 'started':
      return item.status === 'queued'
        ? { ...toBase(item), attempt: item.attempt + 1, status: 'uploading', progress: 0 }
        : item;
    case 'progressed':
      return item.status === 'uploading' ? { ...item, progress: action.progress } : item;
    case 'succeeded':
      return item.status === 'uploading' ? { ...toBase(item), status: 'done' } : item;
    case 'attemptFailed':
      return item.status === 'uploading'
        ? { ...toBase(item), status: 'failed', error: action.error }
        : item;
    case 'cancelled':
      return isActive(item) ? { ...toBase(item), status: 'cancelled' } : item;
    case 'retryRequested':
      return canRetry(item) ? { ...toBase(item), attempt: 0, status: 'queued' } : item;
    case 'filesAdded':
    case 'removed':
      return item;
    default:
      return assertNever(action);
  }
}

export function uploadQueueReducer(queue: UploadQueue, action: UploadQueueAction): UploadQueue {
  if (action.type === 'filesAdded') {
    return [...queue, ...action.items];
  }
  if (action.type === 'removed') {
    return queue.filter((item) => item.id !== action.id);
  }
  const index = queue.findIndex((item) => item.id === action.id);
  const current = queue[index];
  if (current === undefined) {
    return queue;
  }
  const next = transition(current, action);
  return next === current ? queue : queue.with(index, next);
}
