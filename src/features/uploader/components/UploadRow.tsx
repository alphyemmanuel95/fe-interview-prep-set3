import type { JSX, ReactNode } from 'react';
import { assertNever } from '../../../shared/assertNever';
import { formatFileSize } from '../model/format';
import type { UploadItem } from '../model/uploadQueue';
import { canRetry, isActive } from '../model/uploadQueue';
import { useActionSwapGuard } from '../hooks/useActionSwapGuard';
import { RetryStatus } from './RetryStatus';
import './UploadRow.css';

type UploadRowProps = Readonly<{
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}>;

const PERCENT = 100;

function describeStatus(item: UploadItem): ReactNode {
  switch (item.status) {
    case 'queued':
      return 'Queued';
    case 'uploading':
      return item.progress < 1
        ? `Uploading ${Math.round(item.progress * PERCENT)}%`
        : 'Uploaded, waiting for the server';
    case 'retrying':
      return <RetryStatus attempt={item.attempt} error={item.error} retryAt={item.retryAt} />;
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

type RowAction = 'cancel' | 'retry' | 'remove';

const ACTION_LABELS = {
  cancel: 'Cancel',
  retry: 'Retry',
  remove: 'Remove',
} as const satisfies Record<RowAction, string>;

function getPrimaryAction(item: UploadItem): RowAction {
  if (isActive(item)) {
    return 'cancel';
  }
  return canRetry(item) ? 'retry' : 'remove';
}

export function UploadRow({ item, onCancel, onRetry, onRemove }: UploadRowProps): JSX.Element {
  const primaryAction = getPrimaryAction(item);
  const hasSecondaryRemove = primaryAction === 'retry';
  const isSwapGuardActive = useActionSwapGuard(primaryAction);

  function handlePrimaryAction(): void {
    if (isSwapGuardActive()) {
      return;
    }
    switch (primaryAction) {
      case 'cancel':
        onCancel(item.id);
        return;
      case 'retry':
        onRetry(item.id);
        return;
      case 'remove':
        onRemove(item.id);
        return;
      default:
        assertNever(primaryAction);
    }
  }

  function handleSecondaryRemove(): void {
    if (!isSwapGuardActive()) {
      onRemove(item.id);
    }
  }

  return (
    <li className={`upload-row upload-row--${item.status}`} data-item-id={item.id}>
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
          {/* Every status has a primary action in this one, always-rendered button, so focus is
              never dropped when the status changes (including on its own, e.g. on completion). */}
          <button
            type="button"
            className={
              primaryAction === 'remove'
                ? 'upload-row__button upload-row__button--secondary'
                : 'upload-row__button'
            }
            aria-label={`${ACTION_LABELS[primaryAction]} ${item.name}`}
            onClick={handlePrimaryAction}
          >
            {ACTION_LABELS[primaryAction]}
          </button>
          {hasSecondaryRemove && (
            <button
              type="button"
              className="upload-row__button upload-row__button--secondary"
              aria-label={`Remove ${item.name}`}
              onClick={handleSecondaryRemove}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
