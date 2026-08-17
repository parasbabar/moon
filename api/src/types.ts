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
  | 'submitting'
  | 'awaiting-confirmation'
  | 'eligible'
  | 'not-eligible'
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
      | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}
