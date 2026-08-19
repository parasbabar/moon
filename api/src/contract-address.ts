/**
 * Midnight Verify — contract address validation
 *
 * A deployed Midnight contract address is identified by its prefix:
 *   - legacy format: `ct_…`
 *   - current Midnight address format: `mn_addr_<network>…`
 *     (the live Preprod deployment uses `mn_addr_preprod…`)
 *
 * This is purely a shape check so a real configured/persisted address is
 * recognised and flows through to the on-chain verification path. It never
 * fabricates, converts, or simulates an address.
 */
export function isContractAddress(value: string): boolean {
  return value.startsWith('ct_') || value.startsWith('mn_addr_');
}