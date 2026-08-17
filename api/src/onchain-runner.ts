/**
 * Midnight Verify — On-Chain Verification Runner (Browser / Lace wallet)
 *
 * Executes the real verifyAge circuit against the deployed Preprod contract,
 * using the Lace wallet DApp Connector API for key material and transaction balancing.
 *
 * This module is dynamically imported to keep large Midnight runtime packages
 * out of the static frontend bundle — it loads only when a live contract call happens.
 *
 * ── How the Lace browser flow works ────────────────────────────────────────
 *
 *  Lace API (window.midnight.mnLace.connect())  →  ConnectedAPI
 *
 *  ConnectedAPI provides:
 *    - getShieldedAddresses()  → coin public key + enc public key (in Bech32m)
 *    - getProvingProvider(keyMaterialProvider)  → ProvingProvider
 *    - balanceUnsealedTransaction(serializedTx)  → balanced tx
 *    - submitTransaction(serializedTx)  → void
 *
 *  We build a ZKConfigProvider that fetches key bytes from static /zk/ URLs,
 *  then call createProofProvider(provingProvider) to get the ProofProvider
 *  that midnight-js-contracts needs.
 *
 *  We also adapt Lace's ConnectedAPI into the WalletProvider + MidnightProvider
 *  interfaces that midnight-js needs, using parseCoinPublicKeyToHex.
 *
 * ── ZK key files ────────────────────────────────────────────────────────────
 *
 *  Keys must be served from the frontend at these URL paths:
 *    /zk/keys/{circuitName}.prover
 *    /zk/keys/{circuitName}.verifier
 *    /zk/zkir/{circuitName}.zkir
 *
 *  Copy them before building: npm run copy-zk-keys --workspace=frontend
 *
 * ── PRIVACY ──────────────────────────────────────────────────────────────────
 *
 *  privateAge is placed into private state as a witness.
 *  It is used inside the ZK circuit but never transmitted to the indexer or node.
 *  Only the boolean result (eligible) is written to the public ledger.
 */

import type { VerificationResult, VerificationStatus } from './types.js';

export interface OnChainVerificationParams {
  readonly privateAge:      bigint;
  readonly threshold:       bigint;
  readonly contractAddress: string;
  readonly laceApi:         unknown;
  readonly onStatus:        (s: VerificationStatus) => void;
}

// ---------------------------------------------------------------------------
// Inline types for Lace DApp Connector API
// (matches @midnight-ntwrk/dapp-connector-api WalletConnectedAPI shape)
// ---------------------------------------------------------------------------
interface LaceKeyMaterialProvider {
  getZKIR(circuitKeyLocation: string):       Promise<Uint8Array>;
  getProverKey(circuitKeyLocation: string):  Promise<Uint8Array>;
  getVerifierKey(circuitKeyLocation: string): Promise<Uint8Array>;
}

interface LaceProvingProvider {
  prove(
    circuit: string,
    proverKey: Uint8Array,
    zkir: Uint8Array,
    publicInputs: Uint8Array,
    privateInputs: Uint8Array,
  ): Promise<Uint8Array>;
}

