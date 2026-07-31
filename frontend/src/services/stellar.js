/**
 * StellarSwap Pro — Stellar + Soroban Service Layer
 *
 * This module handles ALL blockchain interactions:
 *   - Fetching on-chain pool reserves via Soroban RPC simulation
 *   - Building Soroban contract invocation transactions (XDR)
 *   - Sending XDR to Freighter for signing
 *   - Submitting signed transactions to Stellar Testnet
 *   - Polling for ledger confirmation
 *   - Establishing classic trustlines via Horizon + Freighter
 *   - Returning REAL transaction hashes (64 hex characters)
 *
 * IMPORTANT: This file never generates fake transaction hashes.
 * If a submission fails, the real error is thrown and surfaced to the UI.
 */

import {
  Contract,
  Keypair,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
  BASE_FEE,
  Asset,
  Operation,
  Horizon,
} from '@stellar/stellar-sdk';

import { signTransaction } from '@stellar/freighter-api';

import {
  TESTNET_RPC_URL,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  CONTRACT_ID,
  USDC_ISSUER_TESTNET,
  MAX_LEDGER_ADVANCE,
  STELLAR_EXPERT_TX,
} from '../config/constants.js';

// ── Soroban RPC server instance ───────────────────────────────────────────
const server = new SorobanRpc.Server(TESTNET_RPC_URL, { allowHttp: false });

// ── Guard: throw a clear error if contract is not yet deployed ────────────
function assertContractDeployed() {
  if (!CONTRACT_ID) {
    throw new Error(
      'CONTRACT_ID is not set. The Soroban AMM contract has not been deployed yet. ' +
      'Please follow the deployment instructions in the README and update ' +
      'src/config/constants.js with the real contract ID.'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TRUSTLINE & CLASSIC ASSET HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if a user address has an active trustline for exact asset
 * USDC:GCX2VFJGK2IT5OWGQGDFZWDQRZAFUJSMLMI3HVIMGTZFMSJOFTGSGWQ3.
 *
 * @param {string} userAddress
 * @returns {Promise<{ hasTrustline: boolean, balance: string, accountExists: boolean }>}
 */
export async function checkTestUsdcTrustline(userAddress) {
  if (!userAddress) return { hasTrustline: false, balance: '0', accountExists: false };
  try {
    const horizonServer = new Horizon.Server(HORIZON_URL);
    const account = await horizonServer.loadAccount(userAddress);
    const usdcBalance = account.balances?.find(
      b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER_TESTNET
    );
    if (usdcBalance) {
      return { hasTrustline: true, balance: usdcBalance.balance, accountExists: true };
    }
    return { hasTrustline: false, balance: '0', accountExists: true };
  } catch (err) {
    if (err?.response?.status === 404) {
      return { hasTrustline: false, balance: '0', accountExists: false };
    }
    throw new Error(`Failed to check trustline status: ${err.message}`);
  }
}

/**
 * Build a classic ChangeTrust operation for exact asset
 * USDC:GCX2VFJGK2IT5OWGQGDFZWDQRZAFUJSMLMI3HVIMGTZFMSJOFTGSGWQ3,
 * prompt Freighter for user signature, and submit to Horizon Testnet.
 *
 * @param {string} userAddress - User's connected Freighter public key
 * @returns {Promise<{ hash: string, explorerUrl: string }>}
 */
export async function establishTestUsdcTrustline(userAddress) {
  if (!userAddress) throw new Error('Wallet not connected');

  const horizonServer = new Horizon.Server(HORIZON_URL);
  let account;
  try {
    account = await horizonServer.loadAccount(userAddress);
  } catch (err) {
    if (err?.response?.status === 404) {
      throw new Error(
        'Account does not exist on Testnet yet. Please fund your wallet with Testnet XLM first.'
      );
    }
    throw err;
  }

  const usdcAsset = new Asset('USDC', USDC_ISSUER_TESTNET);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(MAX_LEDGER_ADVANCE)
    .build();

  const signResult = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(signResult.error.message || 'User rejected the trustline transaction in Freighter');
  }

  const signedTx = new Transaction(signResult.signedTxXdr, NETWORK_PASSPHRASE);
  const submitResult = await horizonServer.submitTransaction(signedTx);

  return {
    hash: submitResult.hash,
    explorerUrl: `${STELLAR_EXPERT_TX}/${submitResult.hash}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// READ-ONLY CALLS (via RPC simulation — no signing required)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current pool reserves from the on-chain contract.
 * Uses Soroban RPC `simulateTransaction` to call `get_reserves`.
 *
 * @returns {Promise<{ reserveA: bigint, reserveB: bigint }>}
 */
export async function getPoolReserves() {
  assertContractDeployed();

  // Build a read-only simulate call from a throwaway keypair
  const fakeSource = Keypair.random();
  const account = await server.getAccount(fakeSource.publicKey()).catch(() => {
    // If the throwaway account doesn't exist, build a synthetic account
    return { accountId: () => fakeSource.publicKey(), sequenceNumber: () => '0', incrementSequenceNumber: () => {} };
  });

  const contract = new Contract(CONTRACT_ID);
  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_reserves'))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(txBuilder);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Failed to fetch pool reserves: ${simResult.error}`);
  }

  // The contract returns (i128, i128) tuple
  const resultVal = simResult.result?.retval;
  if (!resultVal) {
    throw new Error('No return value from get_reserves simulation');
  }

  const [resA, resB] = scValToNative(resultVal);
  return { reserveA: BigInt(resA), reserveB: BigInt(resB) };
}

/**
 * Fetch the LP share balance for a given user address.
 *
 * @param {string} userAddress - Stellar public key (G...)
 * @returns {Promise<bigint>}
 */
export async function getUserShares(userAddress) {
  assertContractDeployed();

  const fakeSource = Keypair.random();
  const account = await server.getAccount(fakeSource.publicKey()).catch(() => ({
    accountId: () => fakeSource.publicKey(),
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  }));

  const contract = new Contract(CONTRACT_ID);
  const userScVal = new Address(userAddress).toScVal();

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_user_shares', userScVal))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(txBuilder);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Failed to fetch user shares: ${simResult.error}`);
  }

  const resultVal = simResult.result?.retval;
  if (!resultVal) return 0n;

  return BigInt(scValToNative(resultVal));
}

