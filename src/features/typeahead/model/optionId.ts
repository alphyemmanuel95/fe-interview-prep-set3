/** DOM id of an option, shared by the listbox and the input's `aria-activedescendant`. */
export function toOptionId(listboxId: string, suggestionId: number): string {
  return `${listboxId}-option-${suggestionId}`;
}
