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
  useBeforeUnloadWarning(items.some(isActive));

  function handleRemove(id: string): void {
    remove(id);
    // The focused Remove button disappears with its row; keep keyboard users in the flow.
    fileInputRef.current?.focus();
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
        <ul className="uploader__list" aria-label="Upload queue">
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
