/**
 * 🌙 Midnight Verify — REAL Contract Deployment (Node.js)
 * 
 * This is the actual deployment script that will deploy the REAL contract.
 * Uses Lace DApp Connector but runs in Node.js for full capability.
 */

import { deployContract, submitDeployTx, createUnprovenDeployTx } from '@midnight-ntwrk/midnight-js-contracts';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const PROOF_SERVER_URL = 'http://localhost:6300';
const NETWORK = 'preprod';
const THRESHOLD = 18n;

// Paths
const CONTRACT_ARTIFACT_PATH = join(__dirname, '../../contract/src/managed/age_verify/contract/index.js');

/**
 * Main deployment function
 */
async function deployRealContract() {
    console.log('🚀 Starting REAL contract deployment to Midnight Preprod...');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Verify proof server
        console.log('📡 Step 1: Checking proof server...');
        const proofServerOk = await checkProofServer();
        if (!proofServerOk) {
            throw new Error(
                `Proof server not reachable at ${PROOF_SERVER_URL}\n` +
                'Please ensure:\n' +
                '1. Docker Desktop is running\n' +
                '2. Proof server is started: docker compose -f docker/proof-server.yml up -d\n' +
                '3. Wait 60 seconds for initialization'
            );
        }
        console.log('✅ Proof server is running');
        
        // Step 2: Load contract artifact
        console.log('📦 Step 2: Loading contract artifact...');
        const contractArtifact = await loadContractArtifact();
        console.log('✅ Contract artifact loaded');
        
        // Step 3: Create contract instance
        console.log('🔧 Step 3: Creating contract instance...');
        const contract = new Contract(contractArtifact, {
            network: NETWORK,
            proofServer: PROOF_SERVER_URL
        });
        
        // Step 4: Get current block number
        console.log('📊 Step 4: Getting current block number...');
        const blockNumber = await contract.getCurrentBlockNumber();
        const expireBlockNumber = blockNumber + 1000;
        console.log(`✅ Current block: ${blockNumber}, Expire at: ${expireBlockNumber}`);
        
        // Step 5: Prepare deployment
        console.log('⚙️ Step 5: Preparing deployment transaction...');
        const initArgs = {
            threshold: THRESHOLD
        };
        
        console.log(`   • Threshold: ${THRESHOLD}+`);
        console.log(`   • Network: ${NETWORK}`);
        
        // IMPORTANT: For REAL deployment, we need:
        // 1. A connected Lace wallet (via DApp Connector in browser)
        // 2. The wallet's coin public key
        // 3. Transaction signing via Lace
        
        console.log('\n⚠️  IMPORTANT: Full deployment requires browser interaction');
        console.log('='.repeat(60));
        console.log('\nTo deploy the REAL contract:');
        console.log('1. Open the deployment UI in browser:');
        console.log('   file:///D:/Midnight%20Verify/deploy/index.html');
        console.log('2. Connect your Lace wallet (must be on Preprod)');
        console.log('3. Click "Deploy Contract to Preprod"');
        console.log('4. Follow the prompts in Lace wallet');
        console.log('\nThe deployment will:');
        console.log('• Generate ZK proof (30-90 seconds)');
        console.log('• Create deployment transaction');
        console.log('• Sign with Lace wallet');
        console.log('• Submit to Preprod network');
        console.log('• Wait for confirmation (2-5 minutes)');
        console.log('• Return real contract address');
        
        // Node.js cannot sign and submit the transaction itself — deployment
        // requires the Lace / I AM Wallet extension in the browser. Never
        // fabricate a fake address or transaction hash.
        throw new Error(
            'Node.js deployment requires wallet signing. Open deploy/index.html ' +
            'in the browser, connect your Lace / I AM Wallet (Preprod), and deploy ' +
            'the real contract there. This script will not fabricate a result.'
        );
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        
        if (error.message.includes('proof server')) {
            console.error('\nProof server troubleshooting:');
            console.error('1. Check Docker Desktop is running');
            console.error('2. Run: docker ps (should show midnight-verify-proof-server)');
            console.error('3. Check logs: docker logs midnight-verify-proof-server');
            console.error('4. Test connection: curl http://localhost:6300');
        }
        
        throw error;
    }
}

/**
 * Check proof server connectivity
 */
async function checkProofServer(): Promise<boolean> {
    try {
        const response = await fetch(PROOF_SERVER_URL, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Load contract artifact
 */
async function loadContractArtifact(): Promise<ContractArtifact> {
    try {
        // Import the compiled contract
        const contractModule = await import(CONTRACT_ARTIFACT_PATH);
        const ContractClass = contractModule.Contract;
        
        return ContractArtifact.fromCompiledContract(ContractClass);
    } catch (error) {
        throw new Error(
            `Failed to load contract artifact: ${error.message}\n` +
            'Please compile the contract first:\n' +
            '1. Run: npm run compact:wsl\n' +
            '2. Verify file exists: ' + CONTRACT_ARTIFACT_PATH
        );
    }
}

/**
 * Run deployment
 */
async function main() {
    console.log('🌙 Midnight Verify — REAL Contract Deployment');
    console.log('='.repeat(60));
    
    try {
        const result = await deployRealContract();
        
        console.log('\n' + '='.repeat(60));
        console.log('📋 DEPLOYMENT READY');
        console.log('='.repeat(60));
        
        console.log('\nTo complete REAL deployment:');
        console.log('1. Open browser deployment UI');
        console.log('2. Connect Lace wallet to Preprod');
        console.log('3. Ensure wallet has:');
        console.log('   • ≥1000 tNIGHT balance');
        console.log('   • tDUST (Lace will generate if needed)');
        console.log('4. Click "Deploy Contract to Preprod"');
        console.log('5. Follow Lace wallet prompts');
        
        console.log('\n✅ All prerequisites verified:');
        console.log('   • Proof server: Running');
        console.log('   • Contract artifact: Compiled');
        console.log('   • Network: Preprod configured');
        console.log('   • Threshold: 18+ ready');
        
        console.log('\n🚀 Ready for REAL deployment via browser UI!');
        
    } catch (error) {
        console.error('\n❌ Deployment preparation failed');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { deployRealContract };