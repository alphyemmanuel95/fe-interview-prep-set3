import { createMockFileSystem, DEFAULT_LATENCY_MS, FLAKY_FOLDER_ID } from './mockFileSystem';

/** The app's single "server". Its own module so tests can spy on the loader the page uses. */
export const fileSystem = createMockFileSystem({
  latencyMs: DEFAULT_LATENCY_MS,
  failFirstLoadOf: [FLAKY_FOLDER_ID],
});
