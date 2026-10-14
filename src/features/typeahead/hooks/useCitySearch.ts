import { useEffect, useState } from 'react';
import { fetchCitySuggestions } from '../api/fetchCitySuggestions';
import type { CitySearchState, CitySuggestion } from '../model/types';

type SettledSearch = Readonly<
  | { query: string; outcome: 'success'; suggestions: readonly CitySuggestion[] }
  | { query: string; outcome: 'error'; message: string }
>;

export type CitySearch = Readonly<{
  state: CitySearchState;
  retry: () => void;
}>;

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

function deriveState(query: string, settled: SettledSearch | null): CitySearchState {
  if (query === '') {
    return { status: 'idle' };
  }
  if (settled?.query !== query) {
    return { status: 'loading' };
  }
  if (settled.outcome === 'error') {
    return { status: 'error', message: settled.message };
  }
  return settled.suggestions.length === 0
    ? { status: 'empty' }
    : { status: 'success', suggestions: settled.suggestions };
}

export function useCitySearch(rawQuery: string): CitySearch {
  const query = rawQuery.trim();
  const [settled, setSettled] = useState<SettledSearch | null>(null);
  const isSettled = settled?.query === query;

  useEffect(() => {
    if (query === '' || isSettled) {
      return;
    }
    const controller = new AbortController();
    void fetchCitySuggestions(query, controller.signal).then(
      (suggestions) => {
        setSettled({ query, outcome: 'success', suggestions });
      },
      (error: unknown) => {
        // An aborted request was superseded or unmounted; it is not a failure the user should see.
        if (controller.signal.aborted) {
          return;
        }
        setSettled({ query, outcome: 'error', message: toErrorMessage(error) });
      },
    );
    // Abort (not just ignore) the in-flight request when a newer query starts or on unmount,
    // so the browser cancels it and a slow stale response can never overwrite a newer one.
    return () => {
      controller.abort();
    };
  }, [query, isSettled]);

  return {
    state: deriveState(query, settled),
    retry: () => {
      setSettled(null);
    },
  };
}
