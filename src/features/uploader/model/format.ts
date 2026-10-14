import type { UploadQueue, UploadStatus } from './uploadQueue';

const BYTES_PER_UNIT = 1_024;
const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

export function formatFileSize(bytes: number): string {
  const exponent = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)) : 0;
  const unitIndex = Math.min(exponent, SIZE_UNITS.length - 1);
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: SIZE_UNITS[unitIndex] ?? 'byte',
    unitDisplay: 'short',
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(bytes / BYTES_PER_UNIT ** unitIndex);
}

// Key order is the order of the summary; `satisfies` makes a new status a compile error here.
const SUMMARY_LABELS = {
  uploading: 'uploading',
  retrying: 'waiting to retry',
  queued: 'queued',
  done: 'done',
  failed: 'failed',
  cancelled: 'cancelled',
} as const satisfies Record<UploadStatus, string>;

export function formatQueueSummary(queue: UploadQueue): string {
  if (queue.length === 0) {
    return 'No files in the queue.';
  }
  const counts = new Map<string, number>();
  for (const item of queue) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }
  const parts = Object.entries(SUMMARY_LABELS).flatMap(([status, label]) => {
    const count = counts.get(status) ?? 0;
    return count > 0 ? [`${count} ${label}`] : [];
  });
  return `${parts.join(', ')}.`;
}
