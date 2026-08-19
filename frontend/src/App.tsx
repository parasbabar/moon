import React from 'react';
import { useAppState } from './hooks/useAppState';
import { Header } from './components/Header';
import { LandingSection } from './components/LandingSection';
import { VerificationCard } from './components/VerificationCard';
import { ResultCard } from './components/ResultCard';
import { DeployCard } from './components/DeployCard';
import { Footer } from './components/Footer';
import { PrivacyArchitecture } from './components/PrivacyArchitecture';
import { txExplorerUrl } from './lib/explorer';
import styles from './App.module.css';

export default function App(): React.ReactElement {
  const {
    state,
    connectWallet,
    disconnectWallet,
    verifyEligibility,
    resetVerification,
    deployContract,
    deploymentStatus,
    deploymentTxHash,
  } = useAppState();

  const isConnected = state.walletStatus === 'connected';
  const hasResult =
    state.verificationStatus === 'eligible' ||
    state.verificationStatus === 'not-eligible';

  return (
    <div className={styles.app}>
      {/* Background ambient effect */}
      <div className={styles.ambientBg} aria-hidden="true">
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
      </div>

      <Header
        walletStatus={state.walletStatus}
        walletInfo={state.walletInfo}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
      />

      <div className={styles.deploymentBar} role="status" aria-live="polite">
        <span className={styles.statusDot} aria-hidden="true" />
        <span className={styles.statusLabel}>
          {deploymentStatus === 'confirmed'
            ? 'Contract deployed — ready to verify'
            : deploymentStatus === 'in-progress'
              ? 'Deployment in progress'
              : deploymentStatus === 'failed'
                ? 'Deployment failed'
                : 'Not deployed'}
        </span>
        {deploymentTxHash && (
          <a
            className={styles.txLink}
            href={txExplorerUrl(deploymentTxHash) ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View deployment transaction on explorer"
          >
            View transaction
          </a>
        )}
      </div>

      <main className={styles.main} id="main-content">
        {/* Landing section — always visible */}
        <LandingSection
          walletStatus={state.walletStatus}
          onConnect={connectWallet}
        />

        {/* Contract Deployment card — shown for a real connected wallet.
            Stays visible after deployment to show the live contract address
            and network. */}
        {isConnected && (
          <DeployCard
            deploymentInfo={state.deploymentInfo}
            verificationStatus={state.verificationStatus}
            errorMessage={state.errorMessage}
            onDeploy={() => deployContract()}
          />
        )}

        {/* Verify Eligibility card — the original age-based ZK verification,
            shown when connected and no result yet */}
        {isConnected && !hasResult && (
          <VerificationCard
            verificationStatus={state.verificationStatus}
            errorMessage={state.errorMessage}
            onVerify={verifyEligibility}
          />
        )}

        {/* Result card — visible after verification */}
        {isConnected && hasResult && (
          <ResultCard
            result={state.verificationResult}
            onReset={resetVerification}
          />
        )}

        {/* Trust mode indicator — always visible when connected */}
        {isConnected && (
          <div className={styles.trustModeBar} role="status" aria-live="polite">
            <span className={styles.trustModeDot} aria-hidden="true" />
            <span className={styles.trustModeLabel}>Trust mode: Self-attested demo</span>
            <span className={styles.trustModeNote}>
              ZK proves the supplied value meets the threshold; it does not establish real-world age.
            </span>
          </div>
        )}

        {/* Privacy architecture explainer — always visible */}
        <PrivacyArchitecture />
      </main>

      <Footer />
    </div>
  );
}