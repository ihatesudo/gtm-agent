import { defineConfig } from 'vitest/config';

// Backend unit tests only. The UI (ui/src/__tests__) has its own vitest
// config + jsdom environment and is run via `npm run --prefix ui test`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['ui/**', 'node_modules/**', '.mastra/**', 'dist/**'],
    environment: 'node',
  },
});
