import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createChildrenCache, type ChildrenSnapshot } from './childrenCache';

export type LoadChildren<T> = (item: T, signal: AbortSignal) => Promise<readonly T[]>;

export type ChildrenLoader<T> = Readonly<{
  childrenById: ChildrenSnapshot<T>;
  /** Idempotent: safe to call on every render pass; also how a failed branch is retried. */
  load: (item: T) => void;
}>;

/** `loadChildren` and `getId` must be stable, or `load` changes identity on every render. */
export function useChildrenLoader<T>(
  loadChildren: LoadChildren<T>,
  getId: (item: T) => string,
): ChildrenLoader<T> {
  // One cache per tree instance; lazy init so StrictMode's double render doesn't matter.
  const [cache] = useState(() => createChildrenCache<T>());
  const childrenById = useSyncExternalStore(cache.subscribe, cache.getSnapshot);

  useEffect(() => cache.connect(), [cache]);

  const load = useCallback(
    (item: T) => {
      void cache.load(getId(item), (signal) => loadChildren(item, signal));
    },
    [cache, getId, loadChildren],
  );

  return { childrenById, load };
}
