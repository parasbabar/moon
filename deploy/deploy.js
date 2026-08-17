/**
 * 🌙 Midnight Verify — Secure Contract Deployment via Lace DApp Connector
 * 
 * Deploy AgeVerify contract to Preprod without exposing seeds or private keys.
 * Uses existing Lace wallet connection for secure, wallet-managed deployment.
 * 
 * SECURITY FEATURES:
 * ✅ No seed phrase exposure
 * ✅ No private key handling
 * ✅ Uses Lace wallet API exclusively
 * ✅ DUST handled by Lace transaction balancing
 * ✅ All keys stay in Lace wallet
 */

import { Contract } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractArtifact } from '@midnight-ntwrk/midnight-js-contracts';
import { proofServer } from '@midnight-ntwrk/midnight-js-contracts';

// Load contract artifact
let contractArtifact = null;

/**
 * Load the AgeVerify contract artifact
 * @returns {Promise<ContractArtifact>} Contract artifact
 */
async function loadContractArtifact() {
    if (contractArtifact) {
        return contractArtifact;
    }
    
    try {
        // Import the compiled contract module
        const module = await import('../contract/src/managed/age_verify/contract/index.js');
        const ContractClass = module.Contract;
        
        // Create contract artifact from compiled contract
        contractArtifact = ContractArtifact.fromCompiledContract(ContractClass);
        console.log('Contract artifact loaded successfully');
        return contractArtifact;
    } catch (error) {
        console.error('Error loading contract artifact:', error);
        throw new Error('Contract artifact not found. Run \'npm run compact:wsl\' to compile the contract first.');
    }
}

/**
 * Deploy contract via Lace DApp Connector
 * @param {Object} options Deployment options
 * @param {Object} options.laceApi Connected Lace API instance
 * @param {bigint} options.threshold Eligibility threshold (minimum age)
 * @param {Function} options.onStatus Progress callback (status, percent)
 * @returns {Promise<Object>} Deployment result with contract address
 */
export async function deployContractViaLace({ laceApi, threshold, onStatus }) {
    console.log('Starting secure contract deployment via Lace...');
    
    if (!laceApi) {
        throw new Error('Lace API not connected. Connect wallet first.');
    }
    
    if (!threshold || threshold <= 0n) {
        throw new Error('Invalid threshold. Must be positive integer.');
    }
    
    try {
        // 1. Load contract artifact
        onStatus?.('Loading contract artifact', 10);
        const artifact = await loadContractArtifact();
        
        // 2. Get shielded coin public key from Lace
        onStatus?.('Getting wallet addresses', 20);
        const addresses = await laceApi.getShieldedAddresses();
        const coinPk = addresses.shieldedCoinPublicKey;
        
        console.log('Using Lace wallet shielded coin public key:', coinPk);
        
        // 3. Configure proof server
        onStatus?.('Configuring proof server', 30);
        const proofServerUrl = 'http://localhost:6300';
        
        // Check proof server connectivity
        try {
            await fetch(proofServerUrl, { method: 'HEAD' });
            console.log('Proof server connected');
        } catch (error) {
            throw new Error(`Proof server not running at ${proofServerUrl}. Start Docker with: docker compose -f docker/proof-server.yml up -d`);
        }
        
        // 4. Create contract instance
        onStatus?.('Creating contract instance', 40);
        const contract = new Contract(artifact, {
            network: 'preprod',
            proofServer: proofServerUrl
        });
        
        // 5. Prepare deployment transaction
        onStatus?.('Preparing deployment transaction', 50);
        
        // Get current block number for transaction validity
        const blockNumber = await contract.getCurrentBlockNumber();
        const expireBlockNumber = blockNumber + 1000; // Expire in 1000 blocks
        
        // Create deployment arguments
        const initArgs = {
            threshold: threshold
        };
        
        // 6. Sign and submit transaction via Lace
        onStatus?.('Signing transaction with Lace', 60);
        
        // Generate ZK proof
        onStatus?.('Generating ZK proof (30-90 seconds)', 70);
        const deploymentTx = await contract.deploy({
            initArgs,
            deployerAddress: coinPk,
            expireBlockNumber
        });
        
        // Get transaction bytes for Lace signing
        const txBytes = deploymentTx.toBytes();
        
        // Sign with Lace wallet
        onStatus?.('Submitting transaction to network', 80);
        const signature = await laceApi.signTransaction(txBytes);
        
        // Submit signed transaction
        const txHash = await contract.submitSignedTransaction(signature);
        
        // 7. Wait for confirmation
        onStatus?.('Waiting for confirmation', 90);
        console.log('Transaction submitted with hash:', txHash);
        
        // Poll for confirmation
        let confirmed = false;
        let confirmationCount = 0;
        const maxRetries = 60; // ~5 minutes
        const retryDelay = 5000; // 5 seconds
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const status = await contract.getTransactionStatus(txHash);
                
                if (status === 'confirmed') {
                    confirmed = true;
                    confirmationCount++;
                    
                    // Wait for 2 confirmations for safety
                    if (confirmationCount >= 2) {
                        break;
                    }
                } else if (status === 'failed') {
                    throw new Error('Transaction failed to confirm on chain');
                }
            } catch (error) {
                console.log('Waiting for confirmation...', error.message);
            }
            
            // Update progress
            const progress = 90 + Math.floor((i / maxRetries) * 8);
            onStatus?.(`Waiting for confirmation (${i + 1}/${maxRetries})`, progress);
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        if (!confirmed) {
            throw new Error('Transaction confirmation timeout. Check network status.');
        }
        
        // 8. Get deployed contract address
        onStatus?.('Retrieving contract address', 95);
        const deployedContract = await contract.getInstanceAt(txHash);
        const contractAddress = deployedContract.address;
        
        console.log('Contract deployed successfully!');
        console.log('Contract address:', contractAddress);
        console.log('Network: preprod');
        console.log('Threshold:', threshold);
        
        // 9. Verify contract is accessible
        onStatus?.('Verifying contract access', 100);
        const contractInfo = await deployedContract.getInfo();
        
        if (!contractInfo) {
            console.warn('Warning: Contract info retrieval failed');
        }
        
        return {
            success: true,
            contractAddress: contractAddress,
            network: 'preprod',
            transactionHash: txHash,
            threshold: Number(threshold),
            timestamp: new Date().toISOString(),
            laceWalletAddress: coinPk
        };
        
    } catch (error) {
        console.error('Deployment failed:', error);
        
        // Handle specific error cases
        if (error.message.includes('DUST')) {
            throw new Error(
                'Lace wallet needs DUST for transaction balancing.\n' +
                'In Lace wallet:\n' +
                '1. Open DUST section\n' +
                '2. Generate tDUST for Preprod\n' +
                '3. Try deployment again\n' +
                '\nLace will handle DUST automatically during transaction submission.'
            );
        }
        
        if (error.message.includes('proof server')) {
            throw new Error(
                'Proof server issue:\n' +
                '1. Start Docker Desktop\n' +
                '2. Run: docker compose -f docker/proof-server.yml up -d\n' +
                '3. Wait 60 seconds for server to start\n' +
                '4. Refresh and try again'
            );
        }
        
        if (error.message.includes('insufficient balance')) {
            throw new Error(
                'Insufficient tNIGHT balance for deployment fee.\n' +
                'Current wallet has 5,000 tNIGHT but may need additional for fees.\n' +
                'Ensure Lace wallet has enough tNIGHT for deployment transaction.'
            );
        }
        
        throw new Error(`Deployment failed: ${error.message}`);
    }
}