interface LaceConnectedAPI {
  getShieldedAddresses(): Promise<{
    shieldedAddress:         string;
    shieldedCoinPublicKey:   string;   // Bech32m encoded
    shieldedEncryptionPublicKey: string; // Bech32m encoded
  }>;
  getProvingProvider(kmp: LaceKeyMaterialProvider): Promise<LaceProvingProvider>;
  balanceUnsealedTransaction(tx: string, options?: { payFees?: boolean }): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// ZKConfigProvider built from HTTP-fetched key files (served from /zk/)
// Implements the abstract ZKConfigProvider<K> interface from midnight-js-types.
// ---------------------------------------------------------------------------
async function buildFetchZkConfigProvider(baseUrl: string) {
  // Dynamically import the abstract base class to extend it
  const { ZKConfigProvider, createProverKey, createVerifierKey, createZKIR } =
    await import('@midnight-ntwrk/midnight-js-types');

  async function fetchBinary(url: string): Promise<Uint8Array> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch ZK asset ${url}: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  class FetchZkConfigProvider extends ZKConfigProvider<string> {
    override async getZKIR(circuitId: string) {
      const bytes = await fetchBinary(`${baseUrl}/zk/zkir/${circuitId}.zkir`);
      return createZKIR(bytes);
    }
    override async getProverKey(circuitId: string) {
      const bytes = await fetchBinary(`${baseUrl}/zk/keys/${circuitId}.prover`);
      return createProverKey(bytes);
    }
    override async getVerifierKey(circuitId: string) {
      const bytes = await fetchBinary(`${baseUrl}/zk/keys/${circuitId}.verifier`);
      return createVerifierKey(bytes);
    }
  }

  return new FetchZkConfigProvider();
}

// ---------------------------------------------------------------------------
// runOnChainVerification
// ---------------------------------------------------------------------------
export async function runOnChainVerification(
  params: OnChainVerificationParams,
): Promise<VerificationResult> {
  const { privateAge, threshold, contractAddress, laceApi, onStatus } = params;

  onStatus('generating-proof');

  const lace = laceApi as LaceConnectedAPI;

  const BASE_URL   = typeof window !== 'undefined' ? window.location.origin : '';
  const INDEXER    = 'https://indexer.preprod.midnight.network/api/v4/graphql';
  const INDEXER_WS = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
  const NETWORK_ID = 'preprod';

  // Dynamic imports — loaded only when live contract path is taken
  const [
    { findDeployedContract },
    { indexerPublicDataProvider },
    { httpClientProofProvider },
    { levelPrivateStateProvider },
    utils,
    { Contract },
    { createWitnessProvider, createPrivateState },
    { ledger },
    compiledContractMod,
    effectMod,
    { createProofProvider: mkProofProvider },
  ] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-contracts'),
    import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
    import('@midnight-ntwrk/midnight-js-http-client-proof-provider'),
    import('@midnight-ntwrk/midnight-js-level-private-state-provider'),
    import('@midnight-ntwrk/midnight-js-utils'),
    import('@midnight-verify/contract'),
    import('@midnight-verify/contract'),
    import('@midnight-verify/contract'),
    import('@midnight-ntwrk/compact-js/effect/CompiledContract'),
    import('effect'),
    import('@midnight-ntwrk/midnight-js-types'),
  ]);

  const { parseCoinPublicKeyToHex, parseEncPublicKeyToHex } = utils;

  // ── Step 1: get coin / enc public keys from Lace ────────────────────────
  const addresses = await lace.getShieldedAddresses();
  const coinPkBech32 = addresses.shieldedCoinPublicKey;
  const encPkBech32  = addresses.shieldedEncryptionPublicKey;
  const coinPkHex    = parseCoinPublicKeyToHex(coinPkBech32, NETWORK_ID);
  const encPkHex     = parseEncPublicKeyToHex(encPkBech32, NETWORK_ID);

  // ── Step 2: build ZKConfigProvider (fetches keys from /zk/ static files) ─
  const zkConfigProvider = await buildFetchZkConfigProvider(BASE_URL);

  // ── Step 3: build KeyMaterialProvider for Lace's getProvingProvider() ────
  const keyMaterialProvider: LaceKeyMaterialProvider = {
    async getZKIR(loc)        { return zkConfigProvider.getZKIR(loc) as Promise<Uint8Array>; },
    async getProverKey(loc)   { return zkConfigProvider.getProverKey(loc) as Promise<Uint8Array>; },
    async getVerifierKey(loc) { return zkConfigProvider.getVerifierKey(loc) as Promise<Uint8Array>; },
  };

  // ── Step 4: get ProvingProvider from Lace, wrap into ProofProvider ────────
  const lacePP  = await lace.getProvingProvider(keyMaterialProvider);
  const proofProvider = mkProofProvider(lacePP as never);

  // ── Step 5: assemble MidnightProviders ────────────────────────────────────
  // WalletProvider: bridges Lace's balanceUnsealedTransaction → balanceTx
  // MidnightProvider: bridges Lace's submitTransaction → submitTx
  const walletProvider = {
    getCoinPublicKey:       () => coinPkHex,
    getEncryptionPublicKey: () => encPkHex,
    balanceTx: async (tx: unknown, _ttl?: Date) => {
      // Serialize the unbound transaction, balance via Lace, return finalized tx
      const { toHex } = await import('@midnight-ntwrk/midnight-js-utils');
      const serialized = toHex(tx as Uint8Array);
      const balanced = await lace.balanceUnsealedTransaction(serialized, { payFees: true });
      return balanced.tx as unknown;
    },
  };

  const midnightProvider = {
    submitTx: async (tx: unknown) => {
      const { toHex } = await import('@midnight-ntwrk/midnight-js-utils');
      const serialized = toHex(tx as Uint8Array);
      await lace.submitTransaction(serialized);
      return '';  // txId not returned by Lace submitTransaction
    },
  };

  const publicDataProvider = indexerPublicDataProvider(INDEXER, INDEXER_WS);

  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName:          'midnight-verify-frontend',
    signingKeyStoreName:            'midnight-verify-frontend-signing',
    privateStoragePasswordProvider: () => 'midnight-verify-state-v1',
    accountId:                      coinPkHex,
  });

  const providers = {
    walletProvider,
    midnightProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    privateStateProvider,
  } as ReturnType<typeof Object.assign>; // typed as any to avoid deep generics mismatch

  // ── Step 6: build private state and compiled contract ─────────────────────
  const privateState = createPrivateState(privateAge);
  const witnesses    = createWitnessProvider(privateState);

  const compiledContract = effectMod.pipe(
    compiledContractMod.make('midnight-verify/age-verify/v1', Contract),
    compiledContractMod.withWitnesses({ witnesses }),
    compiledContractMod.withCompiledFileAssets(`${BASE_URL}/zk`),
  );

  onStatus('submitting');

  // ── Step 7: connect to deployed contract ──────────────────────────────────
  const deployed = await findDeployedContract(providers, {
    compiledContract,
    contractAddress,
    privateStateId:      'ageVerifyPrivateState',
    initialPrivateState: privateState,
  });

  onStatus('awaiting-confirmation');

  // ── Step 8: call verifyAge circuit ────────────────────────────────────────
  // verifyAge() takes no arguments — age comes from the witness (private state)
  // Returns FinalizedCallTxData which includes the finalized on-chain result
  await deployed.callTx.verifyAge();

  // ── Step 9: read updated public ledger state ──────────────────────────────
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error('Contract state not found after transaction — indexer may be lagging, try again in a few seconds');
  }

  // contractState.data is ChargedState; ledger() decodes it into the typed Ledger
  const updatedLedger = ledger(contractState.data);

  // Return ONLY the public result — the private age never appears here
  return {
    eligible:          updatedLedger.eligible,
    threshold:         updatedLedger.threshold,
    verificationCount: updatedLedger.verificationCount,
  };
}
