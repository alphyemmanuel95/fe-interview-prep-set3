import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { stubScrollIntoView } from '../testUtils';
import { Tree } from './Tree';
import type { LoadChildren } from './useChildrenLoader';

// Deliberately not file data: proves the tree only depends on the accessor functions.
type Person = Readonly<{ id: string; name: string; reports: readonly Person[] }>;

const person = (id: string, name: string, reports: readonly Person[] = []): Person => ({
  id,
  name,
  reports,
});

const ORG_CHART: readonly Person[] = [
  person('ceo', 'Ada (CEO)', [
    person('cto', 'Grace (CTO)', [person('eng-1', 'Linus'), person('eng-2', 'Margaret')]),
    person('cfo', 'Katherine (CFO)'),
  ]),
  person('board', 'Board', [person('chair', 'Barbara')]),
];

const getId = (item: Person) => item.id;
const getLabel = (item: Person) => item.name;
const hasReports = (item: Person) => item.reports.length > 0;

function OrgChart({ loadReports }: Readonly<{ loadReports: LoadChildren<Person> }>): JSX.Element {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleExpandedChange = (id: string, isExpanded: boolean): void => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (isExpanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  return (
    <Tree
      label="Org chart"
      rootItems={ORG_CHART}
      getId={getId}
      getLabel={getLabel}
      isBranch={hasReports}
      loadChildren={loadReports}
      expandedIds={expandedIds}
      selectedId={selectedId}
      onExpandedChange={handleExpandedChange}
      onSelect={setSelectedId}
    />
  );
}

const resolvingLoader = () => vi.fn<LoadChildren<Person>>((item) => Promise.resolve(item.reports));

function renderOrgChart(loadReports: LoadChildren<Person>) {
  const user = userEvent.setup();
  // StrictMode double-invokes effects: the loader assertions below also prove that is harmless.
  render(
    <StrictMode>
      <OrgChart loadReports={loadReports} />
    </StrictMode>,
  );
  return { user, item: (name: string) => screen.getByRole('treeitem', { name }) };
}

describe('Tree', () => {
  stubScrollIntoView();

  it('renders any hierarchical data with tree semantics', () => {
    const { item } = renderOrgChart(resolvingLoader());

    expect(screen.getByRole('tree', { name: 'Org chart' })).toBeInTheDocument();
    expect(item('Ada (CEO)')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Ada (CEO)')).toHaveAttribute('aria-level', '1');
    expect(screen.queryByRole('treeitem', { name: 'Grace (CTO)' })).not.toBeInTheDocument();
  });

  it('loads a branch once even when it is expanded, collapsed and expanded again', async () => {
    const loadReports = resolvingLoader();
    const { user, item } = renderOrgChart(loadReports);

    await user.click(item('Ada (CEO)'));
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('treeitem', { name: 'Grace (CTO)' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('treeitem', { name: 'Grace (CTO)' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');

    expect(await screen.findByRole('treeitem', { name: 'Grace (CTO)' })).toBeInTheDocument();
    expect(loadReports).toHaveBeenCalledOnce();
  });

  it('moves focus and expands with arrow keys, Home and End', async () => {
    const { user, item } = renderOrgChart(resolvingLoader());

    await user.tab();
    expect(item('Ada (CEO)')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Board')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowRight}');
    expect(item('Ada (CEO)')).toHaveAttribute('aria-expanded', 'true');
    await screen.findByRole('treeitem', { name: 'Grace (CTO)' });

    await user.keyboard('{ArrowRight}');
    expect(item('Grace (CTO)')).toHaveFocus();
    expect(item('Grace (CTO)')).toHaveAttribute('aria-level', '2');
    await user.keyboard('{End}');
    expect(item('Board')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('Ada (CEO)')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowLeft}');
    expect(item('Ada (CEO)')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Ada (CEO)')).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves modified arrow keys to the browser', async () => {
    const { user, item } = renderOrgChart(resolvingLoader());

    await user.tab();
    await user.keyboard('{ArrowRight}');
    await screen.findByRole('treeitem', { name: 'Grace (CTO)' });
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}{Control>}{ArrowDown}{/Control}');

    expect(item('Ada (CEO)')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Ada (CEO)')).toHaveFocus();
  });

  it('selects the focused row with Enter and keeps a single tab stop', async () => {
    const { user, item } = renderOrgChart(resolvingLoader());

    await user.tab();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(item('Board')).toHaveAttribute('aria-selected', 'true');
    expect(item('Ada (CEO)')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0)).toHaveLength(1);
  });

  it('shows a failed load in place and retries it from the keyboard', async () => {
    const loadReports = vi
      .fn<LoadChildren<Person>>()
      .mockRejectedValueOnce(new Error('Directory offline'))
      .mockImplementation((item) => Promise.resolve(item.reports));
    const { user } = renderOrgChart(loadReports);

    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    const errorRow = await screen.findByRole('treeitem', { name: /Directory offline/ });
    await user.keyboard('{ArrowDown}');
    expect(errorRow).toHaveFocus();
    await user.keyboard('{Enter}');
    // The error row is replaced, so focus moves to the folder being retried.
    expect(screen.getByRole('treeitem', { name: 'Board' })).toHaveFocus();

    expect(await screen.findByRole('treeitem', { name: 'Barbara' })).toBeInTheDocument();
    expect(loadReports).toHaveBeenCalledTimes(2);
  });
});
