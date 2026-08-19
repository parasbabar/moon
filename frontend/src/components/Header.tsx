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

const NIGHT_DECIMALS = 6;
const DUST_DECIMALS  = 15;

function formatBalance(balance: bigint | null, decimals: number): string {
  if (balance === null) return '—';
  const scale = 10n ** BigInt(decimals);
  const whole = balance / scale;
  const frac  = balance % scale;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole.toLocaleString('en-US')}.${fracStr}`;
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
              {walletInfo.nightBalance !== null && (
                <span className={styles.walletBalance} title="Unshielded NIGHT balance">
                  ⬡ {formatBalance(walletInfo.nightBalance, NIGHT_DECIMALS)} NIGHT
                </span>
              )}
              {walletInfo.dustBalance !== null && (
                <span
                  className={styles.walletBalance}
                  title={
                    walletInfo.dustCap !== null
                      ? `DUST balance (cap ${formatBalance(walletInfo.dustCap, DUST_DECIMALS)})`
                      : 'DUST balance'
                  }
                >
                  ✦ {formatBalance(walletInfo.dustBalance, DUST_DECIMALS)} DUST
                </span>
              )}
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
