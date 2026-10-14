import { useEffect, useEffectEvent, useState } from 'react';
import type { RefObject } from 'react';

// Makes an element a drop target for files and reports whether files are dragged over it.
// Dropping is a pointer-only enhancement: keyboard and screen-reader users add files through the
// native file input, so the zone itself stays a plain, non-focusable container.
export function useFileDrop(
  zoneRef: RefObject<HTMLElement | null>,
  onFilesDropped: (files: readonly File[]) => void,
): boolean {
  const [isDragActive, setIsDragActive] = useState(false);
  const handleFilesDropped = useEffectEvent(onFilesDropped);

  useEffect(() => {
    const zone = zoneRef.current;
    if (zone === null) {
      return undefined;
    }
    // Cancelling dragenter/dragover is what marks the element as accepting the drop;
    // otherwise the browser navigates the tab to the dropped file.
    const handleDragEnter = (event: DragEvent): void => {
      event.preventDefault();
      setIsDragActive(true);
    };
    const handleDragOver = (event: DragEvent): void => {
      event.preventDefault();
      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDragLeave = (event: DragEvent): void => {
      // dragleave also fires when moving onto a child; only reset when leaving the zone itself.
      if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) {
        return;
      }
      setIsDragActive(false);
    };
    const handleDrop = (event: DragEvent): void => {
      event.preventDefault();
      setIsDragActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        handleFilesDropped(files);
      }
    };

    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
    return () => {
      zone.removeEventListener('dragenter', handleDragEnter);
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('drop', handleDrop);
    };
  }, [zoneRef]);

  return isDragActive;
}
