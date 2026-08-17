/**
 * Midnight Verify — Contract Logic Tests
 *
 * Tests exercise the AgeVerify contract using the REAL compiler-generated
 * Contract class from managed/age_verify/contract/index.js (compactc 0.31.0)
 * together with the real @midnight-ntwrk/compact-runtime simulator.
 *
 * Privacy principles validated:
 *   - Private age accessed ONLY through the witness function
 *   - Ledger NEVER stores the exact age
 *   - Only the boolean result (eligible) appears in public state
 *   - Circuit assert failure = ineligible, throws rather than silently passing
 *
 * Run: npm run test:run
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
} from '@midnight-ntwrk/compact-runtime';
import { sampleContractAddress } from '@midnight-ntwrk/onchain-runtime-v3';
import {
  Contract,
  ledger,
} from './managed/age_verify/contract/index.js';
import { createPrivateState, createWitnessProvider } from './private-state.js';
import type { AgeVerifyPrivateState } from './private-state.js';

// ---------------------------------------------------------------------------
// Test helpers — mirrors the real Midnight.js runtime setup
// ---------------------------------------------------------------------------

// Plain hex CoinPublicKey (no 0x prefix) — required by encodeCoinPublicKey
const DUMMY_COIN_PK = '00'.repeat(32);
const CONTRACT_ADDRESS = sampleContractAddress();

/**
 * Initialise a fresh contract with the given age and threshold.
 * Returns the initial ContractState and the private state object.
 */
function initContract(age: bigint, threshold: bigint = 18n) {
  const privateState = createPrivateState(age);
  const witnesses = createWitnessProvider(privateState);
  const contract = new Contract<AgeVerifyPrivateState>(witnesses);

  const constructorCtx = createConstructorContext<AgeVerifyPrivateState>(
    privateState,
    DUMMY_COIN_PK,
  );
  const { currentContractState, currentPrivateState } = contract.initialState(
    constructorCtx,
    threshold,
  );

  return { contract, contractState: currentContractState, privateState: currentPrivateState };
}

/** Build a CircuitContext for a circuit call. */
function buildCtx(
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
// Test Suite 1: Core Circuit Logic
// ---------------------------------------------------------------------------

describe('AgeVerify — Core Circuit Logic', () => {

  // -------------------------------------------------------------------------
  // Test 1: Eligible user — standard case
  // -------------------------------------------------------------------------
  it('eligible user (age 25, threshold 18) is verified', () => {
    const { contract, contractState, privateState } = initContract(25n, 18n);

    const result = contract.circuits.verifyAge(buildCtx(contractState, privateState));
    const updatedLedger = ledger(result.context.currentQueryContext.state);

    expect(updatedLedger.eligible).toBe(true);
    expect(updatedLedger.threshold).toBe(18n);
    expect(updatedLedger.verificationCount).toBe(1n);
  });

  // -------------------------------------------------------------------------
  // Test 2: Boundary condition — exactly at threshold
  // -------------------------------------------------------------------------
  it('boundary condition (age 18 == threshold 18) is verified', () => {
    const { contract, contractState, privateState } = initContract(18n, 18n);

    const result = contract.circuits.verifyAge(buildCtx(contractState, privateState));
    const updatedLedger = ledger(result.context.currentQueryContext.state);

    expect(updatedLedger.eligible).toBe(true);
    expect(updatedLedger.verificationCount).toBe(1n);
  });

  // -------------------------------------------------------------------------
  // Test 3: Ineligible user — circuit assert must throw
  // -------------------------------------------------------------------------
  it('ineligible user (age 17, threshold 18) is rejected by the circuit', () => {
    const { contract, contractState, privateState } = initContract(17n, 18n);

    // The circuit assert throws — mirroring ZK proof rejection
    expect(() =>
      contract.circuits.verifyAge(buildCtx(contractState, privateState)),
    ).toThrow();

    // Ledger must remain in unverified state — no mutation on failure
    const initialLedger = ledger(contractState.data);
    expect(initialLedger.eligible).toBe(false);
    expect(initialLedger.verificationCount).toBe(0n);
  });

  // -------------------------------------------------------------------------
  // Test 4: Zero age — extreme ineligibility
  // -------------------------------------------------------------------------
  it('zero age is rejected', () => {
    const { contract, contractState, privateState } = initContract(0n, 18n);

    expect(() =>
      contract.circuits.verifyAge(buildCtx(contractState, privateState)),
    ).toThrow();

    const initialLedger = ledger(contractState.data);
    expect(initialLedger.eligible).toBe(false);
    expect(initialLedger.verificationCount).toBe(0n);
  });

  // -------------------------------------------------------------------------
  // Test 5: Verification count tracks all circuit interactions correctly
  // -------------------------------------------------------------------------
  it('verification count tracks all circuit interactions correctly', () => {
    const { contract, contractState, privateState } = initContract(30n, 18n);

    // Initial state
    expect(ledger(contractState.data).verificationCount).toBe(0n);

    // First verification
    const r1 = contract.circuits.verifyAge(buildCtx(contractState, privateState));
    const s1 = r1.context.currentQueryContext.state;
    expect(ledger(s1).verificationCount).toBe(1n);
    expect(ledger(s1).eligible).toBe(true);

    // Reset
    const r2 = contract.circuits.resetVerification(buildCtx(
      r1.context.currentQueryContext.state, privateState,
    ));
    const s2 = r2.context.currentQueryContext.state;
    expect(ledger(s2).verificationCount).toBe(2n);
    expect(ledger(s2).eligible).toBe(false);

    // Re-verify
    const r3 = contract.circuits.verifyAge(buildCtx(s2, privateState));
    const s3 = r3.context.currentQueryContext.state;
    expect(ledger(s3).verificationCount).toBe(3n);
    expect(ledger(s3).eligible).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 6: Custom threshold — configurable eligibility condition
  // -------------------------------------------------------------------------
  it('custom threshold (21) correctly rejects age 20 and accepts age 21', () => {
    // Below threshold
    const under = initContract(20n, 21n);
    expect(() =>
      under.contract.circuits.verifyAge(buildCtx(under.contractState, under.privateState)),
    ).toThrow();
    expect(ledger(under.contractState.data).eligible).toBe(false);

    // At threshold boundary
    const at = initContract(21n, 21n);
    const atResult = at.contract.circuits.verifyAge(buildCtx(at.contractState, at.privateState));
    expect(ledger(atResult.context.currentQueryContext.state).eligible).toBe(true);

    // Above threshold
    const above = initContract(25n, 21n);
    const aboveResult = above.contract.circuits.verifyAge(buildCtx(above.contractState, above.privateState));
    expect(ledger(aboveResult.context.currentQueryContext.state).eligible).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 7: Privacy invariant — exact age MUST NOT appear in ledger state
  // -------------------------------------------------------------------------
  it('ledger state never contains the exact private age (privacy invariant)', () => {
    const secretAge = 27n;
    const { contract, contractState, privateState } = initContract(secretAge, 18n);

    const result = contract.circuits.verifyAge(buildCtx(contractState, privateState));
    const updatedLedger = ledger(result.context.currentQueryContext.state);

    // 1. Ledger only has three public fields
    const keys = Object.keys(updatedLedger).sort();
    expect(keys).toEqual(['eligible', 'threshold', 'verificationCount'].sort());

    // 2. Serialised ledger must not contain the secret age
    const json = JSON.stringify(updatedLedger, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(json).not.toContain(secretAge.toString());
    expect(json).not.toContain('27');

    // 3. Field values are what they should be — not the age
    expect(updatedLedger.eligible).toBe(true);
    expect(updatedLedger.threshold).toBe(18n);
    expect(updatedLedger.verificationCount).toBe(1n);
  });

  // -------------------------------------------------------------------------
  // Test 8: Contract initialises with correct default state
  // -------------------------------------------------------------------------
  it('contract initialises with correct default state', () => {
    const { contractState } = initContract(25n, 18n);
    const initialLedger = ledger(contractState.data);

    expect(initialLedger.threshold).toBe(18n);
    expect(initialLedger.eligible).toBe(false);
    expect(initialLedger.verificationCount).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2: Witness Isolation
// ---------------------------------------------------------------------------

describe('AgeVerify — Witness Isolation', () => {
  it('witness function is the only path to access the private age', () => {
    const capturedAges: bigint[] = [];
    const secretAge = 35n;

    // Spy witness — records every age value it sees
    const spyWitness = {
      getAge: (ctx: Parameters<ReturnType<typeof createWitnessProvider>['getAge']>[0]) => {
        const age = ctx.privateState.secretAge;
        capturedAges.push(age);
        return [ctx.privateState, age] as [AgeVerifyPrivateState, bigint];
      },
    };

    const privateState = createPrivateState(secretAge);
    const contract = new Contract<AgeVerifyPrivateState>(spyWitness);
    const constructorCtx = createConstructorContext<AgeVerifyPrivateState>(
      privateState,
      DUMMY_COIN_PK,
    );
    const { currentContractState } = contract.initialState(constructorCtx, 18n);
    const ctx = buildCtx(currentContractState, privateState);
    contract.circuits.verifyAge(ctx);

    // Witness was called exactly once
    expect(capturedAges).toHaveLength(1);
    expect(capturedAges[0]).toBe(secretAge);

    // Age never appears in ledger
    const result = contract.circuits.verifyAge(buildCtx(currentContractState, privateState));
    const updatedLedger = ledger(result.context.currentQueryContext.state);
    const values = [updatedLedger.eligible, updatedLedger.threshold, updatedLedger.verificationCount];
    expect(values).not.toContain(secretAge);
  });
});
