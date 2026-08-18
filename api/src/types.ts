/**
 * Midnight Verify — API layer shared types
 *
 * These types define the public interface between the frontend
 * and the Midnight contract layer.
 */

// ---------------------------------------------------------------------------
// Verification state machine
// ---------------------------------------------------------------------------
export type VerificationStatus =
  | 'idle'
  | 'generating-proof'
  | 'proof-generated'
  | 'waiting-for-wallet-approval'
  | 'submitting'
  | 'submitting-transaction'
  | 'awaiting-confirmation'
  | 'eligible'
  | 'not-eligible'
  | 'rejected'
  | 'error';

// ---------------------------------------------------------------------------
// Wallet connection states
// ---------------------------------------------------------------------------
export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'wrong-network'
  | 'error';

// ---------------------------------------------------------------------------
// Verification result — what the frontend receives after a circuit call
// ---------------------------------------------------------------------------
export interface VerificationResult {
  /** Whether the eligibility condition was satisfied */
  readonly eligible: boolean;

  /** The public threshold that was checked against (e.g. 18) */
  readonly threshold: bigint;

  /** The on-chain verification count after this interaction */
  readonly verificationCount: bigint;

  /**
   * The transaction id of the on-chain verification transaction (live path only).
   * Null when the verification was run through the local simulator.
   */
  readonly transactionHash: string | null;

  /**
   * The contract address the verification was executed against (live path only).
   * Null in simulator mode.
   */
  readonly contractAddress: string | null;

  /**
   * PRIVACY: The exact age is NEVER included here.
   * The frontend must not display the age in the result.
   */
}

// ---------------------------------------------------------------------------
// Wallet info — safe public information only
// ---------------------------------------------------------------------------
export interface WalletInfo {
  /** Shortened display identifier (e.g. "0xABCD...1234") */
  readonly displayAddress: string;

  /** Full address for internal use */
  readonly fullAddress: string;

  /** Network name */
  readonly network: string;

  /** Unshielded NIGHT balance (null when the wallet cannot report it) */
  readonly nightBalance: bigint | null;

  /** Current DUST balance (null when the wallet cannot report it) */
  readonly dustBalance: bigint | null;

  /** Maximum DUST that can be generated from the current NIGHT holding */
  readonly dustCap: bigint | null;
}

// ---------------------------------------------------------------------------
// Contract deployment info
// ---------------------------------------------------------------------------
export interface DeploymentInfo {
  readonly contractAddress: string;
  readonly network: string;
  readonly threshold: bigint;
}

// ---------------------------------------------------------------------------
// Application state — combines wallet + verification
// ---------------------------------------------------------------------------
export interface AppState {
  readonly walletStatus: WalletStatus;
  readonly walletInfo: WalletInfo | null;
  readonly verificationStatus: VerificationStatus;
  readonly verificationResult: VerificationResult | null;
  readonly errorMessage: string | null;
  readonly deploymentInfo: DeploymentInfo | null;
  readonly deploymentStatus: 'idle' | 'in-progress' | 'failed' | 'confirmed';
  readonly deploymentTxHash: string | null;
  readonly trustMode: string;
  readonly isVerifying: boolean;
}

// ---------------------------------------------------------------------------
// Error types for friendly error handling
// ---------------------------------------------------------------------------
export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: 'REJECTED' | 'UNAVAILABLE' | 'WRONG_NETWORK' | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INELIGIBLE'
      | 'INVALID_INPUT'
      | 'PROOF_FAILED'
      | 'CONTRACT_ERROR'
      | 'TIMEOUT'
      | 'DUPLICATE_SUBMISSION'
      | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}
