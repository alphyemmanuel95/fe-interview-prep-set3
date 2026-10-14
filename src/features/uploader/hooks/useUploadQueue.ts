import { useEffect, useEffectEvent, useReducer, useRef } from 'react';
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
  const retryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
      if (outcome.kind === 'success') {
        dispatch({ type: 'succeeded', id });
      } else if (outcome.kind === 'error') {
        dispatch({ type: 'attemptFailed', id, error: outcome.message });
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

  // Backoff: each item entering "retrying" gets one timer that re-queues it after its delay.
  useEffect(() => {
    const retryTimers = retryTimersRef.current;
    for (const item of items) {
      if (item.status === 'retrying' && !retryTimers.has(item.id)) {
        const timerId = setTimeout(() => {
          retryTimers.delete(item.id);
          dispatch({ type: 'retryDue', id: item.id });
        }, item.retryDelayMs);
        retryTimers.set(item.id, timerId);
      }
    }
  }, [items]);

  // Requests and backoff timers outlive individual renders, so they are torn down once, on
  // unmount, instead of in the per-render effects above.
  useEffect(() => {
    const controllers = controllersRef.current;
    const retryTimers = retryTimersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      for (const timerId of retryTimers.values()) {
        clearTimeout(timerId);
      }
      retryTimers.clear();
    };
  }, []);

  // Stops whatever the item is doing right now: an in-flight request or a pending retry.
  function stopItem(id: string): void {
    const controller = controllersRef.current.get(id);
    // Unregister first so the aborted attempt's outcome is recognised as stale.
    controllersRef.current.delete(id);
    controller?.abort();
    clearTimeout(retryTimersRef.current.get(id));
    retryTimersRef.current.delete(id);
  }

  function addFiles(files: readonly File[]): void {
    const { newItems, reattachedIds, assignments } = planAddedFiles(items, files, createId);
    for (const { itemId, file } of assignments) {
      filesRef.current.set(itemId, file);
    }
    dispatch({ type: 'filesAdded', newItems, reattachedIds });
  }

  function cancel(id: string): void {
    stopItem(id);
    dispatch({ type: 'cancelled', id });
  }

  function retry(id: string): void {
    dispatch({ type: 'retryRequested', id });
  }

  function remove(id: string): void {
    stopItem(id);
    filesRef.current.delete(id);
    dispatch({ type: 'removed', id });
  }

  return { items, addFiles, cancel, retry, remove };
}
