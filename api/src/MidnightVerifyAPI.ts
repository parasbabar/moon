/**
 * Midnight Verify — Core API class
 *
 * Bridges the frontend and the Midnight contract/circuit layer.
 *
 * Supports two runtime modes:
 *
 * MODE A — Live Preprod (VITE_CONTRACT_ADDRESS is set + Lace wallet connected)
 *   Frontend → Lace wallet → proof server → Preprod contract → real on-chain result
 *
 * MODE B — Simulator (no contract address, or wallet not available)
 *   Frontend → local Contract simulator (same compiled code, no network needed)
 *   The circuit logic is still enforced by the same compactc-compiled Contract class.
 *   This mode is used for demos/testing without a live node.
 *
 * PRIVACY CONTRACT (enforced in both modes):
 *   - privateAge is passed to the witness only
 *   - privateAge is NEVER stored, logged, or returned
 *   - The API only surfaces the boolean eligibility result
 */

import { BehaviorSubject, type Observable } from 'rxjs';
import {
  type AppState,
  type VerificationResult,
  type WalletInfo,
  type DeploymentInfo,
  VerificationError,
} from './types.js';

const DEFAULT_THRESHOLD    = 18n;
const CONTRACT_ADDRESS_ENV = import.meta.env?.['VITE_CONTRACT_ADDRESS'] as string | undefined;
const NETWORK_ID_ENV       = import.meta.env?.['VITE_NETWORK_ID'] as string | undefined;

export class MidnightVerifyAPI {
  private readonly _state$: BehaviorSubject<AppState>;
  private deploymentInfo: DeploymentInfo | null = null;
  private laceApi: unknown = null;  // Connected Lace wallet API

  constructor() {
    this._state$ = new BehaviorSubject<AppState>({
      walletStatus:       'disconnected',
      walletInfo:         null,
      verificationStatus: 'idle',
      verificationResult: null,
      errorMessage:       null,
      deploymentInfo:     null,
    });
  }

  get state$(): Observable<AppState> {
    return this._state$.asObservable();
  }

  get currentState(): AppState {
    return this._state$.getValue();
  }

  // ── Wallet connection ────────────────────────────────────────────────────

