import { useEffect, useState } from 'react';
import { fetchCitySuggestions } from '../api/fetchCitySuggestions';
import { normaliseQuery } from '../model/normaliseQuery';
import type { CitySearchState, CitySuggestion } from '../model/types';

type SuggestionCache = ReadonlyMap<string, readonly CitySuggestion[]>;

export type CitySearch = Readonly<{
  state: CitySearchState;
  retry: () => void;
}>;

function deriveState(
  query: string,
  cache: SuggestionCache,
  failedQuery: string | null,
): CitySearchState {
  if (query === '') {
    return { status: 'idle' };
  }
  const cached = cache.get(query);
  if (cached !== undefined) {
    return cached.length === 0 ? { status: 'empty' } : { status: 'success', suggestions: cached };
  }
  if (failedQuery === query) {
    return { status: 'error' };
  }
  return { status: 'loading' };
}

export function useCitySearch(rawQuery: string): CitySearch {
  const query = normaliseQuery(rawQuery);
  // The cache lives in state, scoped to this hook instance: render derives the status from it
  // (a ref can't be read during render), the update re-renders on arrival, and it is released
  // with the component. A module-level Map would leak across tests and grow for the app's lifetime.
  // It is replaced, never mutated, so React sees every change.
  const [cache, setCache] = useState<SuggestionCache>(() => new Map());
  // Only successes are cached. The last failure is kept separately so Retry can clear it and
  // trigger a fresh request instead of replaying a cached error.
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  // A failure belongs to the query that produced it. Drop it as soon as the query moves on, so
  // returning to that query refetches instead of replaying a stale error. Adjusting state during
  // render (rather than in an effect) avoids rendering the stale error even once.
  if (failedQuery !== null && failedQuery !== query) {
    setFailedQuery(null);
  }
  const isCached = cache.has(query);
  const hasFailed = failedQuery === query;

  useEffect(() => {
    // A cache hit resolves synchronously during render: no request, no loading flash.
    if (query === '' || isCached || hasFailed) {
      return;
    }
    const controller = new AbortController();
    void fetchCitySuggestions(query, controller.signal).then(
      (suggestions) => {
        // The body can finish parsing just after the abort. Drop it so nothing is set after
        // unmount; a later visit to this query simply refetches.
        if (controller.signal.aborted) {
          return;
        }
        setCache((previous) => new Map(previous).set(query, suggestions));
      },
      () => {
        // An aborted request was superseded or unmounted; it is not a failure the user should see.
        if (controller.signal.aborted) {
          return;
        }
        setFailedQuery(query);
      },
    );
    // Abort (not just ignore) the in-flight request when a newer query starts or on unmount,
    // so the browser cancels it and a slow stale response can never overwrite a newer one.
    return () => {
      controller.abort();
    };
  }, [query, isCached, hasFailed]);

  return {
    state: deriveState(query, cache, failedQuery),
    retry: () => {
      setFailedQuery(null);
    },
  };
}
