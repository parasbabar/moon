import React from 'react';
import type { WalletStatus, WalletInfo } from '@midnight-verify/api';
import styles from './Header.module.css';
import { MoonIcon } from './icons/MoonIcon';

interface HeaderProps {
  walletStatus: WalletStatus;
  walletInfo: WalletInfo | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({
  walletStatus,
  walletInfo,
  onConnect,
  onDisconnect,
}: HeaderProps): React.ReactElement {
  const isConnected = walletStatus === 'connected';
  const isConnecting = walletStatus === 'connecting';

  return (
    <header className={styles.header} role="banner">
      <div className={styles.inner}>
        {/* Brand */}
        <a href="/" className={styles.brand} aria-label="Midnight Verify home">
          <span className={styles.brandIcon} aria-hidden="true">
            <MoonIcon size={22} />
          </span>
          <span className={styles.brandName}>Midnight Verify</span>
        </a>

        {/* Wallet control */}
        <div className={styles.walletArea}>
          {isConnected && walletInfo ? (
            <div className={styles.walletConnected}>
              <span className={styles.walletDot} aria-hidden="true" />
              <span className={styles.walletAddress} title={walletInfo.fullAddress}>
                {walletInfo.displayAddress}
              </span>
              <button
                className={styles.disconnectBtn}
                onClick={onDisconnect}
                aria-label="Disconnect wallet"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className={styles.connectBtn}
              onClick={onConnect}
              disabled={isConnecting}
              aria-busy={isConnecting}
              aria-label={isConnecting ? 'Connecting wallet…' : 'Connect Midnight wallet'}
            >
              {isConnecting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Connecting…
                </>
              ) : (
                'Connect Wallet'
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
