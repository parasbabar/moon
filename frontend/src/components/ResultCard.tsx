import React from 'react';
import type { VerificationResult } from '@midnight-verify/api';
import styles from './ResultCard.module.css';

interface ResultCardProps {
  result: VerificationResult | null;
  onReset: () => void;
}

export function ResultCard({ result, onReset }: ResultCardProps): React.ReactElement {
  const eligible = result?.eligible ?? false;

  return (
    <section
      className={`${styles.card} ${eligible ? styles.cardEligible : styles.cardIneligible}`}
      aria-labelledby="result-heading"
      aria-live="assertive"
      aria-atomic="true"
    >
      {eligible ? (
        <>
          {/* Success result */}
          <div className={styles.resultHeader}>
            <div className={styles.resultIcon} aria-hidden="true">✓</div>
            <h2 id="result-heading" className={styles.resultTitle}>
              ELIGIBILITY VERIFIED
            </h2>
          </div>

          <p className={styles.resultSubtitle}>
            You meet the required eligibility threshold.
          </p>

          <div className={styles.disclosureGrid}>
            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Requirement</span>
              <span className={styles.disclosureValue}>
                {result?.threshold.toString()}+
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Eligibility</span>
              <span className={`${styles.disclosureValue} ${styles.verifiedBadge}`}>
                VERIFIED
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Exact age</span>
              <span className={`${styles.disclosureValue} ${styles.privateValue}`}>
                <span aria-hidden="true">🔒</span>
                PRIVATE
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Date of birth</span>
              <span className={`${styles.disclosureValue} ${styles.privateValue}`}>
                NOT DISCLOSED
              </span>
            </div>
          </div>

          <div className={styles.privacyNote} role="note">
            <span className={styles.privacyNoteIcon} aria-hidden="true">◑</span>
            <p>
              Only the required fact was disclosed. The underlying private
              value remains private.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Failure result */}
          <div className={styles.resultHeader}>
            <div className={`${styles.resultIcon} ${styles.resultIconFail}`} aria-hidden="true">
              ✕
            </div>
            <h2 id="result-heading" className={`${styles.resultTitle} ${styles.resultTitleFail}`}>
              NOT ELIGIBLE
            </h2>
          </div>

          <p className={styles.resultSubtitle}>
            The private value does not satisfy the required eligibility condition.
          </p>

          <div className={styles.disclosureGrid}>
            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Requirement</span>
              <span className={styles.disclosureValue}>
                {result?.threshold.toString() ?? '18'}+
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Eligibility</span>
              <span className={`${styles.disclosureValue} ${styles.failBadge}`}>
                NOT VERIFIED
              </span>
            </div>
          </div>

          <div className={styles.privacyNote} role="note">
            <span className={styles.privacyNoteIcon} aria-hidden="true">◑</span>
            <p>
              The circuit rejected the proof. No private information was disclosed
              during this interaction.
            </p>
          </div>
        </>
      )}

      {/* Reset button */}
      <button
        className={styles.resetBtn}
        onClick={onReset}
        aria-label="Try again — verify eligibility with a different age"
      >
        Try Again
      </button>
    </section>
  );
}
