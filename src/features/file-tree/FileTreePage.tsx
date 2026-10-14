import type { JSX } from 'react';
import {
  createMockFileSystem,
  DEFAULT_LATENCY_MS,
  FLAKY_FOLDER_ID,
  type FileNode,
} from './api/mockFileSystem';
import { useTreeUrlState } from './hooks/useTreeUrlState';
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

export function FileTreePage(): JSX.Element {
  const { expandedIds, selectedId, setExpanded, select } = useTreeUrlState();

  return (
    <section className="file-tree" aria-labelledby="file-tree-title">
      <h1 id="file-tree-title">Q4 — File Explorer Tree</h1>
      <p className="file-tree__intro">
        About 1,000 mock files, six levels deep, loaded folder by folder. Open folders and the
        selected file live in the address bar: copy it to share exactly this view.
      </p>
      <div className="file-tree__panel">
        <Tree
          label="Project files"
          rootItems={fileSystem.rootNodes}
          getId={getNodeId}
          getLabel={getNodeName}
          isBranch={isFolder}
          loadChildren={loadFolder}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onExpandedChange={setExpanded}
          onSelect={select}
          renderIcon={renderNodeIcon}
        />
      </div>
      <p className="file-tree__selection">
        Selected: <code>{selectedId ?? 'nothing yet'}</code>
      </p>
    </section>
  );
}
