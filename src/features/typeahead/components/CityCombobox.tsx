import { useId, useReducer, useRef, type ChangeEvent, type JSX, type KeyboardEvent } from 'react';
import { useCitySearch } from '../hooks/useCitySearch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { comboboxReducer, initialComboboxState } from '../model/comboboxReducer';
import { SEARCH_DEBOUNCE_MS } from '../model/constants';
import { normaliseQuery } from '../model/normaliseQuery';
import { toOptionId } from '../model/optionId';
import type { CitySuggestion } from '../model/types';
import { SearchStatus } from './SearchStatus';
import { SuggestionList } from './SuggestionList';
import './CityCombobox.css';

const EMPTY_SUGGESTIONS: readonly CitySuggestion[] = [];

// WAI-ARIA 1.2 combobox with a listbox popup. Focus always stays on the input; the active option
// is exposed through aria-activedescendant so screen readers follow the arrow keys.
export function CityCombobox(): JSX.Element {
  const [state, dispatch] = useReducer(comboboxReducer, initialComboboxState);
  // A committed selection is not a query: searching for the chosen name would send a request
  // nobody asked for. Search goes idle at once and resumes when the user edits the text again.
  const hasSelection = state.selected !== null;
  const searchQuery = hasSelection ? '' : state.inputValue;
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const search = useCitySearch(hasSelection ? '' : debouncedQuery);
  // The search state describes debouncedQuery. Until the debounce catches up with the input, the
  // results on screen belong to an older query: they stay visible (dimmed, aria-busy) but can't
  // be selected or retried.
  const isStale = normaliseQuery(searchQuery) !== normaliseQuery(debouncedQuery);

  const inputId = useId();
  const labelId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasQuery = normaliseQuery(state.inputValue) !== '';
  const isPopupOpen = state.isOpen && hasQuery;
  const suggestions =
    search.state.status === 'success' ? search.state.suggestions : EMPTY_SUGGESTIONS;
  const isExpanded = isPopupOpen && suggestions.length > 0;
  // Keep an error on screen after blur so keyboard users can Tab from the input to Retry.
  const isStatusVisible = hasQuery && (state.isOpen || search.state.status === 'error');
  // Indexing yields undefined when results changed under a stale index, which safely clears it.
  const activeSuggestion =
    isExpanded && state.activeIndex !== null ? suggestions[state.activeIndex] : undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    dispatch({ type: 'inputChanged', value: event.target.value });
  };

  const handleSelect = (suggestion: CitySuggestion): void => {
    dispatch({ type: 'optionSelected', option: suggestion });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // Stop the caret jumping to the start/end of the text.
        event.preventDefault();
        dispatch({
          type: 'activeMoved',
          direction: event.key === 'ArrowDown' ? 'next' : 'previous',
          optionCount: suggestions.length,
        });
        break;
      case 'Enter':
        if (activeSuggestion !== undefined && !isStale) {
          event.preventDefault();
          handleSelect(activeSuggestion);
        }
        break;
      case 'Escape':
        dispatch({ type: 'closed' });
        break;
      default:
        break;
    }
  };

  const handleRetry = (): void => {
    search.retry();
    dispatch({ type: 'opened' });
    // The Retry button disappears once loading starts; return focus to where the results will appear.
    inputRef.current?.focus();
  };

  const handleBlur = (): void => {
    dispatch({ type: 'closed' });
  };

  return (
    <div className="city-combobox">
      <label id={labelId} htmlFor={inputId} className="city-combobox__label">
        Search people by name or city
      </label>
      <div className="city-combobox__field">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          className="city-combobox__input"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-activedescendant={
            activeSuggestion === undefined ? undefined : toOptionId(listboxId, activeSuggestion.id)
          }
          value={state.inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        <SuggestionList
          id={listboxId}
          labelId={labelId}
          suggestions={suggestions}
          query={normaliseQuery(debouncedQuery)}
          activeId={activeSuggestion?.id ?? null}
          isHidden={!isExpanded}
          isStale={isStale}
          onSelect={handleSelect}
        />
      </div>
      <SearchStatus
        state={search.state}
        query={debouncedQuery.trim()}
        isVisible={isStatusVisible}
        selected={state.selected}
        canRetry={!isStale}
        onRetry={handleRetry}
      />
    </div>
  );
}
