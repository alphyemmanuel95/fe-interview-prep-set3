import { useRef, useState } from 'react';
import type { ChangeEvent, JSX, ReactNode } from 'react';
import { assertNever } from '../../../shared/assertNever';
import { formatFileSize } from '../model/format';
import type { UploadItem } from '../model/uploadQueue';
import { canRetry, isActive, isSameFile } from '../model/uploadQueue';
import { useActionSwapGuard } from '../hooks/useActionSwapGuard';
import { RetryStatus } from './RetryStatus';
import './UploadRow.css';

type UploadRowProps = Readonly<{
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onReselect: (id: string, file: File) => void;
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
      return 'Needs re-select: choose this file again to resume';
    default:
      return assertNever(item);
  }
}

// A bar only means something while bytes are moving or once they all arrived; an empty bar on
// queued, failed or cancelled rows would read as "0% uploaded".
function getProgress(item: UploadItem): number | null {
  if (item.status === 'uploading') {
    return item.progress;
  }
  return item.status === 'done' ? 1 : null;
}

type RowAction = 'cancel' | 'retry' | 'reselect' | 'remove';

const ACTION_LABELS = {
  cancel: 'Cancel',
  retry: 'Retry',
  reselect: 'Re-select',
  remove: 'Remove',
} as const satisfies Record<RowAction, string>;

function getPrimaryAction(item: UploadItem): RowAction {
  if (isActive(item)) {
    return 'cancel';
  }
  if (canRetry(item)) {
    return 'retry';
  }
  return item.status === 'needs-reselect' ? 'reselect' : 'remove';
}

export function UploadRow({
  item,
  onCancel,
  onRetry,
  onReselect,
  onRemove,
}: UploadRowProps): JSX.Element {
  const primaryAction = getPrimaryAction(item);
  const hasSecondaryRemove = primaryAction === 'retry' || primaryAction === 'reselect';
  const reselectInputRef = useRef<HTMLInputElement>(null);
  const [reselectError, setReselectError] = useState<string | null>(null);
  const isSwapGuardActive = useActionSwapGuard(primaryAction);
  const progress = getProgress(item);

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
      case 'reselect':
        reselectInputRef.current?.click();
        return;
      case 'remove':
        onRemove(item.id);
        return;
      default:
        assertNever(primaryAction);
    }
  }

  // Only the original file may resume under this item's idempotency key; anything else would be
  // reported by the server as a duplicate of the old upload.
  function handleReselectChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) {
      return;
    }
    if (isSameFile(item, file)) {
      setReselectError(null);
      onReselect(item.id, file);
    } else {
      setReselectError(
        `"${file.name}" is not the original file. Choose ${item.name} (${formatFileSize(item.size)}) as it was before the reload.`,
      );
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
      {progress !== null && (
        <progress
          className="upload-row__progress"
          max={1}
          value={progress}
          aria-label={`Upload progress for ${item.name}`}
        />
      )}
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
      {primaryAction === 'reselect' && (
        <>
          {/* Opened by the Re-select button; not focusable on its own. */}
          <input
            ref={reselectInputRef}
            type="file"
            hidden
            aria-label={`Re-select file for ${item.name}`}
            onChange={handleReselectChange}
          />
          {reselectError !== null && (
            <p className="upload-row__error" role="alert">
              {reselectError}
            </p>
          )}
        </>
      )}
    </li>
  );
}
