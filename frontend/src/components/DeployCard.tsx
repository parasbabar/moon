import React, { useCallback, useState } from 'react';
import type { AppState, DeploymentInfo, VerificationStatus } from '@midnight-verify/api';
import { isContractAddress } from '@midnight-verify/api';
import { useAppState } from '../hooks/useAppState';
import styles from './DeployCard.module.css';

interface DeployCardProps {
  deploymentInfo: DeploymentInfo | null;
  verificationStatus: VerificationStatus;
  errorMessage: string | null;
  onDeploy: () => Promise<unknown>;
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
  idle:                   'Deploying contract.',
  'generating-proof':     'Generating deployment proof.',
  'proof-generated':      'Proof generated',
  'waiting-for-wallet-approval': 'Waiting for wallet approval.',
  'submitting-transaction': 'Submitting deployment transaction.',
  submitting:             'Submitting deployment transaction.',
  'awaiting-confirmation':'Awaiting on-chain confirmation.',
  eligible:               'Deployed',
  'not-eligible':         'Deployment failed',
  error:                  'Deployment failed',
  rejected:               'Deployment failed',
};

export function DeployCard({
  deploymentInfo,
  verificationStatus,
  errorMessage,
  onDeploy,
}: DeployCardProps): React.ReactElement {
  const { deploymentStatus } = useAppState();
  const [deploying, setDeploying] = useState(false);

  const isDeploying =
    deploying &&
    (deploymentStatus === 'in-progress');

  const isReal =
    deploymentInfo !== null && isContractAddress(deploymentInfo.contractAddress);

  const deployButtonDisabled = isReal || deploymentStatus === 'in-progress';

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    try {
      await onDeploy();
    } catch {
      // Error state is handled by the API layer
    } finally {
      setDeploying(false);
    }
  }, [onDeploy]);

  return (
    <section className={styles.card} aria-labelledby="deploy-heading">
      <div className={styles.cardHeader}>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          CONTRACT DEPLOYMENT
        </span>
      </div>

      {isReal ? (
        <div className={styles.deployed}>
          <div className={styles.infoRow}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Network</span>
              <span className={styles.infoValueNetwork}>{deploymentInfo!.network}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Threshold</span>
              <span className={styles.infoValue}>{deploymentInfo!.threshold.toString()}+</span>
            </div>
          </div>

          <div className={styles.addressBlock}>
            <span className={styles.addressLabel}>Contract address</span>
            <code className={styles.address}>{deploymentInfo!.contractAddress}</code>
            <p className={styles.note}>
              This contract is live on-chain. Verify eligibility below — the result is a
              public ZK proof, your age stays private.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.undeployed}>
          <p className={styles.intro}>
            No AgeVerify contract is deployed yet. Deploy one to the Midnight{' '}
            <strong>preprod</strong> network through your wallet. This submits a real
            on-chain transaction (DUST fees are covered automatically).
          </p>

          <button
            type="button"
            className={styles.deployBtn}
            onClick={handleDeploy}
            disabled={isDeploying}
            aria-busy={isDeploying}
          >
            {isDeploying ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                {deploymentStatus === 'in-progress' ? 'Deploying contract…' : deploymentStatus === 'confirmed' ? 'Contract deployed — ready to verify' : 'Deploying contract…'}
              </>
            ) : (
              <>
                <span aria-hidden="true">⬢</span>
                Deploy Contract
              </>
            )}
          </button>

          {errorMessage && (
            <div className={styles.apiError} role="alert">
              <span className={styles.errorIcon} aria-hidden="true">⚠</span>
              {errorMessage}
            </div>
          )}

          <p className={styles.note}>
            Approve the transaction in your wallet popup. The deployed address will be
            saved on this device and used for all future verifications.
          </p>
        </div>
      )}
    </section>
  );
}