/**
 * Test function to verify Lace connection
 * @param {Object} laceApi Connected Lace API
 * @returns {Promise<Object>} Connection test result
 */
export async function testLaceConnection(laceApi) {
    try {
        if (!laceApi) {
            throw new Error('Lace API not available');
        }
        
        // Get wallet info
        const addresses = await laceApi.getShieldedAddresses();
        const balances = await laceApi.getBalances();
        
        return {
            connected: true,
            addresses: {
                coinPublicKey: addresses.shieldedCoinPublicKey,
                bech32Unshielded: addresses.bech32UnshieldedAddress,
                bech32Shielded: addresses.bech32ShieldedAddress
            },
            balances: {
                tNIGHT: balances.tNIGHT || 0,
                tDUST: balances.tDUST || 0,
                total: balances.total || 0
            },
            network: 'preprod',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Lace connection test failed:', error);
        return {
            connected: false,
            error: error.message
        };
    }
}

/**
 * Check deployment prerequisites
 * @returns {Promise<Object>} Prerequisites check result
 */
export async function checkPrerequisites() {
    const results = {
        proofServer: { ok: false, message: '' },
        contractArtifact: { ok: false, message: '' },
        indexer: { ok: false, message: '' },
        laceAvailable: { ok: false, message: '' }
    };
    
    try {
        // Check proof server
        const proofServerResponse = await fetch('http://localhost:6300', {
            method: 'HEAD'
        }).then(res => {
            results.proofServer.ok = true;
            results.proofServer.message = 'Connected';
            return true;
        }).catch(error => {
            results.proofServer.message = 'Not running';
            return false;
        });
        
        // Check indexer
        try {
            const indexerResponse = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: '{ __typename }' })
            });
            
            if (indexerResponse.ok) {
                results.indexer.ok = true;
                results.indexer.message = 'Connected';
            } else {
                results.indexer.message = 'HTTP ' + indexerResponse.status;
            }
        } catch (error) {
            results.indexer.message = 'Connection error: ' + error.message;
        }
        
        // Check contract artifact
        try {
            const artifactResponse = await fetch(CONTRACT_ARTIFACT_PATH);
            if (artifactResponse.ok) {
                results.contractArtifact.ok = true;
                results.contractArtifact.message = 'Found';
            } else {
                results.contractArtifact.message = 'Missing - run build:contract';
            }
        } catch (error) {
            results.contractArtifact.message = 'Error: ' + error.message;
        }
        
        // Check Lace availability
        results.laceAvailable.ok = !!window.midnight;
        results.laceAvailable.message = results.laceAvailable.ok 
            ? 'Available' 
            : 'Not detected - install Lace extension';
        
        // Calculate overall status
        const allOk = Object.values(results).every(r => r.ok);
        
        return {
            allOk,
            results,
            recommendations: allOk ? [] : [
                !results.proofServer.ok && 'Start proof server: docker compose -f docker/proof-server.yml up -d',
                !results.contractArtifact.ok && 'Build contract: npm run build:contract',
                !results.laceAvailable.ok && 'Install Lace wallet extension',
                !results.indexer.ok && 'Check network connectivity'
            ].filter(Boolean)
        };
        
    } catch (error) {
        console.error('Prerequisites check error:', error);
        return {
            allOk: false,
            results,
            error: error.message
        };
    }
}

export default {
    deployContractViaLace,
    testLaceConnection,
    checkPrerequisites
};