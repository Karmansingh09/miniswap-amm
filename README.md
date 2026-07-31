# MiniSwap AMM & StellarSwap Pro

<p align="center">
  <img src="https://img.shields.io/badge/Soroban-Smart%20Contract-6366f1?style=for-the-badge&logo=stellar&logoColor=white" alt="Soroban" />
  <img src="https://img.shields.io/badge/Stellar-Testnet-fbbf24?style=for-the-badge&logo=stellar&logoColor=black" alt="Testnet" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-Build%20Tool-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Freighter-Wallet-FF3E00?style=for-the-badge" alt="Freighter Wallet" />
  <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge" alt="License" />
</p>

---

## Project Overview

**MiniSwap AMM / StellarSwap Pro** is a fully on-chain decentralized exchange (DEX) built on the **Stellar Testnet** using **Soroban smart contracts**. Token swaps, liquidity deposits, and withdrawals are executed as genuine Soroban contract invocations signed by Freighter and confirmed on Testnet.

- **GitHub Repository**: [Karmansingh09/miniswap-amm](https://github.com/Karmansingh09/miniswap-amm)
- **Frontend**: React + Vite
- **Wallet**: Freighter
- **Network**: Stellar Testnet

---

## Stellar Testnet Deployment

| Field | Value |
|-------|-------|
| **Network** | Stellar Testnet |
| **AMM Contract ID** | [`CAP7XKVIR32BF4RV2WLPTP5GMEFMFZYJMIP4MQHSW2NZJGKWRXMDKK3L`](https://stellar.expert/explorer/testnet/contract/CAP7XKVIR32BF4RV2WLPTP5GMEFMFZYJMIP4MQHSW2NZJGKWRXMDKK3L) |
| **Initialization Tx Hash** | [`e90910c605a73d38b9eb6ec23d90f4cdc20cf84f9d1d443d2aa8671c28f7283f`](https://stellar.expert/explorer/testnet/tx/e90910c605a73d38b9eb6ec23d90f4cdc20cf84f9d1d443d2aa8671c28f7283f) |
| **Token A (Native XLM SAC)** | [`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |
| **Token B (Test USDC SAC)** | [`CDO2QBWEPOA4HGJ4VMNC26MYRHHRIEK354X5TQQAYQTOKBFSKWMZUH77`](https://stellar.expert/explorer/testnet/contract/CDO2QBWEPOA4HGJ4VMNC26MYRHHRIEK354X5TQQAYQTOKBFSKWMZUH77) |
| **Test USDC Issuer** | `GCX2VFJGK2IT5OWGQGDFZWDQRZAFUJSMLMI3HVIMGTZFMSJOFTGSGWQ3` |
| **Soroban RPC** | `https://soroban-testnet.stellar.org` |

---

## Architecture

```text
miniswap-amm/
├── .github/
│   └── workflows/
│       └── build.yml               # CI Build Verification
├── miniswap/
│   └── miniswap-amm/
│       ├── contracts/
│       │   └── amm/
│       │       ├── src/
│       │       │   ├── lib.rs      # Soroban AMM smart contract
│       │       │   └── test.rs     # Contract unit tests
│       │       └── Cargo.toml
│       ├── frontend/               # React + Vite Web3 App
│       │   └── src/
│       │       ├── config/
│       │       │   └── constants.js     # Network config + CONTRACT_ID
│       │       ├── hooks/
│       │       │   └── useFreighter.js  # Freighter wallet hook
│       │       ├── services/
│       │       │   └── stellar.js       # Soroban + Horizon service layer
│       │       ├── utils/
│       │       │   └── helpers.js       # Display utilities
│       │       ├── App.jsx              # Main app with on-chain logic
│       │       └── main.jsx
│       └── backend/                # Node.js + Express (off-chain helpers)
│           └── src/
│               └── services/
│                   └── ammService.js
├── Cargo.toml                      # Rust workspace
└── README.md
```

---

## Soroban AMM Contract

Located at `contracts/amm/src/lib.rs`.

### Storage Layout

| Key | Type | Description |
|-----|------|-------------|
| `Admin` | `Address` | Contract admin |
| `TokenA` | `Address` | Token A SAC address |
| `TokenB` | `Address` | Token B SAC address |
| `ReserveA` | `i128` | Current Token A reserve |
| `ReserveB` | `i128` | Current Token B reserve |
| `TotalShares` | `i128` | Total LP shares minted |
| `Shares(Address)` | `i128` | Per-user LP share balance |

### Contract Functions

| Function | Description |
|----------|-------------|
| `initialize(admin, token_a, token_b)` | One-time setup. Sets admin and token addresses. |
| `deposit(to, amount_a, amount_b, min_a, min_b) → i128` | Add liquidity. Transfers tokens from `to` to contract. Mints LP shares proportionally (geometric mean for first deposit). |
| `swap(to, buy_a, out_amount, max_in) → i128` | Constant-product swap with 0.3% fee (997/1000 factor). `buy_a=true` receives Token A, pays Token B. Enforces slippage via `max_in`. |
| `withdraw(to, share_amount, min_a, min_b) → (i128, i128)` | Burn LP shares, return proportional tokens. Enforces minimum thresholds. |
| `get_reserves() → (i128, i128)` | Read-only: returns current (ReserveA, ReserveB). |
| `get_user_shares(user) → i128` | Read-only: returns LP share balance for user. |
| `get_total_shares() → i128` | Read-only: returns total LP supply. |

### AMM Formula

**Constant product**: `x * y = k`

**Swap with 0.3% fee** (buy Token A):
```
in_b = (res_b * out_a * 1000) / ((res_a - out_a) * 997) + 1
```

**First deposit shares** (geometric mean):
```
shares = sqrt(amount_a * amount_b)
```

**Subsequent deposit shares** (minimum proportional):
```
shares = min(amount_a * total / res_a, amount_b * total / res_b)
```

---

## Freighter Wallet Integration

The `useFreighter.js` hook:
1. Detects whether the Freighter browser extension is installed
2. Calls `requestAccess()` to prompt for wallet permission
3. Returns the live public key (`G...`) from the connected account
4. Fetches network details (name + passphrase)
5. Provides `connect()` / `disconnect()` methods

### Transaction Flow

```
User Input (amount)
   │
   ▼
stellar.js — computeOutputFromInput() using on-chain reserves
   │
   ▼
stellar.js — build Soroban TransactionBuilder
   │
   ▼
Soroban RPC — simulateTransaction (get footprint + auth)
   │
   ▼
stellar.js — assembleTransaction (merge resources)
   │
   ▼
Freighter — signTransaction(xdr, { networkPassphrase })
   │  (user confirms in extension popup)
   ▼
Soroban RPC — sendTransaction(signedXDR)
   │
   ▼
Poll — getTransaction(hash) every 2s until CONFIRMED
   │
   ▼
UI — show real 64-char hash + Stellar Expert link
   │
   ▼
Refresh — getPoolReserves() + getXlmBalance() from chain
```

---

## Deployment Instructions (Run These Manually)

### Prerequisites

- Rust 1.84+ (you have 1.97.1 ✓)
- `wasm32v1-none` target installed (`rustup target add wasm32v1-none`) ✓

### Step 1: Verify the WASM Binary

The contract has already been compiled. The WASM binary is at:
```
target/wasm32v1-none/release/soroban_amm.wasm  (18KB)
```

To recompile:
```bash
cd miniswap/miniswap-amm
cargo build --release --target wasm32v1-none
```

### Step 2: Install Stellar CLI

```bash
cargo install stellar-cli --version 22.7.0 --locked
```

Or via homebrew (if available on your system):
```bash
brew install stellar/tap/stellar-cli
```

### Step 3: Generate a Deployer Keypair

```bash
stellar keys generate deployer --network testnet
```

### Step 4: Fund the Account via Friendbot

```bash
stellar keys fund deployer --network testnet
```

### Step 5: Deploy the Contract

Run from the `miniswap/miniswap-amm` directory:
```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/soroban_amm.wasm \
  --source deployer \
  --network testnet
```

**Copy the Contract ID from the output** (it starts with `C...`).

### Step 6: Initialize the Contract

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin <DEPLOYER_ADDRESS> \
  --token_a <TOKEN_A_ADDRESS> \
  --token_b <TOKEN_B_ADDRESS>
```

Where `TOKEN_A_ADDRESS` and `TOKEN_B_ADDRESS` are Stellar Asset Contract (SAC) addresses for your tokens on Testnet.

### Step 7: Update constants.js

Open `frontend/src/config/constants.js` and set:

```js
export const CONTRACT_ID = '<YOUR_REAL_CONTRACT_ID>';
```

The deployment banner will disappear and all on-chain features will activate.

---

## Local Setup

### Prerequisites
- Node.js 18+
- npm
- Freighter browser extension (install from [freighter.app](https://freighter.app))
- Set Freighter to **Testnet** network

### Frontend

```bash
cd miniswap/miniswap-amm/frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend (off-chain AMM helpers)

```bash
cd miniswap/miniswap-amm/backend
npm install
npm start
# Runs at http://localhost:5000
```

---

## Testnet Testing Instructions

1. Install [Freighter](https://freighter.app) browser extension
2. Open Freighter → Settings → Network → Switch to **Testnet**
3. Get Testnet XLM from [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
4. Run the frontend: `npm run dev`
5. Click **Connect Wallet** → Freighter popup → Approve
6. Navigate to **Swap** tab → enter amount → click Swap
7. Freighter will show a transaction approval popup
8. Confirm → wait ~5-10 seconds for ledger confirmation
9. A real 64-character transaction hash and Stellar Expert link will appear
10. Click the explorer link to verify the transaction on Testnet

---

## Build Instructions

```bash
cd miniswap/miniswap-amm/frontend
npm install
npm run build
# Output in dist/
```

## CI/CD

GitHub Actions automatically builds the frontend on every push to `main`.
See `.github/workflows/build.yml`.

---

## Tech Stack

### Frontend
- **Framework**: React 19 + Vite 8
- **Wallet SDK**: `@stellar/freighter-api` v6
- **Stellar SDK**: `@stellar/stellar-sdk` (Soroban RPC + transaction building)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Testing**: Vitest + JSDOM + React Testing Library

### Backend
- **Framework**: Node.js + Express
- **Architecture**: Layered MVC (off-chain helpers, not used for on-chain logic)

### Contract
- **Language**: Rust (Soroban SDK 26.0.0)
- **Target**: `wasm32v1-none`
- **Compiled**: `soroban_amm.wasm` (18 KB)

---

<p align="center">
  Crafted by Karman Singh Chandhok & pair-programmed with Antigravity AI
</p>
