import type { JSX } from 'react';
import { assertNever } from '../../../shared/assertNever';
import { formatFileSize } from '../model/format';
import type { UploadItem } from '../model/uploadQueue';
import { canRetry, isActive } from '../model/uploadQueue';
import './UploadRow.css';

type UploadRowProps = Readonly<{
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}>;

const MS_PER_SECOND = 1_000;
const PERCENT = 100;

function describeStatus(item: UploadItem): string {
  switch (item.status) {
    case 'queued':
      return 'Queued';
    case 'uploading':
      return item.progress < 1
        ? `Uploading ${Math.round(item.progress * PERCENT)}%`
        : 'Uploaded, waiting for the server';
    case 'retrying':
      return `${item.error}. Retrying in ${item.retryDelayMs / MS_PER_SECOND} s`;
    case 'done':
      return 'Uploaded';
    case 'failed':
      return `Failed after ${item.attempt} attempts: ${item.error}`;
    case 'cancelled':
      return 'Cancelled';
    case 'needs-reselect':
      return 'Needs re-select: add this file again to resume';
    default:
      return assertNever(item);
  }
}

function getProgress(item: UploadItem): number {
  if (item.status === 'uploading') {
    return item.progress;
  }
  return item.status === 'done' ? 1 : 0;
}

export function UploadRow({ item, onCancel, onRetry, onRemove }: UploadRowProps): JSX.Element {
  const isCancellable = isActive(item);
  const isRetryable = canRetry(item);
  const primaryLabel = isCancellable ? 'Cancel' : 'Retry';

  function handlePrimaryAction(): void {
    if (isCancellable) {
      onCancel(item.id);
    } else {
      onRetry(item.id);
    }
  }

  return (
    <li className={`upload-row upload-row--${item.status}`}>
      <div className="upload-row__header">
        <span className="upload-row__name">{item.name}</span>
        <span className="upload-row__size">{formatFileSize(item.size)}</span>
      </div>
      <progress
        className="upload-row__progress"
        max={1}
        value={getProgress(item)}
        aria-label={`Upload progress for ${item.name}`}
      />
      <div className="upload-row__footer">
        <p className="upload-row__status">{describeStatus(item)}</p>
        <div className="upload-row__actions">
          {/* Cancel and Retry share one button element, so focus stays put when it toggles. */}
          {(isCancellable || isRetryable) && (
            <button
              type="button"
              className="upload-row__button"
              aria-label={`${primaryLabel} ${item.name}`}
              onClick={handlePrimaryAction}
            >
              {primaryLabel}
            </button>
          )}
          {!isCancellable && (
            <button
              type="button"
              className="upload-row__button upload-row__button--secondary"
              aria-label={`Remove ${item.name}`}
              onClick={() => {
                onRemove(item.id);
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
