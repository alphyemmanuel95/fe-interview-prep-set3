import type { JSX } from 'react';
import { CityCombobox } from './components/CityCombobox';

export function TypeaheadPage(): JSX.Element {
  return (
    <section aria-labelledby="typeahead-title">
      <h1 id="typeahead-title">Q2 — City Typeahead</h1>
      <p>
        Find people and the city they live in. Use the arrow keys to move through suggestions, Enter
        to select and Escape to close.
      </p>
      <CityCombobox />
    </section>
  );
}
