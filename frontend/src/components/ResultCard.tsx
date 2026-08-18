import React, { useState } from 'react';
import type { VerificationResult } from '@midnight-verify/api';
import { txExplorerUrl, copyToClipboard } from '../lib/explorer';
import styles from './ResultCard.module.css';

interface ResultCardProps {
  result: VerificationResult | null;
  onReset: () => void;
}

export function ResultCard({ result, onReset }: ResultCardProps): React.ReactElement {
  const eligible = result?.eligible ?? false;
  const [copied, setCopied] = useState(false);

  const transactionHash = result?.transactionHash ?? null;
  const explorerUrl = txExplorerUrl(transactionHash);

  const handleCopy = async (): Promise<void> => {
    if (!transactionHash) return;
    const ok = await copyToClipboard(transactionHash);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const trustNote = eligible
    ? 'This proof demonstrates that the supplied private value satisfies the 18+ threshold. It does not establish your real-world age because the input is self-attested.'
    : 'This proof does not establish that the private value meets the 18+ threshold. The input is self-attested.';

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
              AGE THRESHOLD PROVEN
            </h2>
          </div>

          <p className={styles.resultSubtitle}>
            Your private supplied value satisfied the 18+ requirement.
          </p>

          <div className={styles.disclosureGrid}>
            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Requirement</span>
              <span className={styles.disclosureValue}>
                {result?.threshold.toString()}+
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Result</span>
              <span className={`${styles.disclosureValue} ${styles.verifiedBadge}`}>
                THRESHOLD SATISFIED
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Exact value</span>
              <span className={`${styles.disclosureValue} ${styles.privateValue}`}>
                <span aria-hidden="true">🔒</span>
                PRIVATE
              </span>
            </div>

            <div className={styles.disclosureItem}>
              <span className={styles.disclosureLabel}>Trust source</span>
              <span className={`${styles.disclosureValue} ${styles.privateValue}`}>
                <span aria-hidden="true">📝</span>
                SELF-ATTESTED DEMO
              </span>
            </div>
          </div>

          <div className={styles.privacyNote} role="note">
            <span className={styles.privacyNoteIcon} aria-hidden="true">◑</span>
            <p>
              Only the required fact was disclosed. The underlying private
              value remains private. {trustNote}
            </p>
          </div>

          {transactionHash && (
            <div className={styles.txBlock}>
              <div className={styles.txBlockHeader}>
                <span className={styles.txBlockLabel}>On-chain verification</span>
                <span className={styles.txBlockBadge}>Confirmed</span>
              </div>
              <div className={styles.txHashRow}>
                <span className={styles.txHashValue}>{transactionHash}</span>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {explorerUrl && (
                <a
                  className={styles.txLinkBtn}
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on explorer
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Failure result */}
          <div className={styles.resultHeader}>
            <div className={`${styles.resultIcon} ${styles.resultIconFail}`} aria-hidden="true">
              ✕
            </div>
            <h2 id="result-heading" className={`${styles.resultTitle} ${styles.resultTitleFail}`}>
              THRESHOLD NOT PROVEN
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
              <span className={styles.disclosureLabel}>Result</span>
              <span className={`${styles.disclosureValue} ${styles.failBadge}`}>
                THRESHOLD NOT SATISFIED
              </span>
            </div>
          </div>

          <div className={styles.privacyNote} role="note">
            <span className={styles.privacyNoteIcon} aria-hidden="true">◑</span>
            <p>
              The circuit rejected the proof. No private information was disclosed
              during this interaction. {trustNote}
            </p>
          </div>

          {transactionHash && (
            <div className={styles.txBlock}>
              <div className={styles.txBlockHeader}>
                <span className={styles.txBlockLabel}>On-chain verification</span>
                <span className={styles.txBlockBadge}>Confirmed</span>
              </div>
              <div className={styles.txHashRow}>
                <span className={styles.txHashValue}>{transactionHash}</span>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {explorerUrl && (
                <a
                  className={styles.txLinkBtn}
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on explorer
                </a>
              )}
            </div>
          )}
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
