import { assertNever } from '../../../shared/assertNever';

// Single source of truth for the limit: changing it to 2 is a one-line change.
export const MAX_CONCURRENT_UPLOADS = 3;

// Wait before each automatic retry. Its length is the number of automatic retries, after which
// the item is "failed" and only a manual retry (which starts the sequence again) re-queues it.
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

type UploadItemBase = Readonly<{
  id: string;
  name: string;
  size: number;
  // With name and size, identifies the same file when it is re-selected after a reload.
  lastModified: number;
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
    // Waiting out a backoff delay. It holds no concurrency slot meanwhile: other files keep
    // uploading, and once the delay passes the item is re-queued in its original position.
    // `retryAt` is an absolute deadline (epoch ms), so a timer can be rescheduled from state at
    // any time (re-render, effect re-run, reconnect) without restarting the wait.
    | Readonly<{ status: 'retrying'; retryAt: number; error: string }>
    | Readonly<{ status: 'done' }>
    | Readonly<{ status: 'failed'; error: string }>
    | Readonly<{ status: 'cancelled' }>
    // Restored after a reload without its File, which the browser can't persist.
    | Readonly<{ status: 'needs-reselect' }>
  );

export type UploadStatus = UploadItem['status'];

export type UploadQueue = readonly UploadItem[];

export type UploadQueueAction =
  | Readonly<{
      type: 'filesAdded';
      newItems: readonly UploadItem[];
      reattachedIds: readonly string[];
    }>
  | Readonly<{ type: 'started'; id: string }>
  | Readonly<{ type: 'progressed'; id: string; progress: number }>
  | Readonly<{ type: 'succeeded'; id: string }>
  | Readonly<{ type: 'attemptFailed'; id: string; error: string; failedAt: number }>
  // The request was torn down by the hook (unmount, reconnect), not by the user or the server.
  | Readonly<{ type: 'interrupted'; id: string }>
  | Readonly<{ type: 'retryDue'; id: string }>
  | Readonly<{ type: 'cancelled'; id: string }>
  | Readonly<{ type: 'retryRequested'; id: string }>
  | Readonly<{ type: 'removed'; id: string }>;

// Rebuilding from the shared fields drops variant-only fields (progress, error) on transition.
function toBase({
  id,
  name,
  size,
  lastModified,
  idempotencyKey,
  attempt,
}: UploadItem): UploadItemBase {
  return { id, name, size, lastModified, idempotencyKey, attempt };
}

export type FileAssignment = Readonly<{ itemId: string; file: File }>;

export type AddedFilesPlan = Readonly<{
  newItems: readonly UploadItem[];
  reattachedIds: readonly string[];
  assignments: readonly FileAssignment[];
}>;

// Name, size and last-modified time together stand in for file identity: the browser exposes no
// stable file id, and hashing the contents would mean reading whole files up front. Checking
// lastModified stops an edited file of the same size resuming under the old key, where the server
// would answer "duplicate" and silently keep the old content.
export function isSameFile(
  item: UploadItem,
  file: Readonly<{ name: string; size: number; lastModified: number }>,
): boolean {
  return (
    item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
  );
}

// A file matching an item waiting for re-select is treated as that file: it resumes under the item's original idempotency key, so a request the server completed
// before the reload is recognised instead of stored twice. Anything else becomes a new item.
export function planAddedFiles(
  queue: UploadQueue,
  files: readonly File[],
  createId: () => string,
): AddedFilesPlan {
  const waiting = queue.filter((item) => item.status === 'needs-reselect');
  const newItems: UploadItem[] = [];
  const reattachedIds: string[] = [];
  const assignments: FileAssignment[] = [];

  for (const file of files) {
    const match = waiting.find(
      (item) => isSameFile(item, file) && !reattachedIds.includes(item.id),
    );
    if (match === undefined) {
      const item: UploadItem = {
        id: createId(),
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        idempotencyKey: createId(),
        attempt: 0,
        status: 'queued',
      };
      newItems.push(item);
      assignments.push({ itemId: item.id, file });
    } else {
      reattachedIds.push(match.id);
      assignments.push({ itemId: match.id, file });
    }
  }
  return { newItems, reattachedIds, assignments };
}

export function isActive(item: UploadItem): boolean {
  return item.status === 'queued' || item.status === 'uploading' || item.status === 'retrying';
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

// Attempt n (1-based) failing waits RETRY_DELAYS_MS[n - 1]; past the last delay it gives up.
export function getRetryDelayMs(attempt: number): number | undefined {
  return RETRY_DELAYS_MS[attempt - 1];
}

function failAttempt(item: UploadItem, error: string, failedAt: number): UploadItem {
  const retryDelayMs = getRetryDelayMs(item.attempt);
  return retryDelayMs === undefined
    ? { ...toBase(item), status: 'failed', error }
    : { ...toBase(item), status: 'retrying', retryAt: failedAt + retryDelayMs, error };
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
      return item.status === 'uploading' ? failAttempt(item, action.error, action.failedAt) : item;
    case 'interrupted':
      // The attempt never finished, so it doesn't count towards the retry budget.
      return item.status === 'uploading'
        ? { ...toBase(item), attempt: item.attempt - 1, status: 'queued' }
        : item;
    case 'retryDue':
      return item.status === 'retrying' ? { ...toBase(item), status: 'queued' } : item;
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
    const reattached = queue.map((item) =>
      item.status === 'needs-reselect' && action.reattachedIds.includes(item.id)
        ? { ...toBase(item), attempt: 0, status: 'queued' as const }
        : item,
    );
    return [...reattached, ...action.newItems];
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
