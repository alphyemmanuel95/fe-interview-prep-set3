import type { JSX, MouseEvent } from 'react';
import { toOptionId } from '../model/optionId';
import type { CitySuggestion } from '../model/types';
import { HighlightedText } from './HighlightedText';
import './SuggestionList.css';

type SuggestionListProps = Readonly<{
  id: string;
  labelId: string;
  suggestions: readonly CitySuggestion[];
  /** The query the suggestions were fetched for, highlighted inside each option. */
  query: string;
  activeId: number | null;
  isHidden: boolean;
  onSelect: (suggestion: CitySuggestion) => void;
}>;

// Focus stays on the input (aria-activedescendant), so the browser won't scroll the active option
// into view for us. A module-level callback has a stable identity, so React only calls it when
// the ref moves to a different option, not on every render.
const scrollIntoViewNearest = (option: HTMLDivElement | null): void => {
  option?.scrollIntoView({ block: 'nearest' });
};

export function SuggestionList({
  id,
  labelId,
  suggestions,
  query,
  activeId,
  isHidden,
  onSelect,
}: SuggestionListProps): JSX.Element {
  return (
    // Always rendered so the input's aria-controls never points at a missing element.
    <div id={id} role="listbox" aria-labelledby={labelId} className="suggestions" hidden={isHidden}>
      {suggestions.map((suggestion) => {
        const isActive = suggestion.id === activeId;
        // Select on mousedown and cancel its default so focus never leaves the input:
        // a click would blur first, closing the list before the selection lands.
        const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
          event.preventDefault();
          onSelect(suggestion);
        };
        return (
          <div
            key={suggestion.id}
            ref={isActive ? scrollIntoViewNearest : undefined}
            id={toOptionId(id, suggestion.id)}
            role="option"
            // Explicit name so assistive tech hears "Name, City" rather than the run-together segments.
            aria-label={`${suggestion.name}, ${suggestion.city}`}
            aria-selected={isActive}
            tabIndex={-1}
            className={
              isActive ? 'suggestions__option suggestions__option--active' : 'suggestions__option'
            }
            onMouseDown={handleMouseDown}
          >
            <span className="suggestions__name">
              <HighlightedText text={suggestion.name} query={query} />
            </span>
            <span className="suggestions__city">
              <HighlightedText text={suggestion.city} query={query} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