/**
 * Fetch the XLM native balance for an address via Horizon.
 * Returns the balance in XLM (as a string).
 *
 * @param {string} address - Stellar public key
 * @returns {Promise<string>}
 */
export async function getXlmBalance(address) {
  const response = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!response.ok) {
    throw new Error(`Horizon account lookup failed: ${response.statusText}`);
  }
  const data = await response.json();
  const xlmBalance = data.balances?.find(b => b.asset_type === 'native');
  return xlmBalance ? xlmBalance.balance : '0';
}

// ─────────────────────────────────────────────────────────────────────────
// TRANSACTION BUILDERS + FREIGHTER SIGN + SUBMIT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Prepare, sign via Freighter, submit, and confirm a Soroban contract call.
 *
 * Flow:
 *   1. Build unsigned transaction with contract invocation
 *   2. simulateTransaction → get resource footprint + auth
 *   3. assembleTransaction → merge resources into tx
 *   4. signTransaction via @stellar/freighter-api
 *   5. Submit to Stellar Testnet RPC
 *   6. Poll for ledger confirmation (getTransaction)
 *   7. Return real 64-character transaction hash
 *
 * @param {Transaction} tx - Unsigned transaction built by caller
 * @returns {Promise<{ hash: string, explorerUrl: string }>}
 */
