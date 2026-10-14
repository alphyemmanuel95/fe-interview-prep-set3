import { useEffect, useEffectEvent, useReducer, useRef } from 'react';
import { assertNever } from '../../../shared/assertNever';
import type { UploadTransport } from '../api/uploadTransport';
import type { UploadItem, UploadQueue } from '../model/uploadQueue';
import { loadQueue, saveQueue, toPersistedQueue } from '../model/persistence';
import { planAddedFiles, selectItemsToStart, uploadQueueReducer } from '../model/uploadQueue';

export type UploadQueueControls = Readonly<{
  items: UploadQueue;
  addFiles: (files: readonly File[]) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
}>;

const UNEXPECTED_ABORT_ERROR = 'Upload was interrupted';

function createId(): string {
  return crypto.randomUUID();
}

export function useUploadQueue(transport: UploadTransport): UploadQueueControls {
  // Lazy initialiser: storage is read once on mount, not on every render.
  const [items, dispatch] = useReducer(uploadQueueReducer, undefined, loadQueue);
  // File objects and AbortControllers are not serialisable and never drive rendering, so they
  // live in refs keyed by item id rather than in reducer state.
  const filesRef = useRef(new Map<string, File>());
  const controllersRef = useRef(new Map<string, AbortController>());

  // An effect event: called by the scheduler effect, reads the latest transport without making
  // it a dependency that would re-run scheduling.
  const startAttempt = useEffectEvent((item: UploadItem, file: File) => {
    const { id } = item;
    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    // A controller that is no longer the registered one belongs to a cancelled, removed or
    // unmounted attempt; its late events must not touch state.
    const isCurrentAttempt = (): boolean => controllersRef.current.get(id) === controller;
    dispatch({ type: 'started', id });

    void transport({
      file,
      idempotencyKey: item.idempotencyKey,
      signal: controller.signal,
      onProgress: (progress) => {
        if (isCurrentAttempt()) {
          dispatch({ type: 'progressed', id, progress });
        }
      },
    }).then((outcome) => {
      if (!isCurrentAttempt()) {
        return;
      }
      controllersRef.current.delete(id);
      switch (outcome.kind) {
        case 'success':
          dispatch({ type: 'succeeded', id });
          return;
        case 'error':
          dispatch({ type: 'attemptFailed', id, error: outcome.message, failedAt: Date.now() });
          return;
        case 'aborted':
          // We didn't abort it (our aborts unregister the controller first), so something else
          // did, e.g. the browser. Treat it as a failed attempt rather than leave it "uploading".
          dispatch({
            type: 'attemptFailed',
            id,
            error: UNEXPECTED_ABORT_ERROR,
            failedAt: Date.now(),
          });
          return;
        default:
          assertNever(outcome);
      }
    });
  });

  // The scheduler: whenever the queue changes (a file added, an upload finished, failed or was
  // cancelled), fill the free slots. The controller map doubles as an in-flight guard, so a
  // re-run of this effect (including StrictMode's) can never start the same item twice.
  useEffect(() => {
    for (const item of selectItemsToStart(items)) {
      const file = filesRef.current.get(item.id);
      if (file !== undefined && !controllersRef.current.has(item.id)) {
        startAttempt(item, file);
      }
    }
  }, [items]);

  // Progress events re-render many times a second but never change what is persisted, so only
  // write when the stored snapshot (names, sizes, keys, statuses) actually differs.
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    const snapshot = toPersistedQueue(items);
    const serialised = JSON.stringify(snapshot);
    if (serialised !== lastSavedRef.current) {
      lastSavedRef.current = serialised;
      saveQueue(snapshot);
    }
  }, [items]);

  // Backoff: one timer per retrying item, derived from its `retryAt` deadline and cleared on
  // every re-run. Rescheduling (e.g. after a progress re-render) keeps the same deadline, and a
  // cancel or removal drops the item from the next run, which clears its timer.
  useEffect(() => {
    const timerIds: ReturnType<typeof setTimeout>[] = [];
    for (const item of items) {
      if (item.status === 'retrying') {
        const remainingMs = Math.max(0, item.retryAt - Date.now());
        timerIds.push(
          setTimeout(() => {
            dispatch({ type: 'retryDue', id: item.id });
          }, remainingMs),
        );
      }
    }
    return () => {
      for (const timerId of timerIds) {
        clearTimeout(timerId);
      }
    };
  }, [items]);

  // In-flight requests outlive individual renders, so they are aborted only when the hook
  // disconnects. Each aborted item is re-queued rather than left "uploading": if the effects
  // reconnect (Fast Refresh, <Activity>), the scheduler restarts it instead of losing a slot.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const [id, controller] of controllers) {
        controller.abort();
        dispatch({ type: 'interrupted', id });
      }
      controllers.clear();
    };
  }, []);

  // Aborts the item's in-flight request, if any. A pending retry needs no handling here: the
  // status change that follows clears its timer in the backoff effect.
  function abortRequest(id: string): void {
    const controller = controllersRef.current.get(id);
    // Unregister first so the aborted attempt's outcome is recognised as stale.
    controllersRef.current.delete(id);
    controller?.abort();
  }

  function addFiles(files: readonly File[]): void {
    const { newItems, reattachedIds, assignments } = planAddedFiles(items, files, createId);
    for (const { itemId, file } of assignments) {
      filesRef.current.set(itemId, file);
    }
    dispatch({ type: 'filesAdded', newItems, reattachedIds });
  }

  function cancel(id: string): void {
    abortRequest(id);
    dispatch({ type: 'cancelled', id });
  }

  function retry(id: string): void {
    dispatch({ type: 'retryRequested', id });
  }

  function remove(id: string): void {
    abortRequest(id);
    filesRef.current.delete(id);
    dispatch({ type: 'removed', id });
  }

  return { items, addFiles, cancel, retry, remove };
}
