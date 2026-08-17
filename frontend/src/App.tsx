import React from 'react';
import { useAppState } from './hooks/useAppState';
import { Header } from './components/Header';
import { LandingSection } from './components/LandingSection';
import { VerificationCard } from './components/VerificationCard';
import { ResultCard } from './components/ResultCard';
import { Footer } from './components/Footer';
import { PrivacyArchitecture } from './components/PrivacyArchitecture';
import styles from './App.module.css';

export default function App(): React.ReactElement {
  const { state, connectWallet, disconnectWallet, verifyEligibility, resetVerification } =
    useAppState();

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

      <main className={styles.main} id="main-content">
        {/* Landing section — always visible */}
        <LandingSection
          walletStatus={state.walletStatus}
          onConnect={connectWallet}
        />

        {/* Verification card — visible when connected and no result yet */}
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

        {/* Privacy architecture explainer — always visible */}
        <PrivacyArchitecture />
      </main>

      <Footer />
    </div>
  );
}
