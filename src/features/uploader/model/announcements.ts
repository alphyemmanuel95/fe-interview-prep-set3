import type { UploadQueue, UploadQueueAction } from './uploadQueue';
import { isActive, uploadQueueReducer } from './uploadQueue';

// Screen-reader announcements are limited to terminal events: a file that gave up, and the queue
// finishing. Starts, progress, retries and re-queues stay visual, or a 7-file batch would produce
// a stream of interruptions that says nothing about which file needs attention.
export function describeQueueChange(previous: UploadQueue, next: UploadQueue): string | null {
  const previousStatusById = new Map(previous.map((item) => [item.id, item.status]));
  const messages = next.flatMap((item) =>
    item.status === 'failed' && previousStatusById.get(item.id) !== 'failed'
      ? [`${item.name} failed after ${item.attempt} attempts.`]
      : [],
  );

  const hasFinished = previous.some(isActive) && next.length > 0 && !next.some(isActive);
  if (hasFinished) {
    const counts = [
      ['uploaded', next.filter((item) => item.status === 'done').length],
      ['failed', next.filter((item) => item.status === 'failed').length],
      ['cancelled', next.filter((item) => item.status === 'cancelled').length],
    ] as const;
    const parts = counts.flatMap(([label, count]) => (count > 0 ? [`${count} ${label}`] : []));
    messages.push(`All uploads finished: ${parts.join(', ')}.`);
  }
  return messages.length > 0 ? messages.join(' ') : null;
}

export type UploaderState = Readonly<{ items: UploadQueue; announcement: string }>;

export function createUploaderState(items: UploadQueue): UploaderState {
  return { items, announcement: '' };
}

// Wraps the queue reducer and derives the announcement from each transition, keeping the
// "what changed" logic pure. Adding files clears it, so an identical message later (e.g. the
// same summary for the next batch) is still a change the live region will announce.
export function uploaderReducer(state: UploaderState, action: UploadQueueAction): UploaderState {
  const items = uploadQueueReducer(state.items, action);
  if (items === state.items) {
    return state;
  }
  if (action.type === 'filesAdded') {
    return { items, announcement: '' };
  }
  return { items, announcement: describeQueueChange(state.items, items) ?? state.announcement };
}
