import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60_000,
    include: ['src/**/*.test.ts'],
    reporter: ['verbose'],
    globals: false,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    // Allow vitest to resolve .js extensions to .ts files
    // This handles the generated index.js imports in TypeScript test files
    extensions: ['.ts', '.js'],
  },
});
