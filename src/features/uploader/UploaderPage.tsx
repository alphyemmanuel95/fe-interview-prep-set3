import { useRef } from 'react';
import type { JSX } from 'react';
import { xhrUploadTransport } from './api/uploadTransport';
import type { UploadTransport } from './api/uploadTransport';
import { DropZone } from './components/DropZone';
import { UploadRow } from './components/UploadRow';
import { useBeforeUnloadWarning } from './hooks/useBeforeUnloadWarning';
import { useUploadQueue } from './hooks/useUploadQueue';
import { formatQueueSummary } from './model/format';
import { MAX_CONCURRENT_UPLOADS, isActive } from './model/uploadQueue';
import './UploaderPage.css';

type UploaderPageProps = Readonly<{
  // Injectable so tests drive uploads with a fake instead of real HTTP.
  transport?: UploadTransport;
}>;

export function UploaderPage({ transport = xhrUploadTransport }: UploaderPageProps): JSX.Element {
  const { items, addFiles, cancel, retry, remove } = useUploadQueue(transport);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useBeforeUnloadWarning(items.some(isActive));

  // The focused Remove button disappears with its row, so focus moves to the neighbouring row
  // (next, else previous), or to the file picker when the list becomes empty. The neighbour is
  // focused before the re-render; it stays mounted, so focus is never dropped to the body.
  function handleRemove(id: string): void {
    const index = items.findIndex((item) => item.id === id);
    const neighbourId = (items[index + 1] ?? items[index - 1])?.id;
    const neighbourRow = Array.from(listRef.current?.children ?? []).find(
      (row) =>
        neighbourId !== undefined &&
        row instanceof HTMLElement &&
        row.dataset['itemId'] === neighbourId,
    );
    remove(id);
    (neighbourRow?.querySelector('button') ?? fileInputRef.current)?.focus();
  }

  return (
    <section className="uploader" aria-labelledby="uploader-title">
      <h1 id="uploader-title">Q5 — Resumable File Uploader</h1>
      <p className="uploader__intro">
        Up to {MAX_CONCURRENT_UPLOADS} files upload at a time. Failed uploads retry automatically.
      </p>
      <DropZone inputRef={fileInputRef} onFilesSelected={addFiles} />
      <p className="uploader__summary" aria-live="polite">
        {formatQueueSummary(items)}
      </p>
      {items.length > 0 && (
        <ul ref={listRef} className="uploader__list" aria-label="Upload queue">
          {items.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onCancel={cancel}
              onRetry={retry}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