async function prepareSignAndSubmit(tx) {
  // Step 2: Simulate to get footprint + auth
  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Transaction simulation failed: ${simResult.error}`);
  }

  if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
    throw new Error(`Unexpected simulation result — cannot proceed`);
  }

  // Step 3: Assemble (merges resources and auth into tx)
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // Step 4: Sign via Freighter
  const signResult = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(signResult.error.message || 'User rejected or Freighter error');
  }

  // Reconstruct signed tx from XDR
  const signedTx = new Transaction(signResult.signedTxXdr, NETWORK_PASSPHRASE);

  // Step 5: Submit
  let sendResult;
  try {
    sendResult = await server.sendTransaction(signedTx);
  } catch (err) {
    throw new Error(`Failed to submit transaction: ${err.message}`);
  }

  if (sendResult.status === 'ERROR') {
    const errorMsg = sendResult.errorResult?.result?.results?.[0]?.tr?.invokeHostFunctionResult
      ? JSON.stringify(sendResult.errorResult)
      : sendResult.status;
    throw new Error(`Transaction submission rejected: ${errorMsg}`);
  }

  const txHash = sendResult.hash;

  // Step 6: Poll for confirmation
  let status = sendResult.status;
  let attempts = 0;
  const MAX_ATTEMPTS = 30; // 30 * 2s = up to 60s

  while (status === 'PENDING' || status === 'NOT_FOUND') {
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error(`Transaction ${txHash} timed out waiting for confirmation. Check the explorer: ${STELLAR_EXPERT_TX}/${txHash}`);
    }
    await new Promise(r => setTimeout(r, 2000));
    const pollResult = await server.getTransaction(txHash);
    status = pollResult.status;
    if (pollResult.status === 'FAILED') {
      throw new Error(`Transaction failed on-chain. Hash: ${txHash}. Explorer: ${STELLAR_EXPERT_TX}/${txHash}`);
    }
    attempts++;
  }

  return {
    hash: txHash,
    explorerUrl: `${STELLAR_EXPERT_TX}/${txHash}`,
  };
}

/**
 * Build the transaction for a pool deposit and submit it via Freighter.
 *
 * @param {string} senderAddress - Connected Freighter wallet public key
 * @param {bigint} amountA - Token A amount (in stroops/raw integer units)
 * @param {bigint} amountB - Token B amount
 * @param {bigint} minA - Minimum acceptable amount A (slippage protection)
 * @param {bigint} minB - Minimum acceptable amount B
 * @returns {Promise<{ hash: string, explorerUrl: string }>}
 */
export async function depositLiquidity(senderAddress, amountA, amountB, minA = 0n, minB = 0n) {
  assertContractDeployed();

  const account = await server.getAccount(senderAddress);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'deposit',
        new Address(senderAddress).toScVal(),          // to
        nativeToScVal(amountA, { type: 'i128' }),       // amount_a
        nativeToScVal(amountB, { type: 'i128' }),       // amount_b
        nativeToScVal(minA, { type: 'i128' }),           // min_a
        nativeToScVal(minB, { type: 'i128' }),           // min_b
      )
    )
    .setTimeout(MAX_LEDGER_ADVANCE)
    .build();

  return prepareSignAndSubmit(tx);
}

/**
 * Build the transaction for a swap and submit it via Freighter.
 *
 * @param {string} senderAddress - Connected wallet public key
 * @param {boolean} buyA - true = buy token A, false = buy token B
 * @param {bigint} outAmount - Desired output amount
 * @param {bigint} maxIn - Maximum input (slippage limit)
 * @returns {Promise<{ hash: string, explorerUrl: string }>}
 */
export async function executeSwap(senderAddress, buyA, outAmount, maxIn) {
  assertContractDeployed();

  const account = await server.getAccount(senderAddress);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'swap',
        new Address(senderAddress).toScVal(),   // to
        nativeToScVal(buyA, { type: 'bool' }),   // buy_a
        nativeToScVal(outAmount, { type: 'i128' }), // out_amount
        nativeToScVal(maxIn, { type: 'i128' }),   // max_in
      )
    )
    .setTimeout(MAX_LEDGER_ADVANCE)
    .build();

  return prepareSignAndSubmit(tx);
}

/**
 * Build the transaction to withdraw liquidity and submit via Freighter.
 *
 * @param {string} senderAddress - Connected wallet public key
 * @param {bigint} shareAmount - LP shares to burn
 * @param {bigint} minA - Minimum acceptable token A returned
 * @param {bigint} minB - Minimum acceptable token B returned
 * @returns {Promise<{ hash: string, explorerUrl: string }>}
 */
export async function withdrawLiquidity(senderAddress, shareAmount, minA = 0n, minB = 0n) {
  assertContractDeployed();

  const account = await server.getAccount(senderAddress);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'withdraw',
        new Address(senderAddress).toScVal(),
        nativeToScVal(shareAmount, { type: 'i128' }),
        nativeToScVal(minA, { type: 'i128' }),
        nativeToScVal(minB, { type: 'i128' }),
      )
    )
    .setTimeout(MAX_LEDGER_ADVANCE)
    .build();

  return prepareSignAndSubmit(tx);
}

/**
 * Compute expected swap output using the constant-product formula
 * PURELY for UI preview (no state change).
 *
 * Formula (with 0.3% fee → 997/1000):
 *   in_amount = (res_in * out_amount * 1000) / ((res_out - out_amount) * 997) + 1
 *
 * @param {bigint} reserveIn  - Reserve of the input token
 * @param {bigint} reserveOut - Reserve of the output token
 * @param {bigint} outAmount  - Desired output amount
 * @returns {bigint} Required input amount
 */
export function computeRequiredInput(reserveIn, reserveOut, outAmount) {
  if (outAmount <= 0n || outAmount >= reserveOut) return 0n;
  const num = reserveIn * outAmount * 1000n;
  const den = (reserveOut - outAmount) * 997n;
  return num / den + 1n;
}

/**
 * Given an exact input amount, compute expected output (for UI display).
 *
 * Formula (with 0.3% fee → 997/1000):
 *   out_amount = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997)
 *
 * @param {bigint} reserveIn
 * @param {bigint} reserveOut
 * @param {bigint} amountIn - Exact input
 * @returns {bigint}
 */
export function computeOutputFromInput(reserveIn, reserveOut, amountIn) {
  if (amountIn <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator = reserveOut * amountInWithFee;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

/**
 * Convert a floating-point token amount to raw integer units (7 decimals).
 * Stellar native amounts use 7 decimal places (1 XLM = 10,000,000 stroops).
 */
export function toRawAmount(floatAmount) {
  return BigInt(Math.round(parseFloat(floatAmount) * 1e7));
}

/**
 * Convert raw integer units back to a human-readable string.
 */
export function fromRawAmount(rawAmount) {
  return (Number(rawAmount) / 1e7).toFixed(7).replace(/\.?0+$/, '');
}
