/**
 * Midnight Verify — On-Chain Verification Runner (Browser / Midnight wallet)
 *
 * Executes the real verifyAge circuit against the deployed Preprod contract,
 * using the Midnight wallet DApp Connector API (I AM Wallet or Lace) for key
 * material, proving, transaction balancing, signing and submission.
 *
 * This module is dynamically imported to keep the large Midnight runtime/WASM
 * packages out of the static frontend bundle — it loads only when a live
 * contract call happens.
 *
 * ── Wallet / provider bridging ──────────────────────────────────────────────
 *
 * The adapter below follows the reference pattern published by the I AM Wallet
 * developers (1am.xyz/developers):
 *
 *   ConnectedAPI.getConfiguration()          → indexer URIs + network id
 *   setNetworkId(config.networkId)           → lets midnight-js parse keys
 *   getProvingProvider(keyMaterialProvider)  → ProvingProvider
 *   balanceUnsealedTransaction(hex)          → balanced + signed tx (hex)
 *   submitTransaction(hex)                   → broadcast
 *
 *   walletProvider.balanceTx(tx)   = serialize(tx) → hex → balance → deserialize
 *   midnightProvider.submitTx(tx)  = serialize(tx) → hex → submit → tx.identifiers()[0]
 *
 * ── ZK key files ────────────────────────────────────────────────────────────
 *
 * Keys are served from the frontend at:
 *   /zk/keys/{circuitName}.prover
 *   /zk/keys/{circuitName}.verifier
 *   /zk/zkir/{circuitName}.zkir
 * (copied via: npm run copy-zk-keys --workspace=frontend)
 *
 * ── PRIVACY ──────────────────────────────────────────────────────────────────
 *
 * The private age lives only in the local private state and is fed into the
 * ZK circuit through the getAge witness. It is never transmitted on-chain;
 * only the boolean eligibility result is written to the public ledger.
 */

import type { VerificationResult, VerificationStatus } from './types.js';

export interface OnChainVerificationParams {
  readonly privateAge:      bigint;
  readonly threshold:       bigint;
  readonly contractAddress: string;
  readonly walletApi:       unknown;  // Midnight wallet ConnectedAPI (I AM Wallet / Lace)
  readonly laceApi:         unknown;  // Connected Lace wallet API
  readonly onStatus:        (s: VerificationStatus) => void;
}

// ---------------------------------------------------------------------------
// Inline types for the Midnight DApp Connector API (WalletConnectedAPI shape)
// ---------------------------------------------------------------------------
interface MidnightProvingProvider {
  prove(
    circuit: string,
    proverKey: Uint8Array,
    zkir: Uint8Array,
    publicInputs: Uint8Array,
    privateInputs: Uint8Array,
  ): Promise<Uint8Array>;
}

interface MidnightConfiguration {
  readonly indexerUri: string;
  readonly indexerWsUri: string;
  readonly networkId: string;
}

interface MidnightConnectedAPI {
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getConfiguration(): Promise<MidnightConfiguration>;
  getProvingProvider(kmp: unknown): Promise<MidnightProvingProvider>;
  balanceUnsealedTransaction(tx: string, options?: { payFees?: boolean }): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
  hintUsage(methodNames: readonly string[]): Promise<void>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getUnshieldedBalances(): Promise<Record<string, bigint>>;
}

