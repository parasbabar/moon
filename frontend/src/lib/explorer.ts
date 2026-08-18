/**
 * Midnight Verify — Explorer URL helper
 *
 * Builds a link to the Midnight Preprod block explorer for a given
 * transaction id. The base URL can be overridden at build time via
 * VITE_EXPLORER_URL (defaults to the official Night Scan Preprod explorer).
 */

const EXPLORER_BASE =
  (import.meta.env?.['VITE_EXPLORER_URL'] as string | undefined) ??
  'https://explorer.preprod.midnight.network';

/**
 * Build a transaction explorer URL, or null when the hash is missing.
 */
export function txExplorerUrl(txHash: string | null | undefined): string | null {
  if (!txHash) return null;
  return `${EXPLORER_BASE.replace(/\/$/, '')}/transaction/${txHash}`;
}

/**
 * Copy a value to the clipboard, falling back to legacy execCommand.
 * Returns whether the copy succeeded.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}