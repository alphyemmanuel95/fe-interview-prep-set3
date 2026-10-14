export type Question = Readonly<{
  number: number;
  title: string;
  path: string;
  summary: string;
}>;

export const QUESTIONS = [
  {
    number: 1,
    title: 'Expense Tracker',
    path: '/expenses',
    summary: 'Persisted expenses with monthly and per-category totals.',
  },
  {
    number: 2,
    title: 'City Typeahead',
    path: '/typeahead',
    summary: 'Debounced, cached, cancellable ARIA combobox.',
  },
  {
    number: 3,
    title: 'Event Booking Form',
    path: '/booking',
    summary: 'Multi-step seat booking with review and saved progress.',
  },
  {
    number: 4,
    title: 'File Explorer Tree',
    path: '/file-tree',
    summary: 'Reusable lazy tree with search and shareable URL state.',
  },
  {
    number: 5,
    title: 'Resumable File Uploader',
    path: '/uploader',
    summary: 'Concurrency-limited upload queue with retries and backoff.',
  },
] as const satisfies readonly Question[];
