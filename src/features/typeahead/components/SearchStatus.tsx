import type { JSX } from 'react';
import { assertNever } from '../../../shared/assertNever';
import type { CitySearchState } from '../model/types';
import './SearchStatus.css';

type SearchStatusProps = Readonly<{
  state: CitySearchState;
  /** The query as the user typed it, quoted back in the empty message. */
  query: string;
  isVisible: boolean;
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

export function SearchStatus({ state, query, isVisible, onRetry }: SearchStatusProps): JSX.Element {
  const isError = state.status === 'error';
  return (
    <div className="search-status">
      {/* The live region stays mounted and only its text changes, so every update is announced. */}
      <p
        role="status"
        aria-live="polite"
        className={
          isError
            ? 'search-status__message search-status__message--error'
            : 'search-status__message'
        }
      >
        {isVisible ? describeStatus(state, query) : ''}
      </p>
      {isVisible && isError && (
        <button type="button" className="search-status__retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
