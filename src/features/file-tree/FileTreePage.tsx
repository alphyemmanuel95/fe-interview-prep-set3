import { useCallback, type JSX } from 'react';
import {
  createMockFileSystem,
  DEFAULT_LATENCY_MS,
  FLAKY_FOLDER_ID,
  type FileNode,
} from './api/mockFileSystem';
import { HighlightedText } from './components/HighlightedText';
import { useTreeSearch } from './hooks/useTreeSearch';
import { useTreeUrlState } from './hooks/useTreeUrlState';
import { isQueryTooShort, MIN_QUERY_LENGTH, type TreeSearchResult } from './model/search';
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
  if (isQueryTooShort(query)) {
    return `Type at least ${MIN_QUERY_LENGTH} characters to search.`;
  }
  if (search === null) {
    return '';
  }
  if (search.matchIds.size === 0) {
    return `No files or folders match “${query.trim()}”.`;
  }
  return search.matchIds.size === 1 ? '1 match' : `${search.matchIds.size} matches`;
}

export function FileTreePage(): JSX.Element {
  const url = useTreeUrlState();
  // While searching, ancestors of matches are opened on top of the URL's folders. That is derived
  // and never written to the URL, so clearing the search restores the previous view.
  const search = useTreeSearch(fileSystem.searchIndex, url.expandedIds, url.setExpanded);
  const { activeQuery, result } = search;

  // Stable per query so memoised rows re-render for a new query, not for every expand or select.
  const renderLabel = useCallback(
    (node: FileNode) => <HighlightedText text={node.name} query={activeQuery} />,
    [activeQuery],
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
          value={search.query}
          onChange={(event) => {
            search.setQuery(event.target.value);
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="file-tree__search-status" aria-live="polite">
          {searchSummary(result, activeQuery)}
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
          expandedIds={search.expandedIds}
          selectedId={url.selectedId}
          onExpandedChange={search.setExpanded}
          onSelect={url.select}
          filter={result ?? undefined}
          renderIcon={renderNodeIcon}
          renderLabel={renderLabel}
        />
      </div>
      <p className="file-tree__selection">
        Selected: <code>{url.selectedId ?? 'nothing yet'}</code>
      </p>
    </section>
  );
}
