import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  createMockFileSystem,
  DEFAULT_LATENCY_MS,
  FLAKY_FOLDER_ID,
  type FileNode,
} from './api/mockFileSystem';
import { HighlightedText } from './components/HighlightedText';
import { useTreeUrlState } from './hooks/useTreeUrlState';
import { searchTree, type TreeSearchResult } from './model/search';
import { Tree } from './tree/Tree';
import './FileTreePage.css';

const fileSystem = createMockFileSystem({
  latencyMs: DEFAULT_LATENCY_MS,
  failFirstLoadOf: [FLAKY_FOLDER_ID],
});

// Module-level accessors are referentially stable, which the tree's row memo relies on.
const getNodeId = (node: FileNode): string => node.id;
const getNodeName = (node: FileNode): string => node.name;
const isFolder = (node: FileNode): boolean => node.kind === 'folder';
const loadFolder = (node: FileNode, signal: AbortSignal): Promise<readonly FileNode[]> =>
  fileSystem.loadChildren(node.id, signal);

function renderNodeIcon(node: FileNode, isExpanded: boolean): string {
  if (node.kind === 'file') {
    return '📄';
  }
  return isExpanded ? '📂' : '📁';
}

function searchSummary(search: TreeSearchResult | null, query: string): string {
  if (search === null) {
    return '';
  }
  if (search.matchIds.size === 0) {
    return `No files or folders match “${query.trim()}”.`;
  }
  return search.matchIds.size === 1 ? '1 match' : `${search.matchIds.size} matches`;
}

export function FileTreePage(): JSX.Element {
  const { expandedIds, selectedId, setExpanded, select } = useTreeUrlState();
  // Search text is transient, local view state: only expanded + selected make up the shared link.
  const [query, setQuery] = useState('');
  const search = useMemo(() => searchTree(fileSystem.searchIndex, query), [query]);

  // While searching, ancestors of matches are opened on top of the user's own expanded folders.
  // This is derived, never written to the URL, so clearing the search restores the previous view.
  const treeExpandedIds = useMemo(
    () => (search === null ? expandedIds : new Set([...expandedIds, ...search.expandedIds])),
    [expandedIds, search],
  );

  // Stable per query so memoised rows re-render for a new query, not for every expand or select.
  const renderLabel = useCallback(
    (node: FileNode) => <HighlightedText text={node.name} query={query} />,
    [query],
  );

  return (
    <section className="file-tree" aria-labelledby="file-tree-title">
      <h1 id="file-tree-title">Q4 — File Explorer Tree</h1>
      <p className="file-tree__intro">
        About 1,000 mock files, six levels deep, loaded folder by folder. Open folders and the
        selected file live in the address bar: copy it to share exactly this view.
      </p>
      <div className="file-tree__search">
        <label htmlFor="file-tree-search" className="file-tree__search-label">
          Search files
        </label>
        <input
          id="file-tree-search"
          className="file-tree__search-input"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="file-tree__search-status" aria-live="polite">
          {searchSummary(search, query)}
        </p>
      </div>
      <div className="file-tree__panel">
        <Tree
          label="Project files"
          rootItems={fileSystem.rootNodes}
          getId={getNodeId}
          getLabel={getNodeName}
          isBranch={isFolder}
          loadChildren={loadFolder}
          expandedIds={treeExpandedIds}
          selectedId={selectedId}
          onExpandedChange={setExpanded}
          onSelect={select}
          filter={search ?? undefined}
          renderIcon={renderNodeIcon}
          renderLabel={renderLabel}
        />
      </div>
      <p className="file-tree__selection">
        Selected: <code>{selectedId ?? 'nothing yet'}</code>
      </p>
    </section>
  );
}
