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
  // Replaced on reconnect after an abort, so a cache reused by a remounted tree can load again.
  let controller = new AbortController();
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
    const { signal } = controller;
    setEntry(id, { status: 'loading' });
    try {
      const children = await fetchChildren(signal);
      settledCount += 1;
      setEntry(id, { status: 'success', children, settledOrder: settledCount });
    } catch (error: unknown) {
      // Aborted only when the tree unmounted: forget the entry rather than report a failure.
      if (signal.aborted) {
        setEntry(id, null);
        return;
      }
      settledCount += 1;
      setEntry(id, {
        status: 'error',
        settledOrder: settledCount,
        error: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
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
    // `run` can settle synchronously (a loader that throws before returning a promise). Clearing
    // the entry in `.finally` — always a later microtask — and only if it is still this request
    // guarantees the cleanup never runs before `set`, which would cache a settled promise forever.
    const request = run(id, fetchChildren).finally(() => {
      if (inFlight.get(id) === request) {
        inFlight.delete(id);
      }
    });
    inFlight.set(id, request);
    return request;
  };

  // StrictMode replays every mount as mount → unmount → mount, synchronously. Deferring the abort
  // by one task lets that replayed connect cancel it, so dev mode neither aborts nor re-fetches,
  // while a real unmount still aborts on the next task. If the tree comes back after the abort
  // ran (e.g. shown again by <Activity>), it gets a fresh controller instead of a dead one.
  const connect = (): (() => void) => {
    clearTimeout(pendingAbort);
    if (controller.signal.aborted) {
      controller = new AbortController();
    }
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
