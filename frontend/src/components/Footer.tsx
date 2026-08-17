import React from 'react';
import styles from './Footer.module.css';

export function Footer(): React.ReactElement {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.inner}>
        <p className={styles.copy}>
          <span aria-hidden="true">◑</span>
          Midnight Verify — Built on{' '}
          <a
            href="https://midnight.network"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Midnight Network (opens in new tab)"
          >
            Midnight Network
          </a>
        </p>
        <p className={styles.tagline}>
          Prove eligibility. Reveal nothing else.
        </p>
      </div>
    </footer>
  );
}