  async connectWallet(): Promise<void> {
    this.updateState({ walletStatus: 'connecting', errorMessage: null });

    try {
      // Detect Lace wallet (Midnight DApp Connector API)
      const midnight = (window as unknown as Record<string, unknown>)['midnight'] as
        Record<string, { connect: (networkId: string) => Promise<unknown> }> | undefined;

      if (midnight) {
        // Real Lace wallet path
        const networkId = NETWORK_ID_ENV ?? 'preprod';
        // Find the first available API key (e.g. 'mnLace' or 'lace')
        const apiKey = Object.keys(midnight)[0];
        if (!apiKey) throw new Error('No Midnight wallet API found');

        const connectedApi = await midnight[apiKey].connect(networkId);
        this.laceApi = connectedApi;

        // Get address info from wallet
        const api = connectedApi as {
          getUnshieldedBalances?: () => Promise<Record<string, bigint>>;
          state?: () => Promise<{ coinPublicKeyString?: () => string }>;
        };

        const walletState = await api.state?.();
        const rawAddress = walletState?.coinPublicKeyString?.() ?? '';
        const displayAddress = rawAddress.length > 12
          ? `${rawAddress.slice(0, 8)}…${rawAddress.slice(-6)}`
          : rawAddress || '(connected)';

        this.updateState({
          walletStatus: 'connected',
          walletInfo: {
            displayAddress,
            fullAddress:  rawAddress,
            network:      networkId,
          },
          errorMessage: null,
        });

        // If a contract address is configured, record deployment info
        if (CONTRACT_ADDRESS_ENV) {
          const depInfo: DeploymentInfo = {
            contractAddress: CONTRACT_ADDRESS_ENV,
            network:         networkId,
            threshold:       DEFAULT_THRESHOLD,
          };
          this.deploymentInfo = depInfo;
          this.updateState({ deploymentInfo: depInfo });
        }

      } else {
        // Lace not installed — fall back to demo mode
        await this.delay(600);
        this.updateState({
          walletStatus: 'connected',
          walletInfo: {
            displayAddress: 'Demo Mode',
            fullAddress:    'demo',
            network:        'simulator',
          },
          errorMessage: null,
          deploymentInfo: {
            contractAddress: 'simulator',
            network:         'simulator',
            threshold:       DEFAULT_THRESHOLD,
          },
        });
        this.deploymentInfo = {
          contractAddress: 'simulator',
          network:         'simulator',
          threshold:       DEFAULT_THRESHOLD,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed';
      this.updateState({ walletStatus: 'error', errorMessage: message });
      throw err;
    }
  }

  disconnectWallet(): void {
    this.laceApi = null;
    this.deploymentInfo = null;
    this.updateState({
      walletStatus:       'disconnected',
      walletInfo:         null,
      verificationStatus: 'idle',
      verificationResult: null,
      errorMessage:       null,
      deploymentInfo:     null,
    });
  }

  async deployOrConnect(contractAddress?: string): Promise<DeploymentInfo> {
    const address = contractAddress ?? CONTRACT_ADDRESS_ENV ?? 'simulator';
    this.deploymentInfo = {
      contractAddress: address,
      network: this.currentState.walletInfo?.network ?? 'preprod',
      threshold: DEFAULT_THRESHOLD,
    };
    this.updateState({ deploymentInfo: this.deploymentInfo });
    return this.deploymentInfo;
  }

  // ── Verification ─────────────────────────────────────────────────────────

  /**
   * Verify eligibility.
   *
   * If a real deployed contract address is configured AND Lace wallet is connected,
   * submits a real transaction to Preprod via the Lace wallet.
   *
   * Otherwise, runs the local circuit simulator (same compiled Contract class,
   * ZK logic enforced, no network required).
   *
   * PRIVACY: privateAge never leaves this call or appears in the result.
   */
  async verifyEligibility(
    privateAge: bigint,
    threshold: bigint = DEFAULT_THRESHOLD,
  ): Promise<VerificationResult> {
    if (privateAge < 0n || privateAge > 150n) {
      throw new VerificationError(
        'Please enter a valid age between 0 and 150.',
        'INVALID_INPUT',
      );
    }

    this.updateState({
      verificationStatus: 'generating-proof',
      verificationResult: null,
      errorMessage:       null,
    });

    try {
      const hasLiveContract =
        CONTRACT_ADDRESS_ENV &&
        CONTRACT_ADDRESS_ENV !== 'simulator' &&
        this.laceApi !== null;

      if (hasLiveContract) {
        return await this.verifyOnChain(privateAge, threshold);
      } else {
        return await this.verifySimulator(privateAge, threshold);
      }
    } catch (err) {
      if (err instanceof VerificationError) {
        this.updateState({ verificationStatus: 'error', errorMessage: err.message });
        throw err;
      }
      const message = 'Verification could not be completed. Please check your wallet connection and try again.';
      this.updateState({ verificationStatus: 'error', errorMessage: message });
      throw new VerificationError(message, 'UNKNOWN');
    }
  }

  // ── Live Preprod path ─────────────────────────────────────────────────────

  private async verifyOnChain(
    privateAge: bigint,
    threshold:  bigint,
  ): Promise<VerificationResult> {
    this.updateState({ verificationStatus: 'generating-proof' });

    // Dynamic import — keeps Midnight runtime packages out of the static bundle
    const { runOnChainVerification } = await import('./onchain-runner.js');

    const result = await runOnChainVerification({
      privateAge,
      threshold,
      contractAddress: CONTRACT_ADDRESS_ENV!,
      laceApi:         this.laceApi,
      onStatus: (status) => {
        this.updateState({ verificationStatus: status });
      },
    });

    if (result.eligible) {
      this.updateState({
        verificationStatus: 'eligible',
        verificationResult: result,
        errorMessage:       null,
      });
    } else {
      this.updateState({
        verificationStatus: 'not-eligible',
        verificationResult: result,
        errorMessage:       null,
      });
    }

    return result;
  }

  // ── Simulator path ─────────────────────────────────────────────────────────

  private async verifySimulator(
    privateAge: bigint,
    threshold:  bigint,
  ): Promise<VerificationResult> {
    await this.delay(1000);
    this.updateState({ verificationStatus: 'submitting' });

    const { runCircuitSimulator } = await import('./circuit-runner.js');
    const circuitResult = await runCircuitSimulator(privateAge, threshold);

    await this.delay(600);
    this.updateState({ verificationStatus: 'awaiting-confirmation' });
    await this.delay(400);

    const result: VerificationResult = {
      eligible:          circuitResult.eligible,
      threshold:         circuitResult.threshold,
      verificationCount: circuitResult.verificationCount,
    };

    this.updateState({
      verificationStatus: circuitResult.eligible ? 'eligible' : 'not-eligible',
      verificationResult: result,
      errorMessage:       null,
    });

    return result;
  }

  resetVerification(): void {
    this.updateState({
      verificationStatus: 'idle',
      verificationResult: null,
      errorMessage:       null,
    });
  }

  private updateState(partial: Partial<AppState>): void {
    this._state$.next({ ...this._state$.getValue(), ...partial });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// Singleton
let _instance: MidnightVerifyAPI | null = null;
export function getMidnightVerifyAPI(): MidnightVerifyAPI {
  if (!_instance) _instance = new MidnightVerifyAPI();
  return _instance;
}
export function resetMidnightVerifyAPI(): void {
  _instance = null;
}
