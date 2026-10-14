import type { JSX } from 'react';
import { assertNever } from '../../../shared/assertNever';
import type { CitySearchState, CitySuggestion } from '../model/types';
import './SearchStatus.css';

type SearchStatusProps = Readonly<{
  state: CitySearchState;
  /** The normalised query that was searched, quoted back in the empty message. */
  query: string;
  isVisible: boolean;
  /** A committed selection, announced through the same live region as the search status. */
  selected: CitySuggestion | null;
  /** False while a newer query is pending, so Retry can't re-run the query being replaced. */
  canRetry: boolean;
  onRetry: () => void;
}>;

function describeStatus(state: CitySearchState, query: string): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Searching…';
    case 'error':
      return `Couldn't load results (${state.message}).`;
    case 'empty':
      return `No results for '${query}'`;
    case 'success':
      return `${state.suggestions.length} ${state.suggestions.length === 1 ? 'result' : 'results'} available`;
    default:
      return assertNever(state);
  }
}

function toMessage(
  state: CitySearchState,
  query: string,
  isVisible: boolean,
  selected: CitySuggestion | null,
): string {
  if (selected !== null) {
    return `Selected ${selected.name}, ${selected.city}`;
  }
  return isVisible ? describeStatus(state, query) : '';
}

function messageClassName(isError: boolean, hasSelection: boolean): string {
  if (isError) {
    return 'search-status__message search-status__message--error';
  }
  if (hasSelection) {
    return 'search-status__message search-status__message--selected';
  }
  return 'search-status__message';
}

export function SearchStatus({
  state,
  query,
  isVisible,
  selected,
  canRetry,
  onRetry,
}: SearchStatusProps): JSX.Element {
  const isError = state.status === 'error';
  const message = toMessage(state, query, isVisible, selected);
  return (
    <div className="search-status">
      {/* The live region stays mounted and only its text changes, so every update is announced. */}
      <p role="status" aria-live="polite" className={messageClassName(isError, selected !== null)}>
        {message}
      </p>
      {isVisible && canRetry && isError && (
        <button type="button" className="search-status__retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
