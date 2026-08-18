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
const NETWORK_ID_ENV =
  (import.meta.env?.['VITE_MIDNIGHT_NETWORK'] as string | undefined) ??
  (import.meta.env?.['VITE_NETWORK_ID'] as string | undefined);

export class MidnightVerifyAPI {
  private readonly _state$: BehaviorSubject<AppState>;
  private deploymentInfo: DeploymentInfo | null = null;
  private laceApi: unknown = null;  // Connected Lace wallet API
  private deploymentStatus: 'idle' | 'in-progress' | 'failed' | 'confirmed' = 'idle';
  private deploymentTxHash: string | null = null;

  constructor() {
    this._state$ = new BehaviorSubject<AppState>({
      walletStatus:       'disconnected',
      walletInfo:         null,
      verificationStatus: 'idle',
      verificationResult: null,
      errorMessage:       null,
      deploymentInfo:     null,
      deploymentStatus:   'idle',
      deploymentTxHash:   null,
      trustMode:          'self-attested-demo',
      isVerifying:        false,
    });
    this.restoreDeploymentState();
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

        // Best-effort balance fetch (NIGHT has 6 decimals, DUST has 15).
        let nightBalance: bigint | null = null;
        let dustBalance:  bigint | null = null;
        let dustCap:      bigint | null = null;
        try {
          const balances = await api.getUnshieldedBalances?.();
          if (balances) {
            nightBalance = balances['NIGHT'] ?? balances['tNIGHT'] ?? null;
            dustBalance  = balances['DUST']  ?? balances['tDUST']  ?? null;
            dustCap      = balances['DUST_CAP'] ?? null;
          }
        } catch {
          // Balances are informational only — never block connection on failure.
        }

        this.updateState({
          walletStatus: 'connected',
          walletInfo: {
            displayAddress,
            fullAddress:  rawAddress,
            network:      networkId,
            nightBalance,
            dustBalance,
            dustCap,
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
            nightBalance:   null,
            dustBalance:    null,
            dustCap:        null,
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
      deploymentStatus:   'idle',
      deploymentTxHash:   null,
    });
  }

  /** Persist deployed contract address to localStorage. */
  private persistDeployedAddress(address: string): void {
    try {
      localStorage.setItem('midnight-verify-contract-address', address);
    } catch {
      // Persistence is best-effort.
    }
  }

  /** Persist deployment transaction hash and status to localStorage. */
  private persistDeploymentInfo(address: string, txHash: string | null, status: 'idle' | 'in-progress' | 'failed' | 'confirmed'): void {
    try {
      const info = { address, txHash, status };
      localStorage.setItem('midnight-verify-deployment-info', JSON.stringify(info));
    } catch {
      // Persistence is best-effort.
    }
  }

  /**
   * Resolve the effective contract address for live verification:
   *   1. An address configured at build time (VITE_CONTRACT_ADDRESS)
   *   2. An address deployed in this session
   *   3. An address persisted in localStorage from a previous session
   */
  private getEffectiveContractAddress(): string | null {
    const candidates: (string | null)[] = [
      CONTRACT_ADDRESS_ENV && CONTRACT_ADDRESS_ENV !== 'simulator'
        ? CONTRACT_ADDRESS_ENV
        : null,
      this.deploymentInfo?.contractAddress ?? null,
    ];
    try {
      const persisted = localStorage.getItem('midnight-verify-contract-address');
      if (persisted) candidates.push(persisted);
    } catch {
      // localStorage unavailable — best-effort
    }
    const live = candidates.find(
      (c) => c !== null && c.startsWith('ct_'),
    );
    return live ?? null;
  }

  /** Restore a previously deployed contract (if any) into state. */
  private restoreDeploymentState(): void {
    try {
      const stored = localStorage.getItem('midnight-verify-deployment-info');
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        address?: string;
        txHash?: string | null;
        status?: 'idle' | 'in-progress' | 'failed' | 'confirmed';
      };
      if (!parsed.address || !parsed.address.startsWith('ct_')) return;

      const depInfo: DeploymentInfo = {
        contractAddress: parsed.address,
        network: this.currentState.walletInfo?.network ?? 'preprod',
        threshold: DEFAULT_THRESHOLD,
      };
      this.deploymentInfo = depInfo;
      this.updateState({
        deploymentInfo: depInfo,
        deploymentStatus: parsed.status ?? 'confirmed',
        deploymentTxHash: parsed.txHash ?? null,
      });
    } catch {
      // Best-effort restore.
    }
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

  /**
   * Deploy the AgeVerify contract through the connected Midnight wallet.
   *
   * If a contract address is already configured (VITE_CONTRACT_ADDRESS at build
   * time, or a previously deployed address persisted locally), this is a no-op
   * that returns the existing deployment info.
   *
   * The user must approve the deploy transaction in the wallet popup; DUST fees
   * are handled automatically by the wallet.
   *
   * This triggers a real on-chain transaction via the I AM Wallet / Lace wallet.
   * It does NOT bypass localStorage — that bypass only happens when called from
   * verifyEligibility's live contract path.
   */
  async deployContract(initialAge: bigint = DEFAULT_THRESHOLD): Promise<DeploymentInfo> {
    if (!this.laceApi) {
      throw new VerificationError(
        'Connect your Midnight wallet before deploying.',
        'UNKNOWN',
      );
    }

    try {
      const { runOnChainDeployment } = await import('./deploy-runner.js');

      const result = await runOnChainDeployment({
        threshold:       DEFAULT_THRESHOLD,
        initialAge,
        walletApi:       this.laceApi,
        onStatus:        (status) => {
          // Map verification statuses to deployment statuses
          switch (status) {
            case 'generating-proof':
            case 'submitting':
              this.updateState({ deploymentStatus: 'in-progress' });
              break;
            case 'awaiting-confirmation':
              this.updateState({ deploymentStatus: 'in-progress' });
              break;
            case 'eligible':
              this.updateState({ deploymentStatus: 'confirmed' });
              break;
            case 'not-eligible':
            case 'error':
              this.updateDeploymentStatus('failed');
              break;
            default:
              this.updateState({ deploymentStatus: 'in-progress' });
          }
        },
      });

      const depInfo: DeploymentInfo = {
        contractAddress: result.contractAddress,
        network:         this.currentState.walletInfo?.network ?? NETWORK_ID_ENV ?? 'preprod',
        threshold:       result.threshold,
      };

      this.deploymentInfo = depInfo;
      // Persist the deployment address and its transaction hash.
      const txHash: string | null = result.transactionHash ?? null;
      this.persistDeployedAddress(result.contractAddress);
      this.persistDeploymentInfo(result.contractAddress, txHash, 'confirmed');
      this.updateState({ deploymentInfo: depInfo, deploymentStatus: 'confirmed', deploymentTxHash: txHash, errorMessage: null });
      return depInfo;
    } catch (err) {
      this.updateDeploymentStatus('failed');
      const message = err instanceof Error
        ? err.message
        : 'Contract deployment could not be completed. Please check your wallet connection and try again.';
      this.updateState({ errorMessage: message });
      throw new VerificationError(message, 'UNKNOWN');
    }
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
    if (this.currentState.isVerifying) {
      throw new VerificationError(
        'A verification is already in progress. Please wait for it to complete.',
        'DUPLICATE_SUBMISSION',
      );
    }
    this.updateState({
      isVerifying: true,
      verificationStatus: 'generating-proof',
      verificationResult: null,
      errorMessage:       null,
    });
    try {
      // A live contract is one that was deployed (build-time env, this session,
      // or persisted in localStorage) AND a real Midnight wallet is connected.
      const effectiveAddress = this.getEffectiveContractAddress();
      const hasLiveContract =
        effectiveAddress !== null && this.laceApi !== null;

      if (hasLiveContract) {
        return await this.verifyOnChain(privateAge, threshold, effectiveAddress!);
      } else {
        return await this.verifySimulator(privateAge, threshold);
      }
    } catch (err) {
      if (err instanceof VerificationError) {
        this.updateState({ verificationStatus: 'error', errorMessage: err.message, isVerifying: false });
        throw err;
      }
      const message = 'Verification could not be completed. Please check your wallet connection and try again.';
      this.updateState({ verificationStatus: 'error', errorMessage: message, isVerifying: false });
      throw new VerificationError(message, 'UNKNOWN');
    }
  }

  // ── Live Preprod path ─────────────────────────────────────────────────────

  private async verifyOnChain(
    privateAge: bigint,
    threshold:  bigint,
    contractAddress: string,
  ): Promise<VerificationResult> {
    this.updateState({ verificationStatus: 'generating-proof' });

    // Dynamic import — keeps Midnight runtime packages out of the static bundle
    const { runOnChainVerification } = await import('./onchain-runner.js');

    const result = await runOnChainVerification({
      privateAge,
      threshold,
      contractAddress,
      walletApi:       this.laceApi,
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
      transactionHash:   null,
      contractAddress:   null,
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

  private updateDeploymentStatus(status: 'idle' | 'in-progress' | 'failed' | 'confirmed'): void {
    this.deploymentStatus = status;
    this.updateState({ deploymentStatus: status });
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
