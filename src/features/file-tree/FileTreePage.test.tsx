import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { fileSystem } from './api/fileSystem';
import {
  createMockFileSystem,
  DEFAULT_LATENCY_MS,
  FLAKY_FOLDER_ID,
  type SearchIndexEntry,
} from './api/mockFileSystem';
import { SEARCH_DEBOUNCE_MS } from './hooks/useTreeSearch';
import { stubScrollIntoView } from './testUtils';

// The generator is seeded, so this copy has exactly the ids the page serves.
const { searchIndex } = createMockFileSystem({ latencyMs: 0 });
const labelOf = (id: string): string => searchIndex.find((entry) => entry.id === id)?.label ?? '';

/** A node three levels down, outside the deliberately flaky folder. */
function pickDeepNode() {
  const node = searchIndex.find(
    (entry) => entry.ancestorIds.length === 2 && !entry.ancestorIds.includes(FLAKY_FOLDER_ID),
  );
  if (node === undefined) {
    throw new Error('The mock file system has no node three levels deep');
  }
  return node;
}

const isOutsideFlakyFolder = (entry: SearchIndexEntry): boolean =>
  entry.id !== FLAKY_FOLDER_ID && !entry.ancestorIds.includes(FLAKY_FOLDER_ID);
const matchesOf = (term: string) =>
  searchIndex.filter((entry) => entry.label.toLowerCase().includes(term.toLowerCase()));

const hasDescendants = (entry: SearchIndexEntry): boolean =>
  searchIndex.some((other) => other.ancestorIds.includes(entry.id));

/**
 * A label with several matches, some nested, none inside the flaky folder. Only leaf matches, so
 * every other visible row is an ancestor (a matching folder would show its whole contents).
 */
function pickSearchTerm(): string {
  const term = searchIndex
    .map((entry) => entry.label)
    .find((label) => {
      const matches = matchesOf(label);
      return (
        matches.length > 1 &&
        matches.every(isOutsideFlakyFolder) &&
        !matches.some(hasDescendants) &&
        matches.some((match) => match.ancestorIds.length > 1)
      );
    });
  if (term === undefined) {
    throw new Error('The mock file system has no suitable search term');
  }
  return term;
}

/** A node at least three levels down whose name matches nothing else, outside the flaky folder. */
function pickUniqueDeepNode() {
  const node = searchIndex.find(
    (entry) =>
      entry.ancestorIds.length >= 2 &&
      isOutsideFlakyFolder(entry) &&
      matchesOf(entry.label).length === 1,
  );
  if (node === undefined) {
    throw new Error('The mock file system has no uniquely named deep node');
  }
  return node;
}

function renderAt(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  const { unmount } = render(<RouterProvider router={router} />);
  return { router, user, unmount };
}

const MAX_LEVEL = 6;

/** Lets the debounced search query apply. */
async function settleSearch(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
}

/** Lets one round of simulated folder requests resolve. */
async function finishLoads(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEFAULT_LATENCY_MS);
  });
}

