import { useId, useReducer, type ChangeEvent, type JSX, type KeyboardEvent } from 'react';
import { useCitySearch } from '../hooks/useCitySearch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { comboboxReducer, initialComboboxState } from '../model/comboboxReducer';
import { SEARCH_DEBOUNCE_MS } from '../model/constants';
import { normaliseQuery } from '../model/normaliseQuery';
import { toOptionId } from '../model/optionId';
import type { CitySuggestion } from '../model/types';
import { SuggestionList } from './SuggestionList';
import './CityCombobox.css';

const EMPTY_SUGGESTIONS: readonly CitySuggestion[] = [];

// WAI-ARIA 1.2 combobox with a listbox popup. Focus always stays on the input; the active option
// is exposed through aria-activedescendant so screen readers follow the arrow keys.
export function CityCombobox(): JSX.Element {
  const [state, dispatch] = useReducer(comboboxReducer, initialComboboxState);
  const debouncedQuery = useDebouncedValue(state.inputValue, SEARCH_DEBOUNCE_MS);
  const search = useCitySearch(debouncedQuery);

  const inputId = useId();
  const labelId = useId();
  const listboxId = useId();

  const hasQuery = normaliseQuery(state.inputValue) !== '';
  const isPopupOpen = state.isOpen && hasQuery;
  const suggestions =
    search.state.status === 'success' ? search.state.suggestions : EMPTY_SUGGESTIONS;
  const isExpanded = isPopupOpen && suggestions.length > 0;
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
        if (activeSuggestion !== undefined) {
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
          onSelect={handleSelect}
        />
      </div>
      {state.selected !== null && (
        <p className="city-combobox__selection">
          Selected: <strong>{state.selected.name}</strong> ({state.selected.city})
        </p>
      )}
    </div>
  );
}
