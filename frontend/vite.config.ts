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
  // The Compact runtime, onchain-runtime and ledger-v8 are bundled as async
  // chunks — they are only loaded when the user actually verifies on-chain.
  optimizeDeps: {
    include: [
      // CJS packages consumed via the deploy/verify path. They have no ESM
      // `default`/named exports and reference `exports` directly, so they must
      // be pre-bundled by esbuild for correct browser interop.
      'object-inspect',
      '@subsquid/scale-codec',
      '@subsquid/util-internal-hex',
      '@subsquid/util-internal-json',
      // Node Buffer implementation (browser build) used to expose a global
      // `Buffer` for the Node-targeted deps above (see src/shims/buffer-global).
      'buffer',
    ],
    exclude: [
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/compact-runtime',
      '@midnight-verify/contract',
      '@midnight-ntwrk/ledger-v8',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
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