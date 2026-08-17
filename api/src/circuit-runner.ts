/**
 * Midnight Verify — Circuit Runner
 *
 * This module is dynamically imported by MidnightVerifyAPI.verifyEligibility().
 * It runs the real compiled Contract simulator using the Compact runtime.
 *
 * Dynamic import keeps @midnight-ntwrk/onchain-runtime-v3 (WASM) out of the
 * static Vite bundle — it only loads at runtime when verification is triggered.
 *
 * In a production deployment with a live Preprod node:
 *   - Replace runCircuitSimulator with a full Midnight.js provider stack call
 *   - The Lace wallet handles ZK proof generation natively
 *   - This file would call deployed.call.verifyAge() instead
 */

export interface CircuitRunResult {
  eligible: boolean;
  threshold: bigint;
  verificationCount: bigint;
}

/**
 * Run the verifyAge circuit using the real Contract simulator.
 *
 * Uses the compiled contract artifacts from managed/age_verify/index.js
 * and the @midnight-ntwrk/compact-runtime for state management.
 *
 * PRIVACY: privateAge is used only as a witness input to the circuit.
 * It is not stored or returned. Only the boolean result is surfaced.
 */
export async function runCircuitSimulator(
  privateAge: bigint,
  threshold: bigint,
): Promise<CircuitRunResult> {
  // Dynamic imports — loads WASM runtime only when called
  const [
    { Contract },
    { createPrivateState, createWitnessProvider },
    { createCircuitContext, createConstructorContext },
    { sampleContractAddress },
  ] = await Promise.all([
    import('@midnight-verify/contract'),
    import('@midnight-verify/contract'),
    import('@midnight-ntwrk/compact-runtime'),
    import('@midnight-ntwrk/onchain-runtime-v3'),
  ]);

  // Build private state — age stays here only
  const privateState = createPrivateState(privateAge);
  const witnesses = createWitnessProvider(privateState);

  // Instantiate contract with witnesses
  const contract = new Contract(witnesses);

  // Initialise contract state (runs the Compact constructor)
  const constructorCtx = createConstructorContext(
    privateState,
    '00'.repeat(32), // dummy coin public key for simulator
  );
  const { currentContractState } = contract.initialState(constructorCtx, threshold);

  // Build circuit context
  const circuitCtx = createCircuitContext(
    sampleContractAddress(),
    '00'.repeat(32),
    currentContractState,
    privateState,
  );

  // Execute the circuit — throws if age < threshold (ZK proof would fail)
  let eligible = false;
  let finalThreshold = threshold;
  let verificationCount = 0n;

  try {
    const result = contract.circuits.verifyAge(circuitCtx);
    const { ledger } = await import('@midnight-verify/contract');
    const updatedLedger = ledger(result.context.currentQueryContext.state);
    eligible = updatedLedger.eligible;
    finalThreshold = updatedLedger.threshold;
    verificationCount = updatedLedger.verificationCount;
  } catch (_err) {
    // Circuit assert failed — ineligible (proof construction would fail on-chain)
    eligible = false;
  }

  // IMPORTANT: privateAge is not returned or stored after this point
  return { eligible, threshold: finalThreshold, verificationCount };
}
