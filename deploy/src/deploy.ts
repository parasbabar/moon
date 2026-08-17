/**
 * Midnight Verify — Preprod Deployment Script
 *
 * Deploys the AgeVerify contract to Midnight Preprod.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PREREQUISITES (all must be satisfied before running)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. Proof server running locally on port 6300:
 *      docker compose -f docker/proof-server.yml up -d
 *      # Wait until logs show "listening on: 0.0.0.0:6300"
 *      # First run downloads ~200 MB of ZK parameters (1-3 min)
 *
 * 2. MIDNIGHT_DEPLOY_SEED in local .env (never commit this file):
 *      MIDNIGHT_DEPLOY_SEED=<your-64-char-hex-seed>
 *    OR use a 24-word BIP-39 mnemonic:
 *      MIDNIGHT_DEPLOY_SEED=word1 word2 ... word24
 *
 * 3. Wallet funded with tNIGHT on Preprod:
 *      https://faucet.midnight.network/
 *      (first run `npm run wallet:address` to get your address)
 *
 * 4. DUST generated for the wallet:
 *      Lace wallet → Preprod → Tokens → Generate tDUST
 *      OR: npm run wallet:dust --workspace=deploy
 *
 * ═══════════════════════════════════════════════════════════════════
 * USAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 *   # Check your wallet address (does not submit a transaction)
 *   npm run wallet:address --workspace=deploy
 *
 *   # Deploy the contract
 *   npm run deploy --workspace=deploy
 *
 * ═══════════════════════════════════════════════════════════════════
 * OUTPUT
 * ═══════════════════════════════════════════════════════════════════
 *
 *   CONTRACT DEPLOYED
 *   Network:  preprod
 *   Address:  <real address printed here>
 *
 *   Then add to .env:
 *   VITE_CONTRACT_ADDRESS=<address>
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createProviders } from './providers.js';
import { makeCompiledContract, makeInitialPrivateState } from './contract-exports.js';
import { buildWalletFromSeed, showWalletAddress } from './wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Load .env from repo root (safe — never logs secret values)
// ---------------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const result: Record<string, string> = { ...process.env as Record<string, string> };
  const envPath = join(REPO_ROOT, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in result)) result[key] = val; // env vars take precedence
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Write contract address back into .env (safe — only writes public address)
// ---------------------------------------------------------------------------
function persistContractAddress(address: string): void {
  const envPath = join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `VITE_CONTRACT_ADDRESS=${address}\n`);
    return;
  }
  let content = readFileSync(envPath, 'utf8');
  if (/^VITE_CONTRACT_ADDRESS=/m.test(content)) {
    content = content.replace(/^VITE_CONTRACT_ADDRESS=.*/m, `VITE_CONTRACT_ADDRESS=${address}`);
  } else {
    content += `\nVITE_CONTRACT_ADDRESS=${address}\n`;
  }
  writeFileSync(envPath, content);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const env          = loadEnv();
  const THRESHOLD    = BigInt(env['ELIGIBILITY_THRESHOLD'] ?? '18');
  const PROOF_SERVER = env['PROOF_SERVER_URL'] ?? 'http://localhost:6300';
  const SEED         = env['MIDNIGHT_DEPLOY_SEED'] ?? '';
  const SHOW_ADDR    = process.argv.includes('--address') || process.argv.includes('-a');

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       MIDNIGHT VERIFY — DEPLOY         ║');
  console.log('║   Prove eligibility. Reveal nothing.   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`  Network:    Preprod`);
  console.log(`  Threshold:  ${THRESHOLD}`);
  console.log(`  Proof srv:  ${PROOF_SERVER}`);
  console.log('');

  // ── Show address only ─────────────────────────────────────────────────
  if (SHOW_ADDR) {
    if (!SEED) {
      console.error('  Set MIDNIGHT_DEPLOY_SEED in .env to derive your wallet address.');
      process.exit(1);
    }
    await showWalletAddress(SEED);
    return;
  }

  // ── Step 1: proof server health check ─────────────────────────────────
  console.log('[ 1/5 ] Checking proof server…');
  try {
    const r = await fetch(`${PROOF_SERVER}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log(`        ✓ Proof server healthy at ${PROOF_SERVER}`);
  } catch (err) {
    console.error(`        ✗ Proof server not reachable: ${(err as Error).message}`);
    console.error('');
    console.error('  Start it:  docker compose -f docker/proof-server.yml up -d');
    console.error('  Then wait for "listening on: 0.0.0.0:6300" in the container logs.');
    process.exit(1);
  }

  // ── Step 2: indexer health check ──────────────────────────────────────
  console.log('[ 2/5 ] Checking Preprod indexer…');
  try {
    const r = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: '{ __typename }' }),
      signal:  AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log('        ✓ Preprod indexer reachable');
  } catch (err) {
    console.error(`        ✗ Preprod indexer unreachable: ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Step 3: wallet ─────────────────────────────────────────────────────
  console.log('[ 3/5 ] Loading wallet…');
  if (!SEED) {
    console.error('        ✗ MIDNIGHT_DEPLOY_SEED not set');
    console.error('');
    console.error('  Required actions:');
    console.error('  1. Open Lace wallet (or the Midnight CLI) on Preprod.');
    console.error('  2. Retrieve your wallet seed (64-char hex or 24-word mnemonic).');
    console.error('  3. Add to your LOCAL .env file (NEVER commit this):');
    console.error('       MIDNIGHT_DEPLOY_SEED=<your-seed>');
    console.error('  4. Fund the wallet at: https://faucet.midnight.network/');
    console.error('     (run --address first to get the correct address)');
    console.error('  5. Generate DUST in Lace → Preprod → Tokens → Generate tDUST');
    process.exit(1);
  }

  let walletResult: Awaited<ReturnType<typeof buildWalletFromSeed>>;
  try {
    walletResult = await buildWalletFromSeed(SEED);
  } catch (err) {
    console.error(`        ✗ Wallet build failed: ${(err as Error).message}`);
    console.error('');
    console.error('  Possible causes:');
    console.error('  - Invalid seed format (must be 64-char hex or 24-word mnemonic)');
    console.error('  - Wallet not yet funded with tNIGHT');
    console.error('  - DUST not yet generated');
    console.error('  - Proof server not running');
    process.exit(1);
  }

  console.log(`        ✓ Wallet loaded`);
  console.log(`          Coin public key: ${walletResult.coinPublicKey.slice(0, 16)}…`);

  // ── Step 4: configure providers ───────────────────────────────────────
  console.log('[ 4/5 ] Configuring providers…');
  const providers = createProviders(walletResult.walletProvider, walletResult.coinPublicKey, {
    proofServerUrl: PROOF_SERVER,
  });
  console.log('        ✓ Providers configured');
  console.log('          ZK assets:  managed/age_verify/keys/ + zkir/');
  console.log('          Indexer:    preprod.midnight.network');

  // ── Step 5: deploy ─────────────────────────────────────────────────────
  console.log('[ 5/5 ] Deploying AgeVerify contract…');
  console.log('        Generating ZK proof for constructor (~30–90 seconds)…');

  const compiledContract    = makeCompiledContract(0n);
  const initialPrivateState = makeInitialPrivateState(0n);

  let deployed: Awaited<ReturnType<typeof deployContract<typeof compiledContract>>>;
  try {
    deployed = await deployContract(providers, {
      compiledContract,
      privateStateId:    'ageVerifyPrivateState',
      initialPrivateState,
      args: [THRESHOLD],   // constructor(initialThreshold: Uint<8>)
    });
  } catch (err) {
    console.error(`        ✗ Deployment failed: ${(err as Error).message}`);
    if ((err as Error).stack) console.error((err as Error).stack);
    await walletResult.walletProvider.stop();
    process.exit(1);
  }

  const contractAddress = deployed.deployTxData.contractAddress;

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║            CONTRACT DEPLOYED ✓                       ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Contract address:  ${contractAddress}`);
  console.log(`  Network:           Preprod`);
  console.log(`  Threshold:         ${THRESHOLD}`);
  console.log('');

  // Persist address to .env (safe — only writes the public contract address)
  persistContractAddress(contractAddress);
  console.log('  ✓ VITE_CONTRACT_ADDRESS written to .env');
  console.log('');
  console.log('  Next steps:');
  console.log('  1. npm run build         (rebuild frontend with new contract address)');
  console.log('  2. Deploy frontend to Vercel / Netlify');
  console.log('');

  await walletResult.walletProvider.stop();
}

main().catch((err: unknown) => {
  console.error('');
  console.error('Fatal error during deployment:');
  console.error((err as Error)?.message ?? err);
  process.exit(1);
});
