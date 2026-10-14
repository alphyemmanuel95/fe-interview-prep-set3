import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { uploadApi } from './mock-api/uploadApi.ts';

export default defineConfig({
  plugins: [react(), uploadApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'mock-api/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 15_000,
  },
});