// ---------------------------------------------------------------------------
// Timeout helper — used by both the API and the runner
// ---------------------------------------------------------------------------
function withTimeout<Ms>(promise: Promise<Ms>, ms: number, label: string): Promise<Ms> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms — stage: ${label}`)), ms);
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Small hex helpers (no Buffer dependency so they work in the browser)
// ---------------------------------------------------------------------------
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// ZKConfigProvider built from HTTP-fetched key files (served from /zk/).
// Extends the abstract ZKConfigProvider<K> from midnight-js-types so the
// protocol also gets the concrete getVerifierKeys() implementation.
// The same object doubles as the KeyMaterialProvider the wallet's
// getProvingProvider() expects (ZKIR/ProverKey/VerifierKey extend Uint8Array).
// ---------------------------------------------------------------------------
async function buildFetchZkConfigProvider(baseUrl: string) {
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
// Cached ZKConfigProvider — fetched once per wallet session and reused.
// The ZK key files (prover/verifier/zkir) are static assets served from /zk/;
// caching avoids the 30s fetch on every verification call.
// A per-session cache is stored in the API state so across multiple
// verifications within the same wallet session the keys are only fetched once.
// -------------------------------------------------------------------------//
let cachedZkConfigProvider: ReturnType<typeof buildFetchZkConfigProvider> | null = null;
let cachedZkConfigBaseUrl: string | null = null;

function getCachedZkConfigProvider(baseUrl: string): ReturnType<typeof buildFetchZkConfigProvider> {
  if (cachedZkConfigProvider === null || cachedZkConfigBaseUrl !== baseUrl) {
    cachedZkConfigProvider = buildFetchZkConfigProvider(baseUrl);
    cachedZkConfigBaseUrl = baseUrl;
  }
  return cachedZkConfigProvider;
}

// ---------------------------------------------------------------------------
// Cached proving provider — initialized once when wallet connects, reused
// across all subsequent verifications. The wallet's getProvingProvider()
// returns a provider that is safe to reuse for multiple prove calls as long
// as the underlying wallet connection remains active.
// ---------------------------------------------------------------------------
class CachedProvingProvider {
  private provider: MidnightProvingProvider | null = null;
  private initialized = false;

  async getProvider(wallet: MidnightConnectedAPI, kmp: unknown): Promise<MidnightProvingProvider> {
    if (!this.initialized) {
      // tslint:disable-next-line: no-floating-promises
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      (async () => {
        try {
          this.provider = await wallet.getProvingProvider(kmp);
          this.initialized = true;
        } catch {
          // Initialization failed; will retry on next call.
        }
      })();
    }
    if (this.provider) {
      return this.provider;
    }
    // Fallthrough: re-attempt initialization
    this.provider = await wallet.getProvingProvider(kmp);
    this.initialized = true;
    return this.provider;
  }
}

// ---------------------------------------------------------------------------
// runOnChainVerification
// ---------------------------------------------------------------------------
export async function runOnChainVerification(
  params: OnChainVerificationParams,
): Promise<VerificationResult> {
  const { privateAge, threshold, contractAddress, walletApi, onStatus } = params;

  const wallet = walletApi as MidnightConnectedAPI;

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  // ── Log timing markers ──
  const markers: { [key: string]: number } = {};
  const log = (stage: string) => {
    markers[stage] = performance.now();
    // In production, could emit to console or RAI; here we just track.
    // if (typeof window !== 'undefined') {
    //   console.log(`[VERIFY] ${stage} started at ${markers[stage]}ms`);
    // }
  };
  const markEnd = (stage: string) => {
    const start = markers[stage];
    if (start !== undefined) {
      // const duration = performance.now() - start;
      // if (typeof window !== 'undefined') {
      //   console.log(`[VERIFY] ${stage} completed in ${duration.toFixed(0)}ms`);
      // }
    }
  };

  log('init-start');

  // Dynamic imports — loaded only when the live contract path is taken
  const [
    { findDeployedContract },
    { indexerPublicDataProvider },
    { levelPrivateStateProvider },
    { setNetworkId },
    { Transaction },
    { createProofProvider: mkProofProvider },
    { Contract },
    { createWitnessProvider, createPrivateState },
    compiledContractMod,
    effectMod,
    { ledger },
  ] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-contracts'),
    import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
    import('@midnight-ntwrk/midnight-js-level-private-state-provider'),
    import('@midnight-ntwrk/midnight-js-network-id'),
    import('@midnight-ntwrk/ledger-v8'),
    import('@midnight-ntwrk/midnight-js-types'),
    import('@midnight-verify/contract'),
    import('@midnight-verify/contract'),
    import('@midnight-ntwrk/compact-js/effect/CompiledContract'),
    import('effect'),
    import('@midnight-verify/contract'),
  ]);

  // ── Step 1: resolve the wallet's network + service configuration ───────────
  log('get-configuration-start');
  const configPromise = wallet.getConfiguration();
  const config = await withTimeout(configPromise, 15000, 'get-configuration');
  setNetworkId(config.networkId);
  onStatus('generating-proof');
  markEnd('get-configuration-start');

  // ── Step 2: get coin / enc public keys from Midnight wallet (Bech32m) ─────
  log('get-shielded-addresses-start');
  const addressesPromise = wallet.getShieldedAddresses();
  const addresses = await withTimeout(addressesPromise, 15000, 'get-shielded-addresses');
  onStatus('proof-generated');
  const coinPkBech32 = addresses.shieldedCoinPublicKey;
  const encPkBech32  = addresses.shieldedEncryptionPublicKey;
  markEnd('get-shielded-addresses-start');

  // ── Step 3: build ZKConfigProvider (cached) + get ProvingProvider from wallet ──
  log('build-zk-config-start');
  const zkConfigProvider = await withTimeout(
    getCachedZkConfigProvider(BASE_URL),
    30000,
    'build-zk-config'
  );
  markEnd('build-zk-config-start');

  log('get-proving-provider-start');
  const provingCache = new CachedProvingProvider();
  const walletPP  = await withTimeout(
    provingCache.getProvider(wallet, zkConfigProvider as never),
    60000,
    'get-proving-provider'
  );
  const proofProvider = mkProofProvider(walletPP as never);
  markEnd('get-proving-provider-start');

  // ── Step 4: assemble MidnightProviders ────────────────────────────────────
  // WalletProvider / MidnightProvider bridge the wallet ConnectedAPI into the
  // interfaces midnight-js expects. tx objects are ledger Transaction instances;
  // the wallet only speaks serialized hex.
  const walletProvider = {
    getCoinPublicKey:       () => coinPkBech32,
    getEncryptionPublicKey: () => encPkBech32,
    balanceTx: async (tx: unknown, _ttl?: Date) => {
      const txObj = tx as { serialize(): Uint8Array };
      const serialized = toHex(txObj.serialize());
      const balanced = await wallet.balanceUnsealedTransaction(serialized, { payFees: true });
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider = {
    submitTx: async (tx: unknown) => {
      const txObj = tx as { serialize(): Uint8Array; identifiers(): string[] };
      const serialized = toHex(txObj.serialize());
      await wallet.submitTransaction(serialized);
      return txObj.identifiers()[0];
    },
  };

  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri,
    typeof WebSocket !== 'undefined' ? WebSocket : undefined,
  );

  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName:          'midnight-verify-frontend',
    signingKeyStoreName:            'midnight-verify-frontend-signing',
    privateStoragePasswordProvider: () => 'midnight-verify-state-v1',
    accountId:                      coinPkBech32,
  });

  const providers = {
    walletProvider,
    midnightProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    privateStateProvider,
  } as ReturnType<typeof Object.assign>; // typed as any to avoid deep generics mismatch

  // ── Step 5: build private state and compiled contract ─────────────────────
  log('build-private-state-start');
  const privateState = createPrivateState(privateAge);
  const witnesses    = createWitnessProvider(privateState);

  const compiledContract = effectMod.pipe(
    compiledContractMod.make('midnight-verify/age-verify/v1', Contract),
    compiledContractMod.withWitnesses(witnesses),
    compiledContractMod.withCompiledFileAssets(`${BASE_URL}/zk`),
  );
  markEnd('build-private-state-start');

  // ── Step 6: connect to deployed contract (cached address) ──────────────────
  // Use the persisted contract address from localStorage if available,
  // otherwise discover it via findDeployedContract. This avoids the 30s
  // contract discovery on every verification when a contract is already deployed.
  const persistedAddress = typeof localStorage !== 'undefined'
    ? localStorage.getItem('midnight-verify-contract-address')
    : null;

  const effectiveContractAddress = persistedAddress && persistedAddress.startsWith('ct_')
    ? persistedAddress
    : contractAddress;

  log('find-deployed-contract-start');
  const deployed = await withTimeout(
    findDeployedContract(providers, {
      compiledContract,
      contractAddress: effectiveContractAddress,
      // Unique per verification so a fresh private age is used for every call
      // (avoids reusing private state stored by a previous interaction).
      privateStateId:      `ageVerifyPrivateState-${Date.now()}`,
      initialPrivateState: privateState,
    }),
    30000,
    'find-deployed-contract'
  );
  markEnd('find-deployed-contract-start');

  // ── Step 7: call verifyAge circuit ────────────────────────────────────────
  // verifyAge() takes no arguments — age comes from the witness (private state)
  // Returns FinalizedCallTxData which includes the finalized on-chain result
  // Use timeout-protected contract call. `callTx` resolves only after the
  // transaction is confirmed on-chain (midnight-js-contracts submits and waits).
  log('call-tx-verify-age-start');
  onStatus('submitting-transaction');
  const callResult = await withTimeout(
    deployed.callTx.verifyAge(),
    60000,
    'call-tx-verify-age'
  );
  markEnd('call-tx-verify-age-start');
  onStatus('awaiting-confirmation');

  // ── Step 7b: capture the real verification transaction id ───────────────
  // callResult.public is FinalizedTxData { txId, identifiers, blockHash, ... }.
  const verificationTxHash = (
    (callResult as { public?: { txId?: string; identifiers?: readonly string[] } }).public
  )?.txId ?? null;

  // ── Step 8: read updated public ledger state ──────────────────────────────
  log('read-ledger-start');
  const contractState = await providers.publicDataProvider.queryContractState(effectiveContractAddress);
  if (!contractState) {
    throw new Error('Contract state not found after transaction — indexer may be lagging, try again in a few seconds');
  }

  // contractState.data is ChargedState; ledger() decodes it into the typed Ledger
  const updatedLedger = ledger(contractState.data);

  // Return ONLY the public result — the private age never appears here
  const result: VerificationResult = {
    eligible:          updatedLedger.eligible,
    threshold:         updatedLedger.threshold,
    verificationCount: updatedLedger.verificationCount,
    transactionHash:   verificationTxHash,
    contractAddress:   effectiveContractAddress,
  };

  markEnd('read-ledger-start');

  return result;
}