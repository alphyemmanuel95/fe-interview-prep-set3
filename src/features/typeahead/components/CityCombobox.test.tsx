import { act, render, screen } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS } from '../model/constants';
import { CityCombobox } from './CityCombobox';

const USERS = [
  { id: 1, firstName: 'Adele', lastName: 'Hart', address: { city: 'Delhi' } },
  { id: 2, firstName: 'Delia', lastName: 'Moss', address: { city: 'Delft' } },
  { id: 3, firstName: 'Fidel', lastName: 'Ortiz', address: { city: 'Lima' } },
];

type FetchInput = Parameters<typeof fetch>[0];

function searchTermOf(input: FetchInput): string {
  if (typeof input !== 'string') {
    throw new Error('Expected fetch to be called with a URL string');
  }
  return new URL(input).searchParams.get('q') ?? '';
}

// A tiny in-memory stand-in for the search endpoint: matches name or city, like the real API.
const respondFromFixtures: typeof fetch = (input) => {
  const term = searchTermOf(input);
  const users = USERS.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.address.city}`.toLowerCase().includes(term),
  );
  return Promise.resolve(Response.json({ users }));
};

// Never settles on its own; rejects like the real fetch once its signal is aborted.
const respondNeverUntilAborted: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });

// delay: null makes each typing call one microtask chain, so no timer (debounce or wall clock)
// can fire between keystrokes; the debounce only elapses when a test calls finishTyping().
const USER_EVENT_OPTIONS = { delay: null } as const;

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const scrollIntoViewMock = vi.fn<Element['scrollIntoView']>();

type SetupResult = Readonly<{
  user: ReturnType<typeof userEvent.setup>;
  input: HTMLElement;
  unmount: () => void;
}>;

function setup(ui: ReactElement = <CityCombobox />): SetupResult {
  const user = userEvent.setup(USER_EVENT_OPTIONS);
  const { unmount } = render(ui);
  return {
    user,
    input: screen.getByRole('combobox', { name: 'Search people by name or city' }),
    unmount,
  };
}

/** Moves the fake clock past the debounce, then lets the stubbed response settle. */
async function finishTyping(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
  await settleRequests();
}

/** Flushes the stubbed fetch's promise chain and the resulting render. */
async function settleRequests(): Promise<void> {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

beforeEach(() => {
  // shouldAdvanceTime is required: RTL's asyncWrapper (used by user-event) awaits a setTimeout(0)
  // and only auto-advances Jest's fake timers, so under Vitest it would otherwise hang.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock = vi.fn<typeof fetch>(respondFromFixtures);
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no layout, so it doesn't implement scrollIntoView.
  scrollIntoViewMock.mockReset();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

describe('CityCombobox search', () => {
  it('sends no new request when backspacing to an already-searched query', async () => {
    const { user, input } = setup();

    await user.type(input, 'del');
    await finishTyping();
    expect(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' })).toBeInTheDocument();

    await user.type(input, 'h');
    await finishTyping();
    expect(screen.queryByRole('option', { name: 'Fidel Ortiz, Lima' })).not.toBeInTheDocument();

    await user.type(input, '{Backspace}');
    await finishTyping();

    expect(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([request]) => searchTermOf(request))).toEqual(['del', 'delh']);
  });

  it('sends the same requests under StrictMode', async () => {
    const { user, input } = setup(
      <StrictMode>
        <CityCombobox />
      </StrictMode>,
    );

    await user.type(input, 'del');
    await finishTyping();
    await user.type(input, 'h');
    await finishTyping();
    await user.type(input, '{Backspace}');
    await finishTyping();

    expect(fetchMock.mock.calls.map(([request]) => searchTermOf(request))).toEqual(['del', 'delh']);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('debounces a typing burst into a single request', async () => {
    const { user, input } = setup();

    await user.type(input, 'delh');
    await finishTyping();

    expect(screen.getByRole('option', { name: 'Adele Hart, Delhi' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('aborts the in-flight request when a newer query starts', async () => {
    fetchMock.mockImplementationOnce(respondNeverUntilAborted);
    const { user, input } = setup();

    await user.type(input, 'del');
    await finishTyping();
    expect(fetchMock).toHaveBeenCalledOnce();
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    await user.type(input, 'h');
    await finishTyping();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.getByRole('option', { name: 'Adele Hart, Delhi' })).toBeInTheDocument();
    // The abort is a cancellation, not a failure.
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('aborts the in-flight request on unmount', async () => {
    fetchMock.mockImplementationOnce(respondNeverUntilAborted);
    const { user, input, unmount } = setup();

    await user.type(input, 'del');
    await finishTyping();
    unmount();

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('does not search for a whitespace-only query', async () => {
    const { user, input } = setup();

    await user.type(input, '   ');
    await finishTyping();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CityCombobox states', () => {
  it('shows an error with a Retry that refetches and shows results', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { user, input } = setup();

    await user.type(input, 'del');
    await finishTyping();
    expect(screen.getByRole('status')).toHaveTextContent(
      "Couldn't load results. Check your connection and retry.",
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await settleRequests();

    expect(screen.getByRole('option', { name: 'Delia Moss, Delft' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(input).toHaveFocus();
  });

  it('hides Retry while a newer query is pending', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { user, input } = setup();

    await user.type(input, 'del');
    await finishTyping();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    await user.type(input, 'h');

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('refetches a previously failed query when the user returns to it', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { user, input } = setup();

    await user.type(input, 'del');
    await finishTyping();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    await user.type(input, 'h');
    await finishTyping();
    await user.type(input, '{Backspace}');
    await finishTyping();

    expect(fetchMock.mock.calls.map(([request]) => searchTermOf(request))).toEqual([
      'del',
      'delh',
      'del',
    ]);
    expect(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows an empty message quoting the searched query', async () => {
    const { user, input } = setup();

    await user.type(input, '  ZzZ ');
    await finishTyping();

    expect(screen.getByRole('status')).toHaveTextContent("No results for 'zzz'");
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CityCombobox keyboard and mouse', () => {
  async function openWithResults(): Promise<SetupResult> {
    const context = setup();
    await context.user.type(context.input, 'del');
    await finishTyping();
    expect(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' })).toBeInTheDocument();
    return context;
  }

  it('moves with the arrow keys and selects with Enter', async () => {
    const { user, input } = await openWithResults();

    await user.keyboard('{ArrowDown}{ArrowDown}');

    const delia = screen.getByRole('option', { name: 'Delia Moss, Delft' });
    expect(delia).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', delia.id);

    await user.keyboard('{Enter}');

    expect(input).toHaveValue('Delia Moss');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Selected Delia Moss, Delft');
  });

  it('does not search for the selected name after a selection', async () => {
    const { user } = await openWithResults();

    await user.keyboard('{ArrowDown}{Enter}');
    await finishTyping();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('wraps from the first option to the last with ArrowUp', async () => {
    const { user } = await openWithResults();

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('ignores Enter while the visible results belong to an older query', async () => {
    const { user, input } = await openWithResults();

    await user.type(input, 'h');
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(input).toHaveValue('delh');
    expect(screen.queryByText(/Selected/)).not.toBeInTheDocument();

    await finishTyping();
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('scrolls the active option into view', async () => {
    const { user } = await openWithResults();

    await user.keyboard('{ArrowUp}');

    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(scrollIntoViewMock.mock.contexts.at(-1)).toBe(
      screen.getByRole('option', { name: 'Fidel Ortiz, Lima' }),
    );
  });

  it('closes the list with Escape and keeps the text', async () => {
    const { user, input } = await openWithResults();

    await user.keyboard('{Escape}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('del');
  });

  it('selects an option with the mouse without losing focus', async () => {
    const { user, input } = await openWithResults();

    await user.click(screen.getByRole('option', { name: 'Fidel Ortiz, Lima' }));

    expect(input).toHaveValue('Fidel Ortiz');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('highlights the matched text inside each option', async () => {
    await openWithResults();

    const option = screen.getByRole('option', { name: 'Adele Hart, Delhi' });
    expect(option.querySelector('mark')).toHaveTextContent('del');
  });
});
