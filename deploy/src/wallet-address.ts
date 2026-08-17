/**
 * Show wallet address without deploying.
 * Usage: npm run wallet:address --workspace=deploy
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { showWalletAddress } from './wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

function loadSeed(): string {
  // Check env var first
  if (process.env['MIDNIGHT_DEPLOY_SEED']) return process.env['MIDNIGHT_DEPLOY_SEED'];
  
  // Check multiple possible .env locations
  const possiblePaths = [
    join(process.cwd(), '.env'),           // Current directory (deploy/.env)
    join(process.cwd(), '../.env'),        // Parent directory (Midnight Verify/.env)
    join(process.cwd(), '../../.env'),     // Workspace root
    join(__dirname, '../../../.env'),      // Relative from src directory
  ];
  
  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        if (t.slice(0, eq).trim() === 'MIDNIGHT_DEPLOY_SEED') {
          return t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  
  return '';
}

const seed = loadSeed();
if (!seed) {
  console.error('MIDNIGHT_DEPLOY_SEED not set in .env');
  process.exit(1);
}
await showWalletAddress(seed);
