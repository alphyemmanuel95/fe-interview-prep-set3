import { useId, useRef } from 'react';
import type { ChangeEvent, JSX, RefObject } from 'react';
import { useFileDrop } from '../hooks/useFileDrop';
import './DropZone.css';

type DropZoneProps = Readonly<{
  inputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: readonly File[]) => void;
}>;

export function DropZone({ inputRef, onFilesSelected }: DropZoneProps): JSX.Element {
  const inputId = useId();
  const zoneRef = useRef<HTMLDivElement>(null);
  const isDragActive = useFileDrop(zoneRef, onFilesSelected);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.currentTarget.files ?? []);
    // Reset so choosing the same file again still fires `change`.
    event.currentTarget.value = '';
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }

  return (
    <div ref={zoneRef} className={isDragActive ? 'drop-zone drop-zone--active' : 'drop-zone'}>
      <p className="drop-zone__hint">
        {isDragActive ? 'Release to add the files' : 'Drag and drop files here, or'}
      </p>
      {/* The native input stays focusable for keyboard users; the label is its visible button. */}
      <input
        ref={inputRef}
        id={inputId}
        className="drop-zone__input visually-hidden"
        type="file"
        multiple
        onChange={handleInputChange}
      />
      <label htmlFor={inputId} className="drop-zone__button">
        Choose files
      </label>
    </div>
  );
}
