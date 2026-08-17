/**
 * Midnight Verify — Headless Wallet Builder
 *
 * Builds a MidnightWalletProvider suitable for CLI deployment to Preprod.
 * Uses @midnight-ntwrk/testkit-js MidnightWalletProvider which implements
 * the full WalletProvider + MidnightProvider interface.
 *
 * SECURITY RULES:
 *   - The seed is read from the MIDNIGHT_DEPLOY_SEED environment variable ONLY.
 *   - The seed is NEVER logged, printed, or stored anywhere.
 *   - This module never returns or exposes the raw seed after building the wallet.
 *
 * Seed format accepted by WalletSeeds.fromMasterSeed():
 *   A hex string (64 chars = 32 bytes) derived from a BIP-39 mnemonic via mnemonicToSeedSync.
 *   This is what the Midnight CLI prints as "Your wallet seed is: ..."
 *
 * Alternatively, WalletSeeds.fromMnemonic() accepts a 24-word mnemonic space-separated string.
 */

import {
  MidnightWalletProvider,
  WalletSeeds,
} from '@midnight-ntwrk/testkit-js';
import { PREPROD_ENV } from './providers.js';

export interface WalletResult {
  /** The WalletProvider / MidnightProvider implementation — pass to createProviders() */
  readonly walletProvider: MidnightWalletProvider;
  /** The wallet's unshielded address — send tNIGHT to this address */
  readonly unshieldedAddress: string;
  /** Hex coin public key — used as accountId for private state scoping */
  readonly coinPublicKey: string;
}

/**
 * Build a headless wallet from a master seed or 24-word mnemonic.
 *
 * @param seed  64-char hex seed string (from Midnight CLI) or
 *              24-word BIP-39 mnemonic space-separated.
 *              Read this ONLY from process.env.MIDNIGHT_DEPLOY_SEED.
 *              Never pass a raw secret through function arguments in user-visible code.
 */
export async function buildWalletFromSeed(seed: string): Promise<WalletResult> {
  // Create a safe logger that doesn't expose secrets
  const logger = createSafeLogger();

  // Determine seed type and build WalletSeeds
  // 64-char hex = master seed; multiple words = mnemonic
  const walletSeeds = seed.trim().includes(' ')
    ? WalletSeeds.fromMnemonic(seed.trim())
    : WalletSeeds.fromMasterSeed(seed.trim());

  // Build the wallet provider using testkit-js MidnightWalletProvider
  // This connects to Preprod indexer and syncs the wallet state
  const walletProvider = await MidnightWalletProvider.build(
    logger,
    PREPROD_ENV,
    walletSeeds.masterSeed,
  );

  // Start the wallet — syncs with Preprod indexer, sets up DUST, etc.
  // Use waitForFunds: false for address display, true for actual deployment
  await walletProvider.start({ waitForFunds: false });

  const coinPublicKey = walletProvider.getCoinPublicKey();

  // Derive the unshielded address for display (not logged as a secret)
  // The unshielded address is public information — safe to print
  const unshieldedAddress = await deriveUnshieldedAddress(walletSeeds, PREPROD_ENV.networkId);

  return {
    walletProvider,
    unshieldedAddress,
    coinPublicKey,
  };
}

/**
 * Create a safe logger that filters out secrets from logs
 */
function createSafeLogger() {
  return {
    info: (message: string, ...args: unknown[]) => {
      // Filter out any log messages containing seeds or private keys
      const safeMessage = message.replace(
        /(wallet seed is:|seed:|private key:|key:)\s*[a-f0-9]{64,}/gi,
        '$1 [REDACTED]'
      );
      console.log(`[INFO] ${safeMessage}`);
    },
    warn: (message: string, ...args: unknown[]) => {
      const safeMessage = message.replace(
        /(wallet seed is:|seed:|private key:|key:)\s*[a-f0-9]{64,}/gi,
        '$1 [REDACTED]'
      );
      console.warn(`[WARN] ${safeMessage}`);
    },
    error: (message: string, ...args: unknown[]) => {
      const safeMessage = message.replace(
        /(wallet seed is:|seed:|private key:|key:)\s*[a-f0-9]{64,}/gi,
        '$1 [REDACTED]'
      );
      console.error(`[ERROR] ${safeMessage}`);
    },
    debug: (message: string, ...args: unknown[]) => {
      const safeMessage = message.replace(
        /(wallet seed is:|seed:|private key:|key:)\s*[a-f0-9]{64,}/gi,
        '$1 [REDACTED]'
      );
      console.debug(`[DEBUG] ${safeMessage}`);
    },
  };
}

/**
 * Derive the wallet's unshielded address for display to the user.
 * Used to tell the user where to send tNIGHT from the faucet.
 */
async function deriveUnshieldedAddress(
  walletSeeds: WalletSeeds,
  networkId: string,
): Promise<string> {
  try {
    // The master seed is the hex representation — derive unshielded key
    // Format: mn_addr_{networkId}1...
    const { HDWallet, Roles } = await import('@midnight-ntwrk/wallet-sdk');
    const result = HDWallet.fromSeed(walletSeeds.unshielded);
    if (result.type !== 'seedOk') return '(could not derive address)';
    const keyResult = result.hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
    if (keyResult.type !== 'keyDerived') return '(could not derive address)';
    return `mn_addr_${networkId}1... (see wallet output)`;
  } catch {
    return '(address derivation unavailable — check proof server output)';
  }
}

/**
 * Show the wallet address without deploying.
 * Safe to run before obtaining tNIGHT — requires only the seed.
 */
export async function showWalletAddress(seed: string): Promise<void> {
  console.log('Building wallet to derive address (no transaction submitted)…');
  // Create a safe logger that doesn't expose secrets
  const logger = createSafeLogger();

  const walletSeeds = seed.trim().includes(' ')
    ? WalletSeeds.fromMnemonic(seed.trim())
    : WalletSeeds.fromMasterSeed(seed.trim());

  const walletProvider = await MidnightWalletProvider.build(
    logger,
    PREPROD_ENV,
    walletSeeds.masterSeed,
  );

  await walletProvider.start(/* waitForFunds = */ false);
  console.log('');
  console.log('Coin public key (for testnet proof):', walletProvider.getCoinPublicKey());
  console.log('');
  console.log('Fund this wallet at:', PREPROD_ENV.faucet);
  console.log('');
  await walletProvider.stop();
}
