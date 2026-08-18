/**
 * 🌙 Midnight Verify — REAL Contract Deployment via Midnight DApp Connector
 * 
 * This deploys the REAL AgeVerify contract to Preprod using Midnight wallet (Lace or I AM Wallet).
 * No seed exposure - uses Midnight DApp Connector API exclusively.
 */

import { Contract } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractArtifact } from '@midnight-ntwrk/midnight-js-contracts';
import { proofServer } from '@midnight-ntwrk/midnight-js-contracts';

// Import the compiled contract
import { Contract as AgeVerifyContract } from '../contract/src/managed/age_verify/contract/index.js';

// Configuration
const PROOF_SERVER_URL = 'http://localhost:6300';
const INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const NETWORK = 'preprod';

/**
 * Deploy REAL contract via Midnight wallet (Lace or I AM Wallet)
 */
export async function deployRealContract({ threshold = 18n, onStatus = null } = {}) {
    console.log('🚀 Starting REAL contract deployment to Midnight Preprod...');
    
    // Step 1: Verify Midnight wallet is available
    onStatus?.('Checking Midnight wallet', 5);
    if (!window.midnight) {
        throw new Error(
            'Midnight wallet not detected.\n\n' +
            'Please ensure:\n' +
            '1. Midnight wallet extension (Lace or I AM Wallet) is installed\n' +
            '2. Wallet is unlocked\n' +
            '3. Wallet is connected to Midnight Preprod network\n' +
            '4. Refresh this page after unlocking'
        );
    }
    
    try {
        // Step 2: Connect to Lace wallet (with timeout)
        onStatus?.('Connecting to Lace wallet', 10);
        const apiKeys = Object.keys(window.midnight);
        if (apiKeys.length === 0) {
            throw new Error('No Midnight wallet API found.');
        }
        
        const apiKey = apiKeys[0];
        
        // Add timeout to prevent hanging
        const connectPromise = window.midnight[apiKey].connect('preprod');
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout after 15000ms')), 15000);
        });
        
        const walletApi = await Promise.race([connectPromise, timeoutPromise]);
        
        // Step 3: Get wallet addresses and verify
        onStatus?.('Getting wallet information', 15);
        const walletInfo = await walletApi.getShieldedAddresses();
        const coinPk = walletInfo.shieldedCoinPublicKey;
        const bech32Address = walletInfo.bech32UnshieldedAddress;
        
        console.log('Wallet connected:', {
            coinPk: coinPk.slice(0, 16) + '...',
            bech32Address,
            network: 'preprod'
        });
        
        // Verify this is the correct funded wallet
        const expectedAddress = 'mn_addr_preprod12np5ruhq3esqy704cnrje60x0kwlg3awp24qhg430r5295e904eqmpstff';
        if (bech32Address !== expectedAddress) {
            console.warn(`⚠️ Wallet address does not match expected. Continuing with connected wallet...`);
        }
        
        // Step 4: Verify proof server is reachable
        onStatus?.('Checking proof server', 20);
        try {
            const proofResponse = await fetch(PROOF_SERVER_URL, { method: 'HEAD' });
            if (!proofResponse.ok) {
                throw new Error(`Proof server returned ${proofResponse.status}`);
            }
        } catch (error) {
            throw new Error(
                `Proof server not reachable at ${PROOF_SERVER_URL}.\n\n` +
                'Please ensure:\n' +
                '1. Docker Desktop is running\n' +
                '2. Proof server is started: docker compose -f docker/proof-server.yml up -d\n' +
                '3. Wait 60 seconds for server to initialize'
            );
        }
        
        // Step 5: Load contract artifact
        onStatus?.('Loading contract artifact', 25);
        const contractArtifact = ContractArtifact.fromCompiledContract(AgeVerifyContract);
        
        // Step 6: Create contract instance
        onStatus?.('Creating contract instance', 30);
        const contract = new Contract(contractArtifact, {
            network: NETWORK,
            proofServer: PROOF_SERVER_URL
        });
        
        // Step 7: Prepare deployment transaction
        onStatus?.('Preparing deployment transaction', 40);
        
        // Get current block number
        const blockNumber = await contract.getCurrentBlockNumber();
        const expireBlockNumber = blockNumber + 1000; // Expire in 1000 blocks
        
        const initArgs = {
            threshold: threshold
        };
        
        // Step 8: Generate ZK proof for deployment
        onStatus?.('Generating ZK proof (30-90 seconds)', 50);
        
        console.log('Generating deployment proof...');
        const deploymentTx = await contract.deploy({
            initArgs,
            deployerAddress: coinPk,
            expireBlockNumber
        });
        
        // Get transaction bytes
        const txBytes = deploymentTx.toBytes();
        console.log('Transaction bytes generated:', txBytes.length, 'bytes');
        
        // Step 9: Sign with wallet
        onStatus?.('Signing transaction with wallet', 60);
        const signature = await walletApi.signTransaction(txBytes);
        console.log('Transaction signed by Midnight wallet');
        
        // Step 10: Submit to network
        onStatus?.('Submitting to Midnight Preprod', 70);
        const txHash = await contract.submitSignedTransaction(signature);
        console.log('Transaction submitted with hash:', txHash);
        
        // Step 11: Wait for confirmation
        onStatus?.('Waiting for confirmation (2-5 minutes)', 80);
        
        let confirmed = false;
        let confirmationCount = 0;
        const maxRetries = 120; // ~10 minutes
        const retryDelay = 5000; // 5 seconds
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const status = await contract.getTransactionStatus(txHash);
                
                if (status === 'confirmed') {
                    confirmed = true;
                    confirmationCount++;
                    
                    if (confirmationCount >= 2) {
                        break;
                    }
                } else if (status === 'failed') {
                    throw new Error('Transaction failed to confirm on chain');
                }
            } catch (error) {
                console.log('Waiting for confirmation... attempt', i + 1, '/', maxRetries);
            }
            
            const progress = 80 + Math.floor((i / maxRetries) * 15);
            onStatus?.(`Waiting for confirmation (${i + 1}/${maxRetries})`, progress);
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        if (!confirmed) {
            throw new Error('Transaction confirmation timeout. Check network status.');
        }
        
        // Step 12: Get deployed contract address
        onStatus?.('Retrieving contract address', 95);
        const deployedContract = await contract.getInstanceAt(txHash);
        const contractAddress = deployedContract.address;
        
        console.log('✅ Contract deployed successfully!');
        console.log('Contract address:', contractAddress);
        console.log('Network:', NETWORK);
        console.log('Threshold:', Number(threshold));
        console.log('Transaction hash:', txHash);
        
        // Step 13: Verify contract via indexer
        onStatus?.('Verifying contract via indexer', 97);
        const contractInfo = await verifyContractViaIndexer(contractAddress);
        
        onStatus?.('Deployment complete!', 100);
        
        return {
            success: true,
            contractAddress,
            transactionHash: txHash,
            network: NETWORK,
            threshold: Number(threshold),
            walletAddress: bech32Address,
            timestamp: new Date().toISOString(),
            contractInfo,
            note: '✅ REAL contract deployed successfully to Midnight Preprod!'
        };
        
    } catch (error) {
        console.error('❌ REAL deployment failed:', error);
        
        // Handle specific error cases
        if (error.message.includes('DUST') || error.message.includes('dust')) {
            throw new Error(
                'DUST required for transaction.\n\n' +
                'Your Midnight wallet needs tDUST for transaction balancing.\n\n' +
                'In your wallet:\n' +
                '1. Open the DUST section\n' +
                '2. Generate tDUST for Preprod network\n' +
                '3. Try deployment again\n\n' +
                'Note: Wallet automatically handles DUST during transaction submission.'
            );
        }
        
        if (error.message.includes('insufficient balance')) {
            throw new Error(
                'Insufficient tNIGHT balance for deployment fee.\n\n' +
                'Your wallet has 5,000 tNIGHT but may need additional for:\n' +
                '• Deployment transaction fee\n' +
                '• DUST generation\n' +
                '• Network fees\n\n' +
                'Ensure your wallet has enough tNIGHT for deployment.'
            );
        }
        
        if (error.message.includes('proof server')) {
            throw new Error(
                'Proof server issue:\n\n' +
                error.message + '\n\n' +
                'Please ensure:\n' +
                '1. Docker Desktop is running\n' +
                '2. Proof server is started\n' +
                '3. Wait 60 seconds for initialization\n' +
                '4. Check port 6300 is accessible'
            );
        }
        
        throw new Error(`REAL deployment failed: ${error.message}`);
    }
}

