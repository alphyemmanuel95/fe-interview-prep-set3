import { assertNever } from '../../../shared/assertNever';
import type { CitySuggestion } from './types';

export type ComboboxState = Readonly<{
  inputValue: string;
  isOpen: boolean;
  /** Index into the currently rendered options; `null` means no option is active. */
  activeIndex: number | null;
  selected: CitySuggestion | null;
}>;

export type ComboboxAction =
  | Readonly<{ type: 'inputChanged'; value: string }>
  | Readonly<{ type: 'activeMoved'; direction: 'next' | 'previous'; optionCount: number }>
  | Readonly<{ type: 'optionSelected'; option: CitySuggestion }>
  | Readonly<{ type: 'opened' }>
  | Readonly<{ type: 'closed' }>;

export const initialComboboxState: ComboboxState = {
  inputValue: '',
  isOpen: false,
  activeIndex: null,
  selected: null,
};

function moveActiveIndex(
  current: number | null,
  direction: 'next' | 'previous',
  optionCount: number,
): number | null {
  if (optionCount === 0) {
    return null;
  }
  const lastIndex = optionCount - 1;
  if (current === null) {
    return direction === 'next' ? 0 : lastIndex;
  }
  // Wrap around at both ends, as the WAI-ARIA combobox pattern allows.
  const offset = direction === 'next' ? 1 : -1;
  return (current + offset + optionCount) % optionCount;
}

export function comboboxReducer(state: ComboboxState, action: ComboboxAction): ComboboxState {
  switch (action.type) {
    case 'inputChanged':
      // Editing the text invalidates both the highlighted option and any previous selection.
      return { inputValue: action.value, isOpen: true, activeIndex: null, selected: null };
    case 'activeMoved':
      return {
        ...state,
        isOpen: true,
        activeIndex: moveActiveIndex(state.activeIndex, action.direction, action.optionCount),
      };
    case 'optionSelected':
      return {
        inputValue: action.option.name,
        isOpen: false,
        activeIndex: null,
        selected: action.option,
      };
    case 'opened':
      return { ...state, isOpen: true };
    case 'closed':
      return { ...state, isOpen: false, activeIndex: null };
    default:
      return assertNever(action);
  }
}
