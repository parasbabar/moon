import React from 'react';
import styles from './PrivacyArchitecture.module.css';

export function PrivacyArchitecture(): React.ReactElement {
  return (
    <section
      className={styles.section}
      aria-labelledby="privacy-arch-heading"
    >
      <header className={styles.sectionHeader}>
        <h2 id="privacy-arch-heading" className={styles.heading}>
          How the Privacy Works
        </h2>
        <p className={styles.subheading}>
          Selective disclosure — exactly as much as required, nothing more.
        </p>
      </header>

      {/* Architecture flow */}
      <div className={styles.archFlow} role="img" aria-label="Privacy architecture flow diagram">
        <ArchStep
          icon="🔒"
          label="Private Age"
          note="Stays on your device"
          variant="private"
        />
        <ArchArrow />
        <ArchStep
          icon="⬡"
          label="Midnight Circuit"
          note="ZK proof: age ≥ 18"
          variant="circuit"
        />
        <ArchArrow />
        <ArchStep
          icon="◑"
          label="Selective Disclosure"
          note="Only the result is shared"
          variant="disclosure"
        />
        <ArchArrow />
        <ArchStep
          icon="✓"
          label="Eligible / Not Eligible"
          note="On-chain result"
          variant="result"
        />
      </div>

      {/* Two column disclosure table */}
      <div className={styles.disclosureTable}>
        <DisclosureColumn
          type="can"
          title="Observer CAN learn"
          icon="👁"
          items={[
            'That a verification interaction occurred',
            'The eligibility threshold (18)',
            'The verification result (eligible / not eligible)',
            'The verification count (number of interactions)',
            'Normal transaction metadata',
          ]}
        />
        <DisclosureColumn
          type="cannot"
          title="Observer CANNOT learn"
          icon="🔒"
          items={[
            'Your exact age',
            'Your date of birth',
            'Any age-related private value',
            'Any information beyond the eligibility result',
          ]}
        />
      </div>
    </section>
  );
}

function ArchStep({
  icon,
  label,
  note,
  variant,
}: {
  icon: string;
  label: string;
  note: string;
  variant: 'private' | 'circuit' | 'disclosure' | 'result';
}): React.ReactElement {
  return (
    <div className={`${styles.archStep} ${styles[`archStep_${variant}`]}`}>
      <span className={styles.archStepIcon} aria-hidden="true">{icon}</span>
      <span className={styles.archStepLabel}>{label}</span>
      <span className={styles.archStepNote}>{note}</span>
    </div>
  );
}

function ArchArrow(): React.ReactElement {
  return (
    <div className={styles.archArrow} aria-hidden="true">
      <span className={styles.archArrowLine} />
      <span className={styles.archArrowHead}>›</span>
    </div>
  );
}

function DisclosureColumn({
  type,
  title,
  icon,
  items,
}: {
  type: 'can' | 'cannot';
  title: string;
  icon: string;
  items: string[];
}): React.ReactElement {
  return (
    <div className={`${styles.disclosureCol} ${styles[`disclosureCol_${type}`]}`}>
      <h3 className={styles.disclosureColTitle}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <ul className={styles.disclosureList}>
        {items.map((item) => (
          <li key={item} className={styles.disclosureListItem}>
            <span className={styles.disclosureListBullet} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
