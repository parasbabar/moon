/**
 * Midnight Verify — Real Contract Simulator Tests
 *
 * These tests use the ACTUAL compiler-generated Contract class from
 * `src/managed/age_verify/contract/index.js` (compiled by compactc 0.31.0).
 *
 * They exercise the real circuit logic using the Midnight runtime simulator:
 * - Real Contract class from compiled output
 * - Real createCircuitContext / createConstructorContext from @midnight-ntwrk/compact-runtime
 * - Real ContractState / QueryContext from @midnight-ntwrk/onchain-runtime-v3
 * - No ZK proof generation (simulator mode skips proof construction)
 * - No network calls, no Docker
 *
 * HOW SIMULATOR TESTS WORK:
 *   1. contract.initialState(ctx, threshold) → ContractState (initial ledger)
 *   2. createCircuitContext(address, coinPubKey, contractState, privateState) → CircuitContext
 *   3. contract.circuits.verifyAge(circuitCtx) → CircuitResults { context, result }
 *   4. Use the updated context.currentQueryContext to read new ledger state via ledger()
 *
 * Run: npm run test:run:sim  (simulator only)
 *      npm run test:run       (all tests)
 */

import { describe, it, expect } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
} from '@midnight-ntwrk/compact-runtime';
import {
  sampleContractAddress,
} from '@midnight-ntwrk/onchain-runtime-v3';
import {
  Contract,
  ledger,
} from './managed/age_verify/contract/index.js';
import { createPrivateState, createWitnessProvider } from './private-state.js';
import type { AgeVerifyPrivateState } from './private-state.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

// A dummy CoinPublicKey — plain lowercase hex, no 0x prefix.
// In real usage this is derived from the wallet's spending key.
// Format confirmed by testing @midnight-ntwrk/onchain-runtime-v3's encodeCoinPublicKey.
const DUMMY_COIN_PK = '00'.repeat(32);

// A dummy contract address — in real usage this is set after deployment.
const CONTRACT_ADDRESS = sampleContractAddress();

const THRESHOLD_18 = 18n;

// ---------------------------------------------------------------------------
// Helpers: initialise a fresh contract with a given threshold
// ---------------------------------------------------------------------------

interface ContractFixture {
  contract: Contract<AgeVerifyPrivateState>;
  contractState: import('@midnight-ntwrk/onchain-runtime-v3').ContractState;
  privateState: AgeVerifyPrivateState;
}

function initContract(
  age: bigint,
  threshold: bigint = THRESHOLD_18,
): ContractFixture {
  const privateState = createPrivateState(age);
  const witnesses = createWitnessProvider(privateState);
  const contract = new Contract<AgeVerifyPrivateState>(witnesses);

  // Build constructor context — needed to call contract.initialState()
  const constructorCtx = createConstructorContext<AgeVerifyPrivateState>(
    privateState,
    DUMMY_COIN_PK,
  );

  // Execute the Compact constructor: sets threshold, eligible=false, count=0
  const constructorResult = contract.initialState(constructorCtx, threshold);

  return {
    contract,
    contractState: constructorResult.currentContractState,
    privateState: constructorResult.currentPrivateState,
  };
}

/**
 * Build a CircuitContext for calling a circuit on the current contract state.
 */
function buildCircuitCtx(
  contractState: import('@midnight-ntwrk/onchain-runtime-v3').ContractState,
  privateState: AgeVerifyPrivateState,
) {
  return createCircuitContext<AgeVerifyPrivateState>(
    CONTRACT_ADDRESS,
    DUMMY_COIN_PK,
    contractState,
    privateState,
  );
}

// ---------------------------------------------------------------------------
// Test Suite 1: Core circuit logic
// ---------------------------------------------------------------------------