/**
 * Verify contract via Preprod indexer
 */
async function verifyContractViaIndexer(contractAddress) {
    try {
        const query = `
            query {
                contract(id: "${contractAddress}") {
                    id
                    createdAt
                    deployer
                    network
                }
            }
        `;
        
        const response = await fetch(INDEXER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            throw new Error(`Indexer returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.errors) {
            console.warn('Indexer query errors:', result.errors);
            return { verified: false, errors: result.errors };
        }
        
        return {
            verified: true,
            data: result.data?.contract || null
        };
        
    } catch (error) {
        console.warn('Indexer verification failed:', error.message);
        return { verified: false, error: error.message };
    }
}

/**
 * Test Midnight wallet connection and wallet balance
 */
export async function testMidnightConnectionReal() {
    if (!window.midnight) {
        return {
            connected: false,
            error: 'Midnight wallet extension not detected'
        };
    }
    
    try {
        const apiKeys = Object.keys(window.midnight);
        if (apiKeys.length === 0) {
            return {
                connected: false,
                error: 'No Midnight wallet API in Lace'
            };
        }
        
        const apiKey = apiKeys[0];
        const walletApi = await window.midnight[apiKey].connect('preprod');
        
        const addresses = await walletApi.getShieldedAddresses();
        const balances = await walletApi.getBalances?.() || { tNIGHT: 0, tDUST: 0 };
        
        return {
            connected: true,
            network: 'preprod',
            addresses: {
                coinPublicKey: addresses.shieldedCoinPublicKey,
                bech32Unshielded: addresses.bech32UnshieldedAddress,
                bech32Shielded: addresses.bech32ShieldedAddress
            },
            balances,
            readyForDeployment: balances.tNIGHT >= 1000 // Need at least 1000 tNIGHT for deployment
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

/**
 * Check all prerequisites for REAL deployment
 */
export async function checkPrerequisitesReal() {
    const results = {
        midnightWallet: { ok: false, message: '', details: null },
        proofServer: { ok: false, message: '' },
        contractArtifact: { ok: false, message: '' },
        indexer: { ok: false, message: '' }
    };
    
    try {
        // Check Midnight wallet
        const walletTest = await testMidnightConnectionReal();
        results.midnightWallet.ok = walletTest.connected;
        results.midnightWallet.message = walletTest.connected ? 'Connected' : walletTest.error;
        results.midnightWallet.details = walletTest.connected ? walletTest : null;
        
        // Check proof server
        try {
            const proofResponse = await fetch(PROOF_SERVER_URL, { method: 'HEAD' });
            results.proofServer.ok = true;
            results.proofServer.message = 'Running';
        } catch (error) {
            results.proofServer.message = 'Not reachable';
        }
        
        // Check contract artifact
        try {
            // Try to import the contract
            await import('../contract/src/managed/age_verify/contract/index.js');
            results.contractArtifact.ok = true;
            results.contractArtifact.message = 'Compiled and ready';
        } catch (error) {
            results.contractArtifact.message = 'Not compiled - run npm run compact:wsl';
        }
        
        // Check indexer
        try {
            const indexerResponse = await fetch(INDEXER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: '{ __typename }' })
            });
            results.indexer.ok = indexerResponse.ok;
            results.indexer.message = indexerResponse.ok ? 'Connected' : `HTTP ${indexerResponse.status}`;
        } catch (error) {
            results.indexer.message = 'Connection error';
        }
        
        const allOk = Object.values(results).every(r => r.ok);
        
        return {
            allOk,
            results,
            readyForDeployment: allOk && walletTest.connected && walletTest.balances?.tNIGHT >= 1000,
            recommendations: allOk ? [] : [
                !results.midnightWallet.ok && 'Install/unlock Midnight wallet (Lace or I AM Wallet) and connect to Preprod',
                !results.proofServer.ok && 'Start proof server: docker compose -f docker/proof-server.yml up -d',
                !results.contractArtifact.ok && 'Compile contract: npm run compact:wsl',
                !results.indexer.ok && 'Check network connectivity'
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

export default {
    deployRealContract,
    testMidnightConnectionReal,
    checkPrerequisitesReal
};