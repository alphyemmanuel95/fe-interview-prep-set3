import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { createMockFileSystem, DEFAULT_LATENCY_MS, FLAKY_FOLDER_ID } from './api/mockFileSystem';
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

function renderAt(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  render(<RouterProvider router={router} />);
  return { router, user };
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
});
