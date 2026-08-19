# Midnight Verify

> **Prove eligibility. Reveal nothing else.**

[![CI — Midnight Verify](https://github.com/parasbabar/moon/actions/workflows/ci.yml/badge.svg)](https://github.com/parasbabar/moon/actions/workflows/ci.yml)

---

## Overview

Midnight Verify is a privacy-preserving age/eligibility gate built on the [Midnight Network](https://midnight.network). It allows a user to prove that their private age satisfies a public eligibility threshold — without disclosing the exact age to any observer.

The application uses Midnight's Compact language to write a ZK circuit that enforces the eligibility condition at the cryptographic level. The frontend, API layer, and contract are all connected — the privacy guarantee is architectural, not cosmetic.

---


## Live Demo

🔗 **Demo link**: **[warm-crostata-51c1f1.netlify.app](https://warm-crostata-51c1f1.netlify.app/)**
<div align="center">

## Contract Address: b23f1a6e52f5e3c02127bfb5b47e20db95ba033a708479fb55057875bf133c3e

### 🎥 1-Minute Demo Video

[▶️ Watch the Demo](https://docs.google.com/videos/d/1bnoz3R2g8axL68iaJaL-rk-JVz8Y9x6C1MD3XT8sN8Y/play?usp=sharing)

</div>

The live demo is a fully hosted deployment of Midnight Verify. Open the link,
connect a Midnight wallet, and try the real privacy-preserving flow.

**The live demo demonstrates**:

- 🔗 **Lace Wallet connection** — connects via the Midnight DApp Connector API
- ⬡ **Midnight Preprod contract deployment** — deploys the AgeVerify contract
  on-chain directly from the browser (wallet approval required)
- 🔒 **Private age / 18+ threshold ZK verification** — the private age is fed to
  the `getAge()` witness of the Compact circuit; only the boolean eligibility
  result is proven
- 🕶️ **Privacy-preserving verification** — the exact age never leaves the device
  and never appears on-chain
- ⚠️ **Self-attested trust-model limitation** — the age is user-supplied, so the
  proof shows the *supplied* value meets the threshold, not the user's real-world
  age (see the [Trust Model](#trust-model) disclosure)

**Demo flow**:
1. Connect I AM Wallet or Lace wallet (Preprod network)
2. Enter private age
3. Generate ZK proof locally
4. Submit transaction to Preprod
5. Receive eligibility result
6. Exact age remains private

---


## Problem

Traditional eligibility verification forces an unacceptable trade-off:

```
Date of birth: 12/04/1999
Exact age: 27
```

A website needs to know if you are 18 or older. It does not need your date of birth. It does not need your exact age. But most systems demand exactly that — storing and exposing far more personal information than the task requires.

---

## Solution

Midnight Verify uses ZK proofs to enforce **selective disclosure**:

```
What you prove:   age >= 18
What you reveal:  ELIGIBLE ✓
What stays private: your exact age
```

The private value enters a Midnight ZK circuit. The circuit enforces the condition. Only the boolean result (`eligible / not eligible`) is written to the public ledger. The exact age never leaves the user's device.

---

## Features

- 🔒 **Privacy-preserving verification** — exact age never disclosed on-chain
- ⬡ **Real Midnight ZK circuit** — eligibility enforced at the circuit level, not just JS
- 🌙 **Dark, premium UI** — Half Light. Half Shadow. visual system
- 🔗 **Wallet connection** — I AM Wallet / Lace wallet integration (Midnight Network)
- ✓ **Success / failure states** — clear, minimal result disclosure
- 📱 **Responsive design** — desktop, tablet, and mobile
- ♿ **Accessible** — semantic HTML, ARIA labels, keyboard navigation
- 🧪 **18 meaningful tests** — contract simulator tests, no fake assertions
- 🚀 **CI/CD pipeline** — GitHub Actions on every push and PR

---


## Screenshots
### 🧪 Test Results

18/18 contract tests passing, covering eligibility logic, boundary conditions, privacy invariants, custom thresholds, and witness isolation.

<img width="1920" height="1080" alt="Screenshot 2026-08-19 001247" src="https://github.com/user-attachments/assets/c857c18a-cdb7-44d7-9773-411cbf506460" />

### ⛓️ On-Chain Transaction

The dApp successfully deployed the AgeVerify smart contract on the Midnight **Preprod** network through a real wallet transaction.
<img width="1920" height="981" alt="Screenshot 2026-08-19 002507" src="https://github.com/user-attachments/assets/5bf5d154-0f35-4632-9d92-31924a02f10d" />

Smart Contract Deployment Transaction
<img width="1920" height="1080" alt="Screenshot 2026-08-19 001527" src="https://github.com/user-attachments/assets/d3c3386d-dd75-44e0-932e-4c1fc73e0039" />



---

## Architecture

```
User's Browser (Private)
  │
  │  private age → I AM Wallet → DApp Connector API
  ▼
Midnight Verify Frontend
  │  React + Vite + TypeScript
  │  Dynamic imports for WASM modules
  ▼
Midnight Verify API Layer
  │  TypeScript module
  │  Dynamic import of onchain-runner
  ▼
Midnight On-chain Runtime
  │  Real Midnight JS packages
  │  Real ZK proof generation
  │  Real Preprod network interaction
  ▼
AgeVerify Contract (Preprod)
  │  Compiled Compact circuit
  │  Public ledger: threshold, eligible, verificationCount
  │  Private witness: exact age (NEVER stored)
```

---

## User Flow

```
1. Connect wallet            → I AM Wallet / Lace (Midnight Preprod)
2. Deploy contract (optional) → one-time on-chain deployment, wallet approval
3. Enter private age          → stays on-device, never transmitted
4. Generate ZK proof          → circuit proves age >= threshold
5. Approve verification tx    → wallet signs & submits to Preprod
6. On-chain confirmation      → result written to public ledger
7. See result                 → AGE THRESHOLD PROVEN / NOT PROVEN
8. Exact age stays private    → only the boolean result is disclosed
```

If a contract address is already configured (`VITE_CONTRACT_ADDRESS`) or a
previously deployed contract is detected (persisted in the browser), step 2 is
skipped and verification runs against the existing contract.

---

## Midnight Privacy Model

This is the core of the application.

### Architecture

```
User's Device (Private)
  │
  │  private age (witness)
  ▼
Midnight ZK Circuit
  │  enforces: age >= threshold
  │  generates proof: "age >= 18 is true"
  ▼
Contract (Public Ledger)
  │  stores: eligible = true
  │  stores: threshold = 18
  │  stores: verificationCount (audit trail)
  │  does NOT store: exact age
  ▼
Observer
  │  can read: eligible (true/false)
  │  can read: threshold (18)
  │  can read: verificationCount
  │  CANNOT read: exact age
```

### What an observer CAN learn

| Observable | Value |
|---|---|
| That a verification interaction occurred | ✓ |
| The eligibility threshold | 18 |
| The verification result | eligible / not eligible |
| Number of verification interactions | count |
| Normal transaction metadata | timestamps, fees |

### What an observer CANNOT learn

| Private value | Protected by |
|---|---|
| Exact age | ZK witness — never disclosed |
| Age range (beyond threshold) | Circuit only checks >= threshold |
| Any demographic information | Not collected, not stored |

---

## Compact Circuit

The core eligibility circuit written in Compact 0.31.0:

```compact
// Midnight Verify — Age/Eligibility Circuit
witness getAge(): Uint<8>;

export ledger threshold: Uint<8>;
export ledger eligible: Boolean;
export ledger verificationCount: Counter;

constructor(initialThreshold: Uint<8>) {
  threshold = disclose(initialThreshold);
  eligible = false;
  verificationCount.increment(0);
}

circuit verifyAge() {
  const age = getAge();
  if (age >= threshold) {
    eligible = disclose(true);
  } else {
    eligible = disclose(false);
  }
  verificationCount.increment(1);
}
```

**Privacy guarantee**: The `getAge()` witness supplies the private age inside the ZK proof ONLY. The age value is NEVER written to the ledger.

---

## Smart Contract

**Contract**: AgeVerify  
**Network**: Midnight Preprod  
**Compiler**: compactc 0.31.0  
**Runtime**: Midnight JS 4.1.1  
**Ledger**: 8.0.2  

**Deployed Contract Address**: `[Will be populated after deployment]`

**Public ledger state**:
- `threshold`: Uint<8> (e.g., 18)
- `eligible`: Boolean (true/false)
- `verificationCount`: Counter (monotonic)

**Private state**:
- User's exact age (witness only, never stored)

---

## Wallet Integration

Midnight Verify uses the **I AM Wallet (1AM)** or **Lace wallet** with the **Midnight DApp Connector API**:

1. User connects I AM Wallet or Lace wallet (Preprod network)
2. Wallet provides secure key material for transaction signing
3. DApp Connector API balances and submits transactions
4. Private age remains in user's browser — never sent to wallet

**No private keys handled by the dApp** — all key management is delegated to the wallet.

---

## Wallet Setup (Lace / I AM Wallet)

Midnight Verify works with any wallet that exposes the **Midnight DApp Connector
API** on `window.midnight`. Both **Lace** and **I AM Wallet (1AM)** support it.

### Install Lace
1. Install the **Lace** browser extension (Chrome/Firefox).
2. Open Lace and create/import a wallet.
3. Switch the network to **Midnight Preprod** (Lace → Settings → Network → Preprod).
4. Fund the wallet with **tNIGHT** from the [Midnight faucet](https://faucet.midnight.network/).
5. Generate **tDUST** (Lace → Preprod → Tokens → Generate tDUST) — DUST is
   required to balance transactions.

### Install I AM Wallet (1AM)
1. Install the **1AM** browser extension (Chrome/Firefox).
2. Create or import a wallet and connect it to **Midnight Preprod**.
3. Fund with tNIGHT / tDUST as above.

### Known browser conflicts
- **MetaMask conflicts**: MetaMask and Lace/1AM both inject web3 provider streams.
  If the wallet fails to connect, disable MetaMask (or the other wallet) and
  refresh the page. See [`FIX_LACE_CONNECTION.md`](FIX_LACE_CONNECTION.md).
- The dApp auto-detects `window.midnight` — only one Midnight wallet should be
  enabled at a time.

---

## Tech Stack

**Contract Layer**
- Compact 0.31.0 — ZK circuit language
- midnight-js-contracts 4.1.1 — deployment & interaction
- midnight-js-types 4.1.1 — type definitions
- Vitest — testing framework

**API Layer**
- TypeScript — type safety
- Dynamic imports — WASM modules excluded from frontend bundle
- RxJS — reactive programming

**Frontend**
- React 18 — UI framework
- Vite 6.4 — build tool & dev server
- vite-plugin-wasm — WebAssembly support
- CSS Modules — scoped styles

**Infrastructure**
- Docker — proof server container
- GitHub Actions — CI/CD pipeline
- Midnight Proof Server 8.1.0 — ZK proof generation

---

## Installation

### Prerequisites
- Node.js 22+
- Docker Desktop
- Git
- I AM Wallet (1AM) or Lace wallet (for Preprod testing)

### 1. Clone repository
```bash
git clone https://github.com/parasbabar/moon.git
cd moon
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start proof server
```bash
docker compose -f docker/proof-server.yml up -d
```

### 5. Verify proof server
```bash
curl http://localhost:6300
# Should return HTTP 200
```

---

## Environment Variables

Create `.env` from `.env.example`:

```env
# Network
VITE_MIDNIGHT_NETWORK=preprod
VITE_INDEXER_URL=https://indexer.preprod.midnight.network/api/v4/graphql
VITE_INDEXER_WS_URL=wss://indexer.preprod.midnight.network/api/v4/graphql/ws
VITE_PROOF_SERVER_URL=http://localhost:6300

# Contract (set after deployment)
VITE_CONTRACT_ADDRESS=

# Eligibility threshold (default: 18)
VITE_ELIGIBILITY_THRESHOLD=18

# Deployment (local only — NEVER commit)
MIDNIGHT_DEPLOY_SEED=<your-64-char-hex-seed-or-24-word-mnemonic>
```

**Security**: Never commit `.env` to version control.

---

## Development

### Start development server
```bash
npm run dev
```

### Compile Compact contract (requires WSL/Ubuntu)
```bash
npm run compact:wsl
```

### Run tests
```bash
npm run test:run
```

### Build for production
```bash
npm run build
```

---

## Testing

Midnight Verify includes **18 meaningful tests** across two test suites:

### 1. Core Circuit Logic Tests
- Eligible user (age 25, threshold 18) is verified
- Boundary condition (age 18 == threshold 18) is verified  
- Ineligible user (age 17, threshold 18) is rejected
- Zero age is rejected
- Verification count tracks interactions correctly
- Custom threshold (21) correctly rejects age 20 and accepts age 21
- Ledger state never contains the exact private age (privacy invariant)
- Contract initialises with correct default state

### 2. Real Simulator Tests (compactc 0.31.0)
- Real Contract simulation with Compact runtime
- Witness isolation — witness function is the only path to access private age
- All circuit interactions work with real compiled artifacts

**Run all tests**:
```bash
npm run test:run
```

Expected output: `Test Files 2 passed (2), Tests 18 passed (18)`

---

## Production Build

### Build frontend
```bash
cd frontend
npm run build
```

**Build output**: `frontend/dist/`

### Verify build
```bash
# Check TypeScript
npx tsc --noEmit

# Check production build
npm run build
```

The build:
- Excludes WASM modules from frontend bundle
- Uses dynamic imports for Midnight runtime
- Optimizes for production with code splitting
- Generates source maps for debugging

---

## CI/CD

GitHub Actions workflow runs on every push and PR:

**Jobs**:
1. **TypeScript Check** — TypeScript compilation
2. **Contract Tests** — 18+ tests must pass
3. **Frontend Build** — Vite production build
4. **Compact Compile Check** — Source compilation verification

**Workflow file**: `.github/workflows/ci.yml`

**Requirements**:
- Node.js 22
- Ubuntu latest
- All tests must pass
- Build must succeed

---

## Preprod Deployment

### Prerequisites
1. Proof server running (`docker compose -f docker/proof-server.yml up -d`)
2. MIDNIGHT_DEPLOY_SEED in `.env` (64-char hex or 24-word mnemonic)
3. Wallet funded with tNIGHT (https://faucet.midnight.network/)
4. DUST generated (Wallet → Preprod → Tokens → Generate tDUST)

### Get wallet address
```bash
cd deploy
npm run wallet:address
```

### Deploy contract
```bash
cd deploy
npm run deploy
```

**Deployment process**:
1. Checks proof server health
2. Checks Preprod indexer reachability  
3. Loads wallet from seed
4. Deploys AgeVerify contract with ZK proof (30-90 seconds)
5. Writes contract address to `.env`

### Update frontend
After deployment, update `.env` with the contract address and rebuild:
```bash
cd frontend
npm run build
```

### Deploy from the browser (recommended)
The frontend includes an in-app **Deploy Contract** button (shown when a real
Midnight wallet is connected). Clicking it:

1. Asks the wallet to prove the deployment circuit (wallet approval popup).
2. Balances the transaction (DUST fees covered automatically).
3. Submits to Preprod and waits for on-chain confirmation.
4. Persists the returned `ct_...` address and deployment transaction hash
   (linked to the Midnight Preprod explorer).

No seed phrase is ever handled by the app — key material stays in the wallet.

---

## ZK Verification

When a deployed contract address is available and a real wallet is connected,
the app runs the **real on-chain verification**:

1. The private age is placed in local private state and fed to the `getAge()`
   witness of the compiled `verifyAge` circuit.
2. The wallet's proving provider generates a real ZK proof.
3. The transaction is balanced and signed by the wallet (user approval).
4. The proof is submitted to Preprod and confirmed on-chain.
5. The app reads the updated public ledger and shows
   **AGE THRESHOLD PROVEN / NOT PROVEN**, along with the real verification
   transaction hash (explorer link + copy button).

The exact age never leaves the device and never appears on-chain.

If no contract is deployed or no wallet is available, the app falls back to a
**local circuit simulator** using the same compiled Contract class — same ZK
logic, no network. The result is clearly marked as simulator/demo in the UI.

---

## Contract Address

**Network**: Midnight Preprod  
**Status**: Ready for deployment  
**Address**: `[Will be populated after deployment]`

Once deployed, the contract will be visible on the Preprod block explorer.

---

## Product Proposal

### Product
**Midnight Verify** — Privacy-preserving eligibility verification

### Challenge
**Age / Eligibility Gate** — Prove minimum age without revealing exact age

### Problem
Traditional verification systems collect and expose excessive personal information. Users must disclose exact dates of birth or ages when only a boolean eligibility check is needed.

### Solution
Use Midnight's zero-knowledge technology to verify eligibility while keeping personal data private. The circuit proves `age >= threshold` without revealing the exact age.

### Target Users
- Age-restricted services (alcohol, gambling, adult content)
- Event platforms (18+ events, 21+ venues)
- Membership systems (senior discounts, youth programs)
- Employment platforms (minimum age requirements)

### MVP Features
- Lace wallet integration
- Private age input
- Real Compact circuit
- Preprod contract deployment
- Eligibility verification
- Privacy-preserving architecture

### Future Roadmap
- Configurable thresholds per use case
- Multiple private credentials (age, location, membership status)
- Reusable proof credentials
- Batch verification
- Enterprise compliance integration

### Business Model
- Open source core technology
- Enterprise deployment support
- Compliance consulting
- White-label solutions

### Competitive Advantage
- **Architectural privacy** — not cosmetic, cryptographic guarantees
- **Midnight ecosystem** — native ZK privacy platform
- **Developer experience** — comprehensive tooling, clear documentation
- **Production readiness** — CI/CD, tests, deployment scripts

---

## Demo Video

[1-minute demo video](demo-video.mp4) showing:

**0–10 sec**: Landing page introduction  
**10–20 sec**: Midnight wallet connection (I AM Wallet or Lace)  
**20–35 sec**: Private age entry + verification  
**35–45 sec**: Verified result + private age protection  
**45–52 sec**: 18/18 tests passing  
**52–60 sec**: GitHub Actions CI/CD pipeline  

The video demonstrates the complete privacy-preserving flow from wallet connection to on-chain verification.

---

## Security

### Privacy Guarantees
- Exact age never leaves user's device
- Age only used inside ZK circuit witness
- Only boolean result (`eligible`) disclosed on-chain
- No personal data collection or storage

### Security Practices
- No private key handling by dApp
- Wallet integration via DApp Connector API
- Environment variables for secrets
- Comprehensive .gitignore
- CI/CD security scanning

### Audit Trail
- `verificationCount` provides non-repudiation
- Public ledger for transparency
- No PII in audit logs

### Trust Model
- **Current demo mode**: The ZK circuit proves that the supplied private value satisfies the 18+ threshold.
- **Self-attested age**: In this demo, the age value is supplied by the user. The proof demonstrates only that the supplied value meets the threshold — it does not authenticate the user's real-world age.
- **Separate properties**: Privacy (age stays on-device) and authenticity (real-world verification) are independent. The ZK proof preserves privacy, but because the input is self-attested, it does not establish real-world age.
- **Production requirement**: A production deployment would require an issuer-backed age credential or equivalent trusted attestation mechanism (e.g., W3C Verifiable Credentials from a government or organizational issuer).
- **Honest product model**: "Zero-knowledge age-threshold demonstration using a self-attested private value."

---

## Known Limitations

- **Self-attested age input**: The age is entered by the user and is not backed
  by a trusted issuer. The ZK proof guarantees the *supplied value* meets the
  threshold, but does not establish the user's real-world age.
- **No credential issuance**: This demo has no integration with a government or
  organizational identity issuer. A production deployment would require an
  issuer-backed age credential (e.g., W3C Verifiable Credentials).
- **Proof server dependency**: Live verification requires a proof server
  (`docker compose -f docker/proof-server.yml up -d`) or a wallet that can
  produce proofs locally. Without it, only the local simulator path is used.
- **Indexer latency**: After a transaction is confirmed, the public indexer may
  take a few seconds to reflect the new ledger state. A slightly delayed read
  produces a "contract state not found" error; retrying usually succeeds.
- **Single deploy per dApp**: Deployment is a one-time on-chain action per
  browser; subsequent loads restore the persisted contract address.
- **Preprod network only**: All on-chain interactions target Midnight Preprod.
  Test tokens have no real-world value.

---

## License

MIT License — see [LICENSE](LICENSE) file.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure CI passes
5. Submit pull request

### Development Standards
- TypeScript strict mode
- 18+ test requirement
- Privacy-preserving architecture
- Accessible UI components
- Comprehensive documentation

---

## Acknowledgments

- [Midnight Network](https://midnight.network) for the privacy platform
- [Compact language](https://docs.midnight.network/compact) for ZK circuits
- [I AM Wallet (1AM)](https://1am.xyz/) for wallet integration
- Contributors and testers

---

## Contact

**Project**: Midnight Verify  
**Challenge**: Age / Eligibility Gate  
**Status**: Demo — ZK age-threshold proof with self-attested private value  
**Repository**: https://github.com/parasbabar/moon  
**Live Demo**: https://warm-crostata-51c1f1.netlify.app/

---

> **Prove eligibility. Reveal nothing else.**
