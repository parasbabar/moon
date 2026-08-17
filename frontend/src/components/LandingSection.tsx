import React from 'react';
import type { WalletStatus } from '@midnight-verify/api';
import styles from './LandingSection.module.css';

interface LandingSectionProps {
  walletStatus: WalletStatus;
  onConnect: () => void;
}

export function LandingSection({
  walletStatus,
  onConnect,
}: LandingSectionProps): React.ReactElement {
  const isConnected = walletStatus === 'connected';
  const isConnecting = walletStatus === 'connecting';

  return (
    <section className={styles.section} aria-labelledby="landing-heading">
      {/* Moon visual — the central brand element */}
      <div className={styles.moonWrap} aria-hidden="true">
        <div className={styles.moonRing} />
        <div className={styles.moon}>
          {/* Left half = shadow / private */}
          <div className={styles.moonHalfDark} />
          {/* Right half = light / disclosed */}
          <div className={styles.moonHalfLight} />
        </div>
        <div className={styles.moonGlow} />
      </div>

      {/* Wordmark */}
      <div className={styles.wordmark}>
        <p className={styles.wordmarkLabel}>MIDNIGHT VERIFY</p>
        <h1 id="landing-heading" className={styles.tagline}>
          Prove eligibility.<br />
          <span className={styles.taglineAccent}>Reveal nothing else.</span>
        </h1>
        <p className={styles.description}>
          Verify that you meet an eligibility requirement without revealing
          the private value behind your proof.
        </p>
      </div>

      {/* Threshold badge */}
      <div className={styles.thresholdBadge} aria-label="Eligibility threshold: 18 and over">
        <span className={styles.thresholdLabel}>Eligibility threshold</span>
        <span className={styles.thresholdValue}>18+</span>
      </div>

      {/* Connect CTA — only shown when not connected */}
      {!isConnected && (
        <button
          className={styles.connectCta}
          onClick={onConnect}
          disabled={isConnecting}
          aria-busy={isConnecting}
          aria-label={isConnecting ? 'Connecting wallet…' : 'Connect your Midnight wallet to begin'}
        >
          {isConnecting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Connecting wallet…
            </>
          ) : (
            <>
              <span className={styles.connectIcon} aria-hidden="true">◎</span>
              Connect Wallet
            </>
          )}
        </button>
      )}

      {isConnected && (
        <div className={styles.connectedNotice} role="status" aria-live="polite">
          <span className={styles.connectedDot} aria-hidden="true" />
          Wallet connected — enter your private age below to verify eligibility
        </div>
      )}

      {/* Privacy statement */}
      <p className={styles.privacyStatement}>
        <span className={styles.lockIcon} aria-hidden="true">🔒</span>
        Your private value is used to generate a proof.
        Only the required eligibility claim is disclosed.
      </p>
    </section>
  );
}
