// A deterministic in-memory "server" for the file tree. The whole hierarchy is generated once
// from a fixed seed so ids are stable across reloads — a shared link must point at the same nodes
// for everyone. The UI only ever sees it through `loadChildren`, which behaves like a network call.

export type FileNodeKind = 'folder' | 'file';

export type FileNode = Readonly<{
  /** Path from the root, e.g. `src/components/button.tsx`. Never contains a comma. */
  id: string;
  name: string;
  kind: FileNodeKind;
}>;

export type SearchIndexEntry = Readonly<{
  id: string;
  label: string;
  /** Outermost first, so a match can reveal every folder above it without loading them. */
  ancestorIds: readonly string[];
}>;

export type MockFileSystem = Readonly<{
  rootNodes: readonly FileNode[];
  searchIndex: readonly SearchIndexEntry[];
  loadChildren: (folderId: string, signal?: AbortSignal) => Promise<readonly FileNode[]>;
}>;

export type MockFileSystemOptions = Readonly<{
  latencyMs: number;
  /** Folder ids whose first load rejects, so the error + retry path can be exercised. */
  failFirstLoadOf?: readonly string[];
}>;

const SEED = 4_242;
/** Deepest level of any node, counting root items as level 1. */
const MAX_DEPTH = 6;
const ROOT_FOLDER_COUNT = 6;
const MIN_SUBFOLDERS = 1;
const MAX_SUBFOLDERS = 3;
const MIN_FILES = 3;
const MAX_FILES = 5;
const PATH_SEPARATOR = '/';

export const DEFAULT_LATENCY_MS = 400;
export const FLAKY_FOLDER_ID = 'network-share';

const FOLDER_NAMES = [
  'src',
  'components',
  'hooks',
  'utils',
  'assets',
  'docs',
  'tests',
  'config',
  'scripts',
  'styles',
  'api',
  'models',
  'services',
  'pages',
  'lib',
  'fixtures',
  'images',
  'icons',
  'locales',
  'layouts',
] as const;

const FILE_STEMS = [
  'index',
  'main',
  'app',
  'button',
  'header',
  'footer',
  'modal',
  'table',
  'form',
  'list',
  'card',
  'theme',
  'router',
  'store',
  'client',
  'helpers',
  'constants',
  'types',
  'readme',
  'changelog',
] as const;

const FILE_EXTENSIONS = ['ts', 'tsx', 'css', 'json', 'md', 'svg'] as const;

type Random = () => number;

// mulberry32: tiny, fast and good enough for fixture data; Math.random would break shared links.
function createRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Picks `count` distinct values, so sibling names (and therefore ids) never collide. */
function pickDistinct<T>(random: Random, pool: readonly T[], count: number): readonly T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    const [value] = remaining.splice(randomInt(random, 0, remaining.length - 1), 1);
    if (value !== undefined) {
      picked.push(value);
    }
  }
  return picked;
}

type GeneratedTree = Readonly<{
  childrenByFolderId: ReadonlyMap<string, readonly FileNode[]>;
  searchIndex: readonly SearchIndexEntry[];
}>;

function generateTree(rootNodes: readonly FileNode[], random: Random): GeneratedTree {
  const childrenByFolderId = new Map<string, readonly FileNode[]>();
  const searchIndex: SearchIndexEntry[] = [];

  const toNode = (parentId: string, name: string, kind: FileNodeKind): FileNode => ({
    id: `${parentId}${PATH_SEPARATOR}${name}`,
    name,
    kind,
  });

  const visit = (node: FileNode, depth: number, ancestorIds: readonly string[]): void => {
    searchIndex.push({ id: node.id, label: node.name, ancestorIds });
    if (node.kind === 'file') {
      return;
    }
    // Every folder that can still hold a folder gets at least one, so all branches reach
    // MAX_DEPTH; folders one level above it hold only files.
    const subfolderCount =
      depth + 1 < MAX_DEPTH ? randomInt(random, MIN_SUBFOLDERS, MAX_SUBFOLDERS) : 0;
    const folders = pickDistinct(random, FOLDER_NAMES, subfolderCount).map((name) =>
      toNode(node.id, name, 'folder'),
    );
    const files = pickDistinct(random, FILE_STEMS, randomInt(random, MIN_FILES, MAX_FILES)).map(
      (stem) => {
        const extension = FILE_EXTENSIONS[randomInt(random, 0, FILE_EXTENSIONS.length - 1)] ?? 'ts';
        return toNode(node.id, `${stem}.${extension}`, 'file');
      },
    );
    const children = [...folders, ...files];
    childrenByFolderId.set(node.id, children);
    const childAncestorIds = [...ancestorIds, node.id];
    for (const child of children) {
      visit(child, depth + 1, childAncestorIds);
    }
  };

  for (const root of rootNodes) {
    visit(root, 1, []);
  }
  return { childrenByFolderId, searchIndex };
}

function createRootNodes(random: Random): readonly FileNode[] {
  const folderNames = [...pickDistinct(random, FOLDER_NAMES, ROOT_FOLDER_COUNT), FLAKY_FOLDER_ID];
  const folders = folderNames.map((name): FileNode => ({ id: name, name, kind: 'folder' }));
  const files: readonly FileNode[] = [
    { id: 'package.json', name: 'package.json', kind: 'file' },
    { id: 'README.md', name: 'README.md', kind: 'file' },
  ];
  return [...folders, ...files];
}

function abortError(): DOMException {
  return new DOMException('The folder load was aborted', 'AbortError');
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortError());
      return;
    }
    const handleAbort = (): void => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

export function createMockFileSystem(options: MockFileSystemOptions): MockFileSystem {
  const random = createRandom(SEED);
  const rootNodes = createRootNodes(random);
  const { childrenByFolderId, searchIndex } = generateTree(rootNodes, random);
  const pendingFailures = new Set(options.failFirstLoadOf ?? []);

  const loadChildren = async (
    folderId: string,
    signal?: AbortSignal,
  ): Promise<readonly FileNode[]> => {
    await delay(options.latencyMs, signal);
    if (pendingFailures.delete(folderId)) {
      throw new Error(`Could not reach "${folderId}". Try again.`);
    }
    const children = childrenByFolderId.get(folderId);
    if (children === undefined) {
      throw new Error(`Folder "${folderId}" does not exist.`);
    }
    return children;
  };

  return { rootNodes, searchIndex, loadChildren };
}
