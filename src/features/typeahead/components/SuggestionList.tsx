import type { JSX, MouseEvent } from 'react';
import { toOptionId } from '../model/optionId';
import type { CitySuggestion } from '../model/types';
import './SuggestionList.css';

type SuggestionListProps = Readonly<{
  id: string;
  labelId: string;
  suggestions: readonly CitySuggestion[];
  activeId: number | null;
  isHidden: boolean;
  onSelect: (suggestion: CitySuggestion) => void;
}>;

export function SuggestionList({
  id,
  labelId,
  suggestions,
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
            id={toOptionId(id, suggestion.id)}
            role="option"
            aria-selected={isActive}
            tabIndex={-1}
            className={
              isActive ? 'suggestions__option suggestions__option--active' : 'suggestions__option'
            }
            onMouseDown={handleMouseDown}
          >
            <span className="suggestions__name">{suggestion.name}</span>
            <span className="suggestions__city">{suggestion.city}</span>
          </div>
        );
      })}
    </div>
  );
}
