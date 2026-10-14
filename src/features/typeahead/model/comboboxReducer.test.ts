import { describe, expect, it } from 'vitest';
import { comboboxReducer, initialComboboxState, type ComboboxState } from './comboboxReducer';

const option = { id: 7, name: 'Delia Moss', city: 'Delft' };
const openState: ComboboxState = { ...initialComboboxState, inputValue: 'del', isOpen: true };

describe('comboboxReducer', () => {
  it('opens and clears the active option and selection when the input changes', () => {
    const state = comboboxReducer(
      { inputValue: 'de', isOpen: false, activeIndex: 2, selected: option },
      { type: 'inputChanged', value: 'del' },
    );
    expect(state).toEqual({ inputValue: 'del', isOpen: true, activeIndex: null, selected: null });
  });

  it('moves to the first option on next and the last on previous when none is active', () => {
    expect(
      comboboxReducer(openState, { type: 'activeMoved', direction: 'next', optionCount: 3 })
        .activeIndex,
    ).toBe(0);
    expect(
      comboboxReducer(openState, { type: 'activeMoved', direction: 'previous', optionCount: 3 })
        .activeIndex,
    ).toBe(2);
  });

  it('wraps around at both ends', () => {
    const atLast = { ...openState, activeIndex: 2 };
    const atFirst = { ...openState, activeIndex: 0 };
    expect(
      comboboxReducer(atLast, { type: 'activeMoved', direction: 'next', optionCount: 3 })
        .activeIndex,
    ).toBe(0);
    expect(
      comboboxReducer(atFirst, { type: 'activeMoved', direction: 'previous', optionCount: 3 })
        .activeIndex,
    ).toBe(2);
  });

  it('keeps no active option when there are no options', () => {
    expect(
      comboboxReducer(openState, { type: 'activeMoved', direction: 'next', optionCount: 0 })
        .activeIndex,
    ).toBeNull();
  });

  it('fills the input, closes and records the selection when an option is selected', () => {
    const state = comboboxReducer(
      { ...openState, activeIndex: 1 },
      { type: 'optionSelected', option },
    );
    expect(state).toEqual({
      inputValue: 'Delia Moss',
      isOpen: false,
      activeIndex: null,
      selected: option,
    });
  });

  it('closes and forgets the active option but keeps the text', () => {
    const state = comboboxReducer({ ...openState, activeIndex: 1 }, { type: 'closed' });
    expect(state).toEqual({ ...openState, isOpen: false, activeIndex: null });
  });
});
