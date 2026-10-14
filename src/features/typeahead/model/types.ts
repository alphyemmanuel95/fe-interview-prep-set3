export type CitySuggestion = Readonly<{
  id: number;
  name: string;
  city: string;
}>;

export type CitySearchState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'success'; suggestions: readonly CitySuggestion[] }>;
