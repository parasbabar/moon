/**
 * Midnight Verify — Provider Configuration
 *
 * Configures the Midnight.js provider stack for CLI deployment to Preprod.
 *
 * Key design decisions verified by reading installed package source:
 *
 * 1. NodeZkConfigProvider (not FetchZkConfigProvider) is used for CLI deployment.
 *    It reads prover/verifier key files directly from the local filesystem.
 *    Path must point to the directory containing keys/ and zkir/ subdirectories.
 *
 * 2. httpClientProofProvider(url, zkConfigProvider) takes TWO arguments.
 *    The zkConfigProvider is required — it tells the proof server which keys to use.
 *
 * 3. levelPrivateStateProvider requires both privateStoragePasswordProvider AND accountId.
 *    accountId is derived from the wallet's coin public key (hex string).
 *
 * 4. Preprod endpoints verified live 2026-08-15:
 *    indexer.preprod.midnight.network/api/v4/graphql → HTTP 200 ✓
 *
 * Source reference: @midnight-ntwrk/testkit-js initializeMidnightProviders()
 */

import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---------------------------------------------------------------------------
// Preprod EnvironmentConfiguration
// Matches PreprodTestEnvironment.getEnvironmentConfiguration() from testkit-js
// ---------------------------------------------------------------------------
export const PREPROD_ENV = {
  walletNetworkId: NetworkId.NetworkId.PreProd,
  networkId:       'preprod',
  indexer:         'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS:       'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node:            'https://rpc.preprod.midnight.network',
  nodeWS:          'wss://rpc.preprod.midnight.network',
  faucet:          'https://faucet.preprod.midnight.network/api/drips',
  proofServer:     process.env['PROOF_SERVER_URL'] ?? 'http://localhost:6300',
} as const;

export type EnvironmentConfig = typeof PREPROD_ENV;
export type NetworkName = 'preprod';

// ---------------------------------------------------------------------------
// Path to the compiled contract assets directory.
// NodeZkConfigProvider expects this directory to contain:
//   keys/{circuitName}.prover
//   keys/{circuitName}.verifier
//   zkir/{circuitName}.zkir  (or .bzkir)
// This matches the output layout of compactc 0.31.0.
// ---------------------------------------------------------------------------
export const ZK_ASSETS_PATH = join(
  __dirname,
  '../../contract/src/managed/age_verify',
);

// ---------------------------------------------------------------------------
// Provider factory
//
// walletCoinPublicKey: hex string from midnightWalletProvider.getCoinPublicKey()
// ---------------------------------------------------------------------------
export function createProviders(
  walletProvider:      MidnightProviders['walletProvider'],
  walletCoinPublicKey: string,
  opts: {
    privateStateStoreName?: string;
    proofServerUrl?:        string;
    zkAssetsPath?:          string;
  } = {},
): MidnightProviders {
  const storeName    = opts.privateStateStoreName ?? 'midnight-verify-state';
  const proofServer  = opts.proofServerUrl        ?? PREPROD_ENV.proofServer;
  const zkAssetsPath = opts.zkAssetsPath          ?? ZK_ASSETS_PATH;

  // NodeZkConfigProvider reads prover/verifier keys from the local filesystem.
  // This is correct for CLI deployment — keys are committed in managed/age_verify/.
  const zkConfigProvider = new NodeZkConfigProvider(zkAssetsPath);

  // accountId scopes private state per wallet identity
  const accountId = Buffer.from(walletCoinPublicKey).toString('hex');

  return {
    // Stores private state (witness inputs) encrypted on disk, scoped to this wallet
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName:      storeName,
      signingKeyStoreName:        `${storeName}-signing-keys`,
      privateStoragePasswordProvider: () => 'midnight-verify-private-storage',
      accountId,
    }),

    // Queries public blockchain data via GraphQL
    publicDataProvider: indexerPublicDataProvider(
      PREPROD_ENV.indexer,
      PREPROD_ENV.indexerWS,
    ),

    // Provides prover/verifier keys and ZKIR from filesystem
    zkConfigProvider,

    // Sends proofs to the local proof server
    // IMPORTANT: second arg is zkConfigProvider (required by installed API)
    proofProvider: httpClientProofProvider(proofServer, zkConfigProvider),

    walletProvider,
  };
}
