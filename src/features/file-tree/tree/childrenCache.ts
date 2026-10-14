// Children of every branch the tree has asked for, keyed by branch id. It lives outside React
// state so the in-flight promise can be shared synchronously: a second expand, a StrictMode
// re-run of the load effect, or two callers in the same tick all get the same request instead of
// racing to set a "loading" flag that React has not committed yet.

export type ChildrenState<T> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: string; settledOrder: number }>
  | Readonly<{ status: 'success'; children: readonly T[]; settledOrder: number }>;

/** A missing entry means the branch has never been requested. */
export type ChildrenSnapshot<T> = ReadonlyMap<string, ChildrenState<T>>;

export type FetchChildren<T> = (signal: AbortSignal) => Promise<readonly T[]>;

export type ChildrenCache<T> = Readonly<{
  getSnapshot: () => ChildrenSnapshot<T>;
  subscribe: (listener: () => void) => () => void;
  /** Starts a load unless one is in flight or already succeeded; failed loads are retried. */
  load: (id: string, fetchChildren: FetchChildren<T>) => Promise<void>;
  /** Returns a disconnect function that aborts every in-flight load once nobody is connected. */
  connect: () => () => void;
}>;

const UNKNOWN_ERROR = 'Something went wrong while loading.';

export function createChildrenCache<T>(): ChildrenCache<T> {
  let snapshot: ChildrenSnapshot<T> = new Map();
  const inFlight = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  const controller = new AbortController();
  // Increases with every load that settles, so the latest outcome can be announced.
  let settledCount = 0;
  let pendingAbort: ReturnType<typeof setTimeout> | undefined;

  // Immutable snapshots let `useSyncExternalStore` and `useMemo` detect changes by identity.
  const setEntry = (id: string, state: ChildrenState<T> | null): void => {
    const next = new Map(snapshot);
    if (state === null) {
      next.delete(id);
    } else {
      next.set(id, state);
    }
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  };

  const run = async (id: string, fetchChildren: FetchChildren<T>): Promise<void> => {
    setEntry(id, { status: 'loading' });
    try {
      const children = await fetchChildren(controller.signal);
      settledCount += 1;
      setEntry(id, { status: 'success', children, settledOrder: settledCount });
    } catch (error: unknown) {
      // Aborted only when the tree unmounted: forget the entry rather than report a failure.
      if (controller.signal.aborted) {
        setEntry(id, null);
        return;
      }
      settledCount += 1;
      setEntry(id, {
        status: 'error',
        settledOrder: settledCount,
        error: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    } finally {
      inFlight.delete(id);
    }
  };

  const load = (id: string, fetchChildren: FetchChildren<T>): Promise<void> => {
    const pending = inFlight.get(id);
    if (pending !== undefined) {
      return pending;
    }
    if (snapshot.get(id)?.status === 'success') {
      return Promise.resolve();
    }
    const request = run(id, fetchChildren);
    inFlight.set(id, request);
    return request;
  };

  // StrictMode runs disconnect → connect synchronously on mount. Deferring the abort by one task
  // lets that replay cancel it, so dev mode neither aborts nor re-fetches; a real unmount aborts.
  const connect = (): (() => void) => {
    clearTimeout(pendingAbort);
    return () => {
      pendingAbort = setTimeout(() => {
        controller.abort();
      }, 0);
    };
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { getSnapshot: () => snapshot, subscribe, load, connect };
}
