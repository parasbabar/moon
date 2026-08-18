/**
 * Midnight Verify — On-Chain Contract Deployment Runner (Browser / Midnight wallet)
 *
 * Deploys the AgeVerify contract to the live network using the Midnight wallet
 * DApp Connector API (I AM Wallet or Lace). The wallet proves the deploy
 * transaction, balances it (paying DUST fees), signs it, and submits it.
 *
 * The resulting contract address is returned to the caller so the frontend can
 * persist it and the app can verify against the live contract.
 *
 * This module is dynamically imported so the heavy Midnight runtime/WASM
 * packages only load when the user actually deploys.
 *
 * ── PRIVACY ──────────────────────────────────────────────────────────────────
 *
 * The deployer's age is held in local private state and used inside the
 * constructor circuit; it never appears on the public ledger. The on-chain
 * contract state only carries { threshold, eligible, verificationCount }.
 */

import type { VerificationStatus } from './types.js';

export interface OnChainDeploymentParams {
  readonly threshold:       bigint;
  readonly initialAge:      bigint;
  readonly walletApi:       unknown;  // Midnight wallet ConnectedAPI (I AM Wallet / Lace)
  readonly onStatus:        (s: VerificationStatus) => void;
}

export interface OnChainDeploymentResult {
  readonly contractAddress: string;
  readonly threshold:       bigint;
  /** The on-chain transaction id of the deployment transaction. */
  readonly transactionHash: string | null;
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
// runOnChainDeployment
// ---------------------------------------------------------------------------
export async function runOnChainDeployment(
  params: OnChainDeploymentParams,
): Promise<OnChainDeploymentResult> {
  const { threshold, initialAge, walletApi, onStatus } = params;

  onStatus('generating-proof');

  const wallet = walletApi as MidnightConnectedAPI;

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  // Dynamic imports — loaded only when a live deployment happens
  const [
    { deployContract },
    { indexerPublicDataProvider },
    { levelPrivateStateProvider },
    { setNetworkId },
    { Transaction },
    { createProofProvider: mkProofProvider },
    { Contract },
    { createWitnessProvider, createPrivateState },
    compiledContractMod,
    effectMod,
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
  ]);

  // ── Step 1: resolve the wallet's network + service configuration ───────────
  const config = await wallet.getConfiguration();
  setNetworkId(config.networkId);

  // ── Step 2: get coin / enc public keys from Midnight wallet (Bech32m) ─────
  const addresses = await wallet.getShieldedAddresses();
  const coinPkBech32 = addresses.shieldedCoinPublicKey;
  const encPkBech32  = addresses.shieldedEncryptionPublicKey;

  // ── Step 3: build ZKConfigProvider + get ProvingProvider from wallet ──────
  const zkConfigProvider = await buildFetchZkConfigProvider(BASE_URL);
  const walletPP  = await wallet.getProvingProvider(zkConfigProvider as never);
  const proofProvider = mkProofProvider(walletPP as never);

  // ── Step 4: assemble MidnightProviders ────────────────────────────────────
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
  const privateState = createPrivateState(initialAge);
  const witnesses    = createWitnessProvider(privateState);

  const compiledContract = effectMod.pipe(
    compiledContractMod.make('midnight-verify/age-verify/v1', Contract),
    compiledContractMod.withWitnesses(witnesses),
    compiledContractMod.withCompiledFileAssets(`${BASE_URL}/zk`),
  );

  onStatus('submitting');

  // ── Step 6: deploy the contract (wallet proves + balances + signs + submits) ─
  // The constructor takes the eligibility threshold as its argument.
  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId:      'ageVerifyPrivateState',
    initialPrivateState: privateState,
    args:                [threshold],
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;

  // The deployment transaction is already finalized by deployContract() (it
  // resolves once the deploy tx is confirmed on-chain). Capture its tx id for
  // display/explorer linking.
  const finalized = deployed.deployTxData.public as unknown as {
    txId?: string;
    identifiers?: readonly string[];
  };
  const transactionHash = finalized.txId ?? finalized.identifiers?.[0] ?? null;

  return { contractAddress, threshold, transactionHash };
}