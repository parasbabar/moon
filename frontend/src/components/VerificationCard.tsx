import React, { useState, useCallback } from 'react';
import type { VerificationStatus, VerificationResult } from '@midnight-verify/api';
import styles from './VerificationCard.module.css';

interface VerificationCardProps {
  verificationStatus: VerificationStatus;
  errorMessage: string | null;
  onVerify: (age: bigint, threshold?: bigint) => Promise<VerificationResult>;
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  idle:                   'Verify Eligibility',
  'generating-proof':     'Generating proof…',
  'proof-generated':      'Proof generated',
  'waiting-for-wallet-approval': 'Waiting for wallet approval…',
  submitting:             'Submitting transaction…',
  'submitting-transaction': 'Submitting transaction…',
  'awaiting-confirmation':'Awaiting confirmation…',
  eligible:               'Verified',
  'not-eligible':         'Not Eligible',
  rejected:               'Verification cancelled',
  error:                  'Verify Eligibility',
};

const STEP_LABELS: Record<VerificationStatus, string> = {
  idle:                   '',
  'generating-proof':     'Executing circuit - your age remains private',
  'proof-generated':     'Proof generated',
  'waiting-for-wallet-approval': 'Waiting for wallet approval…',
  submitting:             'Submitting ZK proof to the contract…',
  'submitting-transaction': 'Submitting transaction…',
  'awaiting-confirmation':'Waiting for on-chain confirmation…',
  eligible:               '',
  'not-eligible':         '',
  rejected:               '',
  error:                  '',
};

const THRESHOLD = 18n;

export function VerificationCard({
  verificationStatus,
  errorMessage,
  onVerify,
}: VerificationCardProps): React.ReactElement {
  const [ageInput, setAgeInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const isLoading =
    verificationStatus === 'generating-proof' ||
    verificationStatus === 'submitting' ||
    verificationStatus === 'awaiting-confirmation';

  const handleAgeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Only allow digits
      if (val === '' || /^\d{1,3}$/.test(val)) {
        setAgeInput(val);
        setInputError(null);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate input
      if (!ageInput.trim()) {
        setInputError('Please enter your age.');
        return;
      }

      const age = parseInt(ageInput, 10);
      if (isNaN(age) || age < 0 || age > 150) {
        setInputError('Please enter a valid age between 0 and 150.');
        return;
      }

      setInputError(null);

      try {
        await onVerify(BigInt(age), THRESHOLD);
      } catch (err) {
        // Error state is handled by the API layer
      }
    },
    [ageInput, onVerify],
  );

  const stepLabel = STEP_LABELS[verificationStatus];

  return (
    <section
      className={styles.card}
      aria-labelledby="verify-heading"
      aria-live="polite"
    >
      {/* Card header */}
      <div className={styles.cardHeader}>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          VERIFY ELIGIBILITY
        </span>
      </div>

      {/* Requirement row */}
      <div className={styles.infoRow}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Requirement</span>
          <span className={styles.infoValue}>18+</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Private information</span>
          <span className={styles.infoValuePrivate}>
            <span className={styles.lockGlyph} aria-hidden="true">🔒</span>
            Your age
          </span>
        </div>
      </div>

      {/* Form */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.fieldGroup}>
          <label htmlFor="age-input" className={styles.fieldLabel}>
            Private age input
            <span className={styles.fieldPrivacyHint}>
              — stays on your device, never stored on-chain
            </span>
          </label>

          <div className={styles.inputWrap}>
            <input
              id="age-input"
              type="number"
              className={styles.input}
              value={ageInput}
              onChange={handleAgeChange}
              min={0}
              max={150}
              step={1}
              placeholder="Enter your age"
              disabled={isLoading}
              aria-describedby={
                inputError ? 'age-input-error' :
                errorMessage ? 'api-error' :
                'age-privacy-note'
              }
              aria-invalid={!!inputError}
              autoComplete="off"
              inputMode="numeric"
            />
            <span className={styles.inputLock} aria-hidden="true">🔒</span>
          </div>

          {inputError && (
            <p id="age-input-error" className={styles.fieldError} role="alert">
              {inputError}
            </p>
          )}

          <p id="age-privacy-note" className={styles.fieldNote}>
            Your age is used only inside the ZK circuit. It is never disclosed on-chain.
          </p>
        </div>

        {/* API error */}
        {errorMessage && !inputError && (
          <div id="api-error" className={styles.apiError} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">⚠</span>
            {errorMessage}
          </div>
        )}

        {/* Loading step indicator */}
        {isLoading && stepLabel && (
          <div className={styles.stepIndicator} aria-live="polite" aria-atomic="true">
            <span className={styles.stepSpinner} aria-hidden="true" />
            <span>{stepLabel}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isLoading || !ageInput}
          aria-busy={isLoading}
          aria-label={isLoading ? STATUS_LABELS[verificationStatus] : 'Verify Eligibility'}
        >
          {isLoading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              {STATUS_LABELS[verificationStatus]}
            </>
          ) : (
            <>
              <span aria-hidden="true">◈</span>
              Verify Eligibility
            </>
          )}
        </button>
      </form>

      {/* Privacy flow diagram */}
      <div className={styles.privacyFlow} aria-label="Privacy flow: your age goes into the circuit, only the result comes out">
        <div className={styles.flowStep}>
          <span className={styles.flowIcon}>🔒</span>
          <span className={styles.flowText}>Private age</span>
        </div>
        <span className={styles.flowArrow} aria-hidden="true">→</span>
        <div className={styles.flowStep}>
          <span className={styles.flowIcon}>⬡</span>
          <span className={styles.flowText}>ZK Circuit</span>
        </div>
        <span className={styles.flowArrow} aria-hidden="true">→</span>
        <div className={styles.flowStep}>
          <span className={styles.flowIcon}>✓</span>
          <span className={styles.flowText}>Eligible / Not Eligible</span>
        </div>
      </div>
    </section>
  );
}
