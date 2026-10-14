import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// The full suite runs many jsdom files in parallel; the 1s default for findBy/waitFor
// is too tight under that load and caused intermittent failures. Real hangs still fail.
const ASYNC_UTIL_TIMEOUT_MS = 5_000;
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