describe('AgeVerify — Real Simulator Tests (compactc 0.31.0)', () => {

  // -------------------------------------------------------------------------
  // Test 1: Eligible user — standard case
  // -------------------------------------------------------------------------
  it('eligible user (age 25, threshold 18) is verified', () => {
    const { contract, contractState, privateState } = initContract(25n, THRESHOLD_18);

    // Read initial state — eligible should be false
    const initialLedger = ledger(contractState.data);
    expect(initialLedger.eligible).toBe(false);
    expect(initialLedger.threshold).toBe(18n);
    expect(initialLedger.verificationCount).toBe(0n);

    // Execute verifyAge circuit
    const ctx = buildCircuitCtx(contractState, privateState);
    const result = contract.circuits.verifyAge(ctx);

    // Read updated ledger from result context
    const updatedLedger = ledger(result.context.currentQueryContext.state);
    expect(updatedLedger.eligible).toBe(true);
    expect(updatedLedger.threshold).toBe(18n);           // threshold unchanged
    expect(updatedLedger.verificationCount).toBe(1n);

    // CRITICAL PRIVACY CHECK: exact age must NOT be in ledger
    const serialized = JSON.stringify(updatedLedger, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(serialized).not.toContain('25');
  });

  // -------------------------------------------------------------------------
  // Test 2: Boundary condition — exactly at threshold
  // -------------------------------------------------------------------------
  it('boundary condition (age 18 == threshold 18) is verified', () => {
    const { contract, contractState, privateState } = initContract(18n, THRESHOLD_18);

    const ctx = buildCircuitCtx(contractState, privateState);
    const result = contract.circuits.verifyAge(ctx);

    const updatedLedger = ledger(result.context.currentQueryContext.state);
    expect(updatedLedger.eligible).toBe(true);
    expect(updatedLedger.verificationCount).toBe(1n);
  });

  // -------------------------------------------------------------------------
  // Test 3: Ineligible user — circuit assert must throw
  // -------------------------------------------------------------------------
  it('ineligible user (age 17, threshold 18) is rejected by the circuit', () => {
    const { contract, contractState, privateState } = initContract(17n, THRESHOLD_18);

    const ctx = buildCircuitCtx(contractState, privateState);

    // The circuit assert('age >= threshold') causes the simulator to throw.
    // This mirrors real ZK proof construction failure — the proof simply
    // cannot be built when the assertion does not hold.
    expect(() => contract.circuits.verifyAge(ctx)).toThrow();

    // Ledger state must be UNCHANGED — no state mutation on circuit failure
    const ledgerState = ledger(contractState.data);
    expect(ledgerState.eligible).toBe(false);
    expect(ledgerState.verificationCount).toBe(0n);
  });

  // -------------------------------------------------------------------------
  // Test 4: Zero age — extreme ineligibility
  // -------------------------------------------------------------------------
  it('zero age is rejected by the circuit', () => {
    const { contract, contractState, privateState } = initContract(0n, THRESHOLD_18);

    expect(() =>
      contract.circuits.verifyAge(buildCircuitCtx(contractState, privateState))
    ).toThrow();

    expect(ledger(contractState.data).eligible).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 5: resetVerification circuit works correctly
  // -------------------------------------------------------------------------
  it('resetVerification sets eligible back to false and increments count', () => {
    const { contract, contractState, privateState } = initContract(25n, THRESHOLD_18);

    // First: verify
    const ctx1 = buildCircuitCtx(contractState, privateState);
    const res1 = contract.circuits.verifyAge(ctx1);
    const state1 = res1.context.currentQueryContext.state;
    expect(ledger(state1).eligible).toBe(true);
    expect(ledger(state1).verificationCount).toBe(1n);

    // Then: reset
    const ctx2 = createCircuitContext<AgeVerifyPrivateState>(
      CONTRACT_ADDRESS, DUMMY_COIN_PK, state1, privateState,
    );
    const res2 = contract.circuits.resetVerification(ctx2);
    const state2 = res2.context.currentQueryContext.state;
    expect(ledger(state2).eligible).toBe(false);
    expect(ledger(state2).verificationCount).toBe(2n);
  });

  // -------------------------------------------------------------------------
  // Test 6: Custom threshold — configurable eligibility
  // -------------------------------------------------------------------------
  it('custom threshold (21) rejects age 20 and accepts age 21', () => {
    // Age 20 with threshold 21 — must be rejected
    const under = initContract(20n, 21n);
    expect(() =>
      under.contract.circuits.verifyAge(buildCircuitCtx(under.contractState, under.privateState))
    ).toThrow();
    expect(ledger(under.contractState.data).eligible).toBe(false);

    // Age 21 with threshold 21 — boundary, must pass
    const at = initContract(21n, 21n);
    const res = at.contract.circuits.verifyAge(buildCircuitCtx(at.contractState, at.privateState));
    expect(ledger(res.context.currentQueryContext.state).eligible).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 7: Privacy invariant — ledger must never contain the private age
  // -------------------------------------------------------------------------
  it('ledger state never contains the exact private age (privacy invariant)', () => {
    const secretAge = 27n;
    const { contract, contractState, privateState } = initContract(secretAge, THRESHOLD_18);

    const ctx = buildCircuitCtx(contractState, privateState);
    const result = contract.circuits.verifyAge(ctx);

    const updatedLedger = ledger(result.context.currentQueryContext.state);

    // The ledger type has exactly 3 fields
    const keys = Object.keys(updatedLedger).sort();
    expect(keys).toEqual(['eligible', 'threshold', 'verificationCount'].sort());

    // None of the values equal the secret age
    expect(updatedLedger.eligible).toBe(true);      // boolean — not age
    expect(updatedLedger.threshold).toBe(18n);       // threshold — not age
    expect(updatedLedger.verificationCount).toBe(1n); // count — not age

    // Serialize and check age doesn't appear in output
    const serialized = JSON.stringify(updatedLedger, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(serialized).not.toContain(secretAge.toString());
  });

  // -------------------------------------------------------------------------
  // Test 8: Constructor initialises ledger correctly
  // -------------------------------------------------------------------------
  it('constructor initialises ledger with correct default state', () => {
    const { contractState } = initContract(25n, THRESHOLD_18);

    const initialLedger = ledger(contractState.data);
    expect(initialLedger.threshold).toBe(18n);
    expect(initialLedger.eligible).toBe(false);
    expect(initialLedger.verificationCount).toBe(0n);
  });

  // -------------------------------------------------------------------------
  // Test 9: getStatus and getThreshold pure circuits
  // -------------------------------------------------------------------------
  it('getStatus and getThreshold read-only circuits return correct values', () => {
    const { contract, contractState, privateState } = initContract(25n, THRESHOLD_18);

    // Before verification
    const ctxBefore = buildCircuitCtx(contractState, privateState);
    const statusBefore = contract.circuits.getStatus(ctxBefore);
    expect(statusBefore.result).toBe(false);

    const thresholdResult = contract.circuits.getThreshold(ctxBefore);
    expect(thresholdResult.result).toBe(18n);

    // After verification
    const verifyResult = contract.circuits.verifyAge(buildCircuitCtx(contractState, privateState));
    const ctxAfter = createCircuitContext<AgeVerifyPrivateState>(
      CONTRACT_ADDRESS, DUMMY_COIN_PK,
      verifyResult.context.currentQueryContext.state,
      privateState,
    );
    const statusAfter = contract.circuits.getStatus(ctxAfter);
    expect(statusAfter.result).toBe(true);
  });
});
