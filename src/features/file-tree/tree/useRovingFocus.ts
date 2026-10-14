import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { rowIdOf } from './treeDom';
import { pickTabStop, type VisibleRow } from './visibleRows';

export type RovingFocus = Readonly<{
  /** The one row with `tabIndex=0`. */
  tabStopId: string | null;
  registerRow: (id: string, element: HTMLElement | null) => void;
  focusRow: (id: string) => void;
  handleFocus: (event: FocusEvent<HTMLElement>) => void;
  handleBlur: (event: FocusEvent<HTMLElement>) => void;
}>;

// Roving tabindex for the tree: one row is tabbable, arrow keys move real DOM focus between rows.
export function useRovingFocus<T>(
  rows: readonly VisibleRow<T>[],
  indexById: ReadonlyMap<string, number>,
  selectedId: string | null,
): RovingFocus {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowElements = useRef(new Map<string, HTMLElement>());
  // Whether focus was last inside the tree. A ref: it only gates the effect below, never renders.
  const hasFocusWithinRef = useRef(false);
  const tabStopId = pickTabStop(rows, indexById, [focusedId, selectedId]);

  const registerRow = useCallback((id: string, element: HTMLElement | null) => {
    if (element === null) {
      rowElements.current.delete(id);
    } else {
      rowElements.current.set(id, element);
    }
  }, []);

  // DOM focus fires `handleFocus`, which moves the tab stop.
  const focusRow = useCallback((id: string) => {
    rowElements.current.get(id)?.focus();
  }, []);

  // Reveal the selected row once it renders, e.g. after a shared link's folders have loaded.
  const isSelectedRendered = selectedId !== null && indexById.has(selectedId);
  useEffect(() => {
    if (selectedId !== null && isSelectedRendered) {
      rowElements.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId, isSelectedRendered]);

  // The focused row can disappear under the user: browser Back collapses its folder, or a retry
  // replaces an error row. The browser then drops focus on <body>; hand it to the tab stop instead.
  useEffect(() => {
    const isFocusedRowGone = focusedId !== null && !indexById.has(focusedId);
    if (
      isFocusedRowGone &&
      hasFocusWithinRef.current &&
      document.activeElement === document.body &&
      tabStopId !== null
    ) {
      focusRow(tabStopId);
    }
  }, [focusedId, indexById, tabStopId, focusRow]);

  const handleFocus = (event: FocusEvent<HTMLElement>): void => {
    hasFocusWithinRef.current = true;
    // The container is focusable only so clicks on its empty space land somewhere; pass that focus
    // on to the tab stop so the visible focus ring is always on a row.
    if (event.target === event.currentTarget && tabStopId !== null) {
      focusRow(tabStopId);
      return;
    }
    const id = rowIdOf(event.target);
    if (id !== undefined) {
      setFocusedId(id);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) {
      hasFocusWithinRef.current = false;
    }
  };

  return { tabStopId, registerRow, focusRow, handleFocus, handleBlur };
}
