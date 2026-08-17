/**
 * useAppState — React hook for subscribing to the MidnightVerifyAPI state.
 *
 * Uses RxJS BehaviorSubject under the hood so the React component
 * re-renders whenever the API emits a new state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMidnightVerifyAPI } from '@midnight-verify/api';
import type { AppState, VerificationResult } from '@midnight-verify/api';

export interface UseAppState {
  state: AppState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  verifyEligibility: (age: bigint, threshold?: bigint) => Promise<VerificationResult>;
  resetVerification: () => void;
  deployContract: (contractAddress?: string) => Promise<void>;
}

export function useAppState(): UseAppState {
  const api = useRef(getMidnightVerifyAPI());
  const [state, setState] = useState<AppState>(api.current.currentState);

  useEffect(() => {
    const subscription = api.current.state$.subscribe((newState) => {
      setState(newState);
    });
    return () => subscription.unsubscribe();
  }, []);

  const connectWallet = useCallback(async () => {
    await api.current.connectWallet();
  }, []);

  const disconnectWallet = useCallback(() => {
    api.current.disconnectWallet();
  }, []);

  const verifyEligibility = useCallback(
    async (age: bigint, threshold?: bigint): Promise<VerificationResult> => {
      return api.current.verifyEligibility(age, threshold);
    },
    [],
  );

  const resetVerification = useCallback(() => {
    api.current.resetVerification();
  }, []);

  const deployContract = useCallback(async (contractAddress?: string) => {
    await api.current.deployOrConnect(contractAddress);
  }, []);

  return {
    state,
    connectWallet,
    disconnectWallet,
    verifyEligibility,
    resetVerification,
    deployContract,
  };
}