describe('FileTreePage', () => {
  const scrollIntoView = stubScrollIntoView();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Layout's ScrollRestoration scrolls on navigation; jsdom does not implement scrolling.
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the expanded folders and selected node from a shared link', async () => {
    const node = pickDeepNode();
    const expanded = encodeURIComponent(node.ancestorIds.join(','));
    renderAt(`/file-tree?expanded=${expanded}&selected=${encodeURIComponent(node.id)}`);

    // One latency per level: the second folder's children load once the first one has.
    await finishLoads();
    await finishLoads();

    const expandedRows = screen.getAllByRole('treeitem', { expanded: true });
    expect(expandedRows).toHaveLength(node.ancestorIds.length);
    node.ancestorIds.forEach((id, index) => {
      expect(expandedRows[index]).toHaveAccessibleName(labelOf(id));
    });
    const selected = screen.getByRole('treeitem', { selected: true });
    expect(selected).toHaveAccessibleName(node.label);
    expect(selected).toHaveAttribute('aria-level', '3');
    expect(scrollIntoView().mock.contexts).toContain(selected);
  });

  it('loads each folder of a shared link exactly once under StrictMode', async () => {
    const loadChildren = vi.spyOn(fileSystem, 'loadChildren');
    const node = pickDeepNode();
    const expanded = encodeURIComponent(node.ancestorIds.join(','));
    const router = createMemoryRouter(routes, {
      initialEntries: [`/file-tree?expanded=${expanded}&selected=${encodeURIComponent(node.id)}`],
    });
    // StrictMode double-invokes effects on mount, exactly when the shared link's loads start.
    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    await finishLoads();
    await finishLoads();

    expect(screen.getByRole('treeitem', { selected: true })).toHaveAccessibleName(node.label);
    expect(loadChildren.mock.calls.map(([folderId]) => folderId)).toEqual(node.ancestorIds);
  });

  it('steps through expand and select with browser back and forward', async () => {
    const { router, user } = renderAt('/file-tree');
    const [firstFolder] = screen.getAllByRole('treeitem');

    if (firstFolder === undefined) {
      throw new Error('The tree rendered no rows');
    }

    await user.click(firstFolder);
    await user.keyboard('{ArrowRight}');
    await finishLoads();
    expect(firstFolder).toHaveAttribute('aria-selected', 'true');
    expect(firstFolder).toHaveAttribute('aria-expanded', 'true');

    await act(() => router.navigate(-1));
    expect(firstFolder).toHaveAttribute('aria-expanded', 'false');
    expect(firstFolder).toHaveAttribute('aria-selected', 'true');

    await act(() => router.navigate(-1));
    expect(firstFolder).toHaveAttribute('aria-selected', 'false');

    await act(() => router.navigate(2));
    expect(firstFolder).toHaveAttribute('aria-selected', 'true');
    expect(firstFolder).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps focus in the tree when browser Back hides the focused row', async () => {
    const { router, user } = renderAt('/file-tree');
    const [firstFolder] = screen.getAllByRole('treeitem');
    if (firstFolder === undefined) {
      throw new Error('The tree rendered no rows');
    }

    await user.click(firstFolder);
    await user.keyboard('{ArrowRight}');
    await finishLoads();
    await user.keyboard('{ArrowRight}');
    expect(firstFolder).not.toHaveFocus();

    // Back collapses the folder, removing the focused child row from the DOM.
    await act(() => router.navigate(-1));

    expect(firstFolder).toHaveAttribute('aria-expanded', 'false');
    expect(firstFolder).toHaveFocus();
  });

  it('filters by search while keeping each match’s ancestor folders visible', async () => {
    const term = pickSearchTerm();
    const matches = matchesOf(term);
    const ancestorIds = new Set(matches.flatMap((match) => match.ancestorIds));
    const { user } = renderAt('/file-tree');

    await user.type(screen.getByRole('searchbox', { name: 'Search files' }), term);
    await settleSearch();
    // Ancestor folders load level by level, as they would for a user.
    for (let level = 1; level < MAX_LEVEL; level += 1) {
      await finishLoads();
    }

    const rows = screen.getAllByRole('treeitem');
    const matchRows = rows.filter((row) => row.textContent.includes(term));
    const otherRows = rows.filter((row) => !matchRows.includes(row));
    expect(matchRows).toHaveLength(matches.length);
    expect(otherRows).toHaveLength(ancestorIds.size);
    for (const row of otherRows) {
      expect(row).toHaveAttribute('aria-expanded', 'true');
    }
    expect(screen.queryByRole('treeitem', { name: 'package.json' })).not.toBeInTheDocument();
    expect(screen.getByText(`${matches.length} matches`)).toBeInTheDocument();
  });

  it('shares a node picked from search results with its folders open', async () => {
    const node = pickUniqueDeepNode();
    const first = renderAt('/file-tree');

    await first.user.type(screen.getByRole('searchbox', { name: 'Search files' }), node.label);
    await settleSearch();
    for (let level = 1; level < MAX_LEVEL; level += 1) {
      await finishLoads();
    }
    await first.user.click(screen.getByRole('treeitem', { name: node.label }));

    const { search } = first.router.state.location;
    const params = new URLSearchParams(search);
    expect(params.get('selected')).toBe(node.id);
    expect(params.get('expanded')?.split(',')).toEqual(node.ancestorIds);

    // Open the copied link in a fresh app, as a colleague would.
    first.unmount();
    renderAt(`/file-tree${search}`);
    for (let level = 1; level <= node.ancestorIds.length; level += 1) {
      await finishLoads();
    }
    const selected = screen.getByRole('treeitem', { selected: true });
    expect(selected).toHaveAccessibleName(node.label);
    expect(selected).toHaveAttribute('aria-level', String(node.ancestorIds.length + 1));
  });

  it('collapses a search-opened folder without touching the URL', async () => {
    const { router, user } = renderAt('/file-tree');

    await user.type(screen.getByRole('searchbox', { name: 'Search files' }), pickSearchTerm());
    await settleSearch();
    for (let level = 1; level < MAX_LEVEL; level += 1) {
      await finishLoads();
    }
    const urlBefore = router.state.location.search;
    const rowCountBefore = screen.getAllByRole('treeitem').length;
    await user.tab();
    const [firstAncestor] = screen.getAllByRole('treeitem');
    expect(firstAncestor).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(firstAncestor).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(rowCountBefore);
    expect(router.state.location.search).toBe(urlBefore);

    await user.keyboard('{ArrowRight}');
    expect(firstAncestor).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('treeitem')).toHaveLength(rowCountBefore);
  });

  it('searches only after a pause and with at least two characters', async () => {
    const { user } = renderAt('/file-tree');
    const rootRowCount = screen.getAllByRole('treeitem').length;
    const searchbox = screen.getByRole('searchbox', { name: 'Search files' });

    await user.type(searchbox, 'a');
    await settleSearch();
    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem')).toHaveLength(rootRowCount);

    await user.type(searchbox, 'pi');
    expect(screen.queryByText(/\d+ matches/)).not.toBeInTheDocument();
    await settleSearch();
    expect(screen.getByText(/\d+ matches/)).toBeInTheDocument();
  });

  it('says so when nothing matches the search', async () => {
    const { user } = renderAt('/file-tree');

    await user.type(screen.getByRole('searchbox', { name: 'Search files' }), 'no-such-file');
    await settleSearch();

    expect(screen.getByText('No files or folders match “no-such-file”.')).toBeInTheDocument();
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  });
});
