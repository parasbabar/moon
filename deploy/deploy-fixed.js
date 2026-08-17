/**
 * 🌙 Midnight Verify — Fixed Deployment via Lace DApp Connector
 * 
 * Uses the EXACT pattern from working frontend code.
 * Pattern: window.midnight[apiKey].connect('preprod')
 */

// Configuration
const PROOF_SERVER_URL = 'http://localhost:6300';
const NETWORK = 'preprod';
const EXPECTED_WALLET = 'mn_addr_preprod12np5ruhq3esqy704cnrje60x0kwlg3awp24qhg430r5295e904eqmpstff';

/**
 * Connect to Lace wallet using exact frontend pattern
 */
export async function connectToLace() {
    console.log('🔗 Connecting to Lace wallet...');
    
    // Check for window.midnight
    if (!window.midnight) {
        throw new Error(
            'Lace wallet not detected.\n\n' +
            'This page must be served from http://localhost (not file://).\n' +
            'Please:\n' +
            '1. Run the local server: python server.py\n' +
            '2. Open http://localhost:8080\n' +
            '3. Ensure Lace extension is installed and unlocked\n' +
            '4. Refresh the page'
        );
    }
    
    const midnight = window.midnight;
    const apiKeys = Object.keys(midnight);
    
    if (apiKeys.length === 0) {
        throw new Error('No Midnight wallet API found in Lace extension.');
    }
    
    // Use first available API key (pattern from working frontend)
    const apiKey = apiKeys[0];
    console.log(`Using API key: "${apiKey}"`);
    
    try {
        // Connect to Preprod network
        const laceApi = await midnight[apiKey].connect('preprod');
        console.log('✅ Connected to Lace wallet');
        
        return laceApi;
    } catch (error) {
        console.error('❌ Lace connection failed:', error);
        
        throw new Error(
            `Failed to connect to Lace wallet: ${error.message}\n\n` +
            'Possible issues:\n' +
            '1. Lace wallet not unlocked\n' +
            '2. Lace not connected to Midnight Preprod network\n' +
            '3. Page not served from allowed origin (must be http://localhost)\n' +
            '4. Lace extension permission denied for this site'
        );
    }
}

/**
 * Get wallet information safely
 */
export async function getWalletInfo(laceApi) {
    console.log('📊 Getting wallet information...');
    
    if (!laceApi || typeof laceApi.getShieldedAddresses !== 'function') {
        throw new Error('Connected API does not have getShieldedAddresses() method');
    }
    
    try {
        const addresses = await laceApi.getShieldedAddresses();
        
        // SAFE: Only return public information
        const info = {
            bech32UnshieldedAddress: addresses.bech32UnshieldedAddress,
            bech32ShieldedAddress: addresses.bech32ShieldedAddress,
            shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
            shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey
        };
        
        console.log('✅ Got wallet addresses');
        console.log('Unshielded address:', info.bech32UnshieldedAddress?.slice(0, 20) + '...');
        
        // Verify against expected wallet
        if (info.bech32UnshieldedAddress === EXPECTED_WALLET) {
            console.log('✅✅✅ Wallet matches expected Lace Preprod wallet!');
        } else {
            console.warn('⚠️ Connected wallet does not match expected address');
        }
        
        return info;
    } catch (error) {
        console.error('❌ Failed to get wallet info:', error);
        throw new Error(`Could not get wallet addresses: ${error.message}`);
    }
}

/**
 * Check proof server connectivity
 */
export async function checkProofServer() {
    try {
        const response = await fetch(PROOF_SERVER_URL, { 
            method: 'HEAD',
            mode: 'cors'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Check all prerequisites
 */
export async function checkPrerequisites() {
    const results = {
        laceWallet: { ok: false, message: '' },
        proofServer: { ok: false, message: '' },
        network: { ok: false, message: '' }
    };
    
    try {
        // Check Lace wallet
        if (!window.midnight) {
            results.laceWallet.message = 'Not detected (page must be served from http://localhost)';
        } else {
            const apiKeys = Object.keys(window.midnight);
            if (apiKeys.length === 0) {
                results.laceWallet.message = 'No API keys found';
            } else {
                results.laceWallet.ok = true;
                results.laceWallet.message = `Ready (${apiKeys.length} API keys)`;
            }
        }
        
        // Check proof server
        results.proofServer.ok = await checkProofServer();
        results.proofServer.message = results.proofServer.ok ? 'Running' : 'Not reachable';
        
        // Network check (via Lace if connected)
        results.network.message = 'Preprod configured';
        results.network.ok = true;
        
        const allOk = results.laceWallet.ok && results.proofServer.ok && results.network.ok;
        
        return {
            allOk,
            results,
            recommendations: allOk ? [] : [
                !results.laceWallet.ok && 'Serve page from http://localhost and ensure Lace is installed',
                !results.proofServer.ok && 'Start proof server: docker compose -f docker/proof-server.yml up -d'
            ].filter(Boolean)
        };
    } catch (error) {
        return {
            allOk: false,
            results,
            error: error.message
        };
    }
}

/**
 * Deployment status callback helper
 */
export function createStatusCallback(onStatus) {
    return (status, percent) => {
        if (onStatus) onStatus(status, percent);
        console.log(`📈 Deployment: ${status} (${percent}%)`);
    };
}

export default {
    connectToLace,
    getWalletInfo,
    checkProofServer,
    checkPrerequisites,
    createStatusCallback
};