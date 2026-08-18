/**
 * Copy the compiled ZK artifacts (prover/verifier keys + ZKIR) from the
 * contract package into the frontend's public/zk directory so the browser
 * can fetch them at runtime for on-chain proving.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_ARTIFACTS = join(__dirname, '../../contract/src/managed/age_verify');
const PUBLIC_ZK = join(__dirname, '../public/zk');

mkdirSync(join(PUBLIC_ZK, 'keys'), { recursive: true });
mkdirSync(join(PUBLIC_ZK, 'zkir'), { recursive: true });

for (const file of readdirSync(join(CONTRACT_ARTIFACTS, 'keys'))) {
  if (file.endsWith('.prover') || file.endsWith('.verifier')) {
    copyFileSync(join(CONTRACT_ARTIFACTS, 'keys', file), join(PUBLIC_ZK, 'keys', file));
  }
}

for (const file of readdirSync(join(CONTRACT_ARTIFACTS, 'zkir'))) {
  if (file.endsWith('.zkir')) {
    copyFileSync(join(CONTRACT_ARTIFACTS, 'zkir', file), join(PUBLIC_ZK, 'zkir', file));
  }
}

console.log('ZK artifacts copied to frontend/public/zk');