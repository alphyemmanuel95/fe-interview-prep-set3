import { memo, type JSX, type ReactNode } from 'react';
import type { ErrorRow, ItemRow } from './visibleRows';
import './TreeRow.css';

export type RegisterRow = (id: string, element: HTMLElement | null) => void;

/** Exposes each row's element to the tree so keyboard moves can call `.focus()` on it. */
function rowRef(id: string, registerRow: RegisterRow) {
  return (element: HTMLElement | null): (() => void) => {
    registerRow(id, element);
    return () => {
      registerRow(id, null);
    };
  };
}

// Indentation is the one truly dynamic style, so it stays inline; everything else is in CSS.
const indentStyle = (level: number) => ({
  paddingInlineStart: `calc(${level - 1} * var(--tree-indent))`,
});

export type TreeItemRowProps<T> = ItemRow<T> &
  Readonly<{
    isSelected: boolean;
    isTabStop: boolean;
    getLabel: (item: T) => string;
    renderIcon: ((item: T, isExpanded: boolean) => ReactNode) | undefined;
    renderLabel: ((item: T) => ReactNode) | undefined;
    registerRow: RegisterRow;
  }>;

function TreeItemRowView<T>(props: TreeItemRowProps<T>): JSX.Element {
  const { id, item, level, isBranch, isExpanded, isSelected, loadStatus } = props;
  const isLoading = loadStatus === 'loading';
  const className = isSelected ? 'tree-row tree-row--selected' : 'tree-row';
  const toggleClassName = isExpanded
    ? 'tree-row__toggle tree-row__toggle--expanded'
    : 'tree-row__toggle';

  // Clicks and keys are delegated to the tree, so a row needs no handlers of its own.
  return (
    <div
      ref={rowRef(id, props.registerRow)}
      role="treeitem"
      aria-level={level}
      aria-posinset={props.posInSet}
      aria-setsize={props.setSize}
      aria-expanded={isBranch ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-busy={isLoading}
      tabIndex={props.isTabStop ? 0 : -1}
      data-tree-row-id={id}
      className={className}
      style={indentStyle(level)}
    >
      <span
        className={toggleClassName}
        data-tree-toggle={isBranch ? 'true' : undefined}
        aria-hidden="true"
      >
        {isBranch ? '▸' : ''}
      </span>
      {props.renderIcon !== undefined && (
        <span className="tree-row__icon" aria-hidden="true">
          {props.renderIcon(item, isExpanded)}
        </span>
      )}
      <span className="tree-row__label">
        {props.renderLabel === undefined ? props.getLabel(item) : props.renderLabel(item)}
      </span>
      {/* aria-busy + the tree's live region announce this; the text is for sighted users. */}
      {isLoading && (
        <span className="tree-row__status" aria-hidden="true">
          Loading…
        </span>
      )}
    </div>
  );
}

// Memo boundary: with ~1,000 nodes, expanding one folder or moving selection would otherwise
// re-render every visible row. All props are primitives, the cached item, or stable callbacks,
// so only rows whose own state changed re-render. `memo` drops the generic parameter, hence the
// cast back to the generic signature — it wraps the same component and does not alter props.
export const TreeItemRow = memo(TreeItemRowView) as typeof TreeItemRowView;

export type TreeErrorRowProps = Pick<ErrorRow<unknown>, 'id' | 'level' | 'message'> &
  Readonly<{ isTabStop: boolean; registerRow: RegisterRow }>;

export function TreeErrorRow(props: TreeErrorRowProps): JSX.Element {
  return (
    <div
      ref={rowRef(props.id, props.registerRow)}
      role="treeitem"
      aria-level={props.level}
      aria-selected={false}
      tabIndex={props.isTabStop ? 0 : -1}
      data-tree-row-id={props.id}
      className="tree-row tree-row--error"
      style={indentStyle(props.level)}
    >
      <span className="tree-row__toggle" aria-hidden="true" />
      <span className="tree-row__label">
        {props.message} <span className="tree-row__retry">Retry</span>
      </span>
    </div>
  );
}
