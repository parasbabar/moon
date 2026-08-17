import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), wasm()],
  resolve: {
    alias: {
      // The API layer is resolved from source for fast dev iteration.
      // The API layer does NOT import the contract package at build time —
      // contract interaction happens at runtime through the wallet provider.
      '@midnight-verify/api': resolve(__dirname, '../api/src/index.ts'),
      // Prevent Vite from trying to bundle these problematic packages
      '@midnight-ntwrk/ledger-v8': resolve(__dirname, '../api/src/noop.js'),
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider': resolve(__dirname, '../api/src/noop.js'),
      '@subsquid/scale-codec': resolve(__dirname, '../api/src/noop.js'),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
  // WASM configuration
  wasm: {
    // Support synchronous WASM modules
    sync: ['@midnight-ntwrk/ledger-v8'],
  },
  // Exclude WASM-dependent packages from the browser bundle.
  // The Compact runtime and onchain-runtime are used server-side (tests/deploy).
  // In the browser, ZK proof generation is handled by the Lace wallet extension.
  optimizeDeps: {
    exclude: [
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/compact-runtime',
      '@midnight-verify/contract',
      '@midnight-ntwrk/ledger-v8',
      '@subsquid/scale-codec',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Treat the Midnight runtime as external — it must not be bundled.
      // The Lace wallet provides these capabilities at runtime.
      external: [
        '@midnight-ntwrk/onchain-runtime-v3',
        '@midnight-ntwrk/compact-runtime',
        '@midnight-verify/contract',
        '@midnight-ntwrk/ledger-v8',
        '@subsquid/scale-codec',
        '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
      ],
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          rxjs: ['rxjs'],
        },
      },
    },
    // Enable WASM build support with ES2022 for top-level await
    target: 'es2022',
  },
  server: {
    port: 5173,
    host: true,
  },
});
