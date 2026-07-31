/**
 * StellarSwap Pro — Network & Contract Configuration
 *
 * Real Stellar Testnet Deployment Configuration
 */

// Stellar Testnet Soroban RPC endpoint
export const TESTNET_RPC_URL = 'https://soroban-testnet.stellar.org';

// Stellar Testnet Horizon REST API
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Official Stellar Testnet network passphrase
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

/**
 * CONTRACT_ID — Real Soroban AMM contract deployed to Stellar Testnet
 */
export const CONTRACT_ID = 'CAP7XKVIR32BF4RV2WLPTP5GMEFMFZYJMIP4MQHSW2NZJGKWRXMDKK3L';

// Stellar Expert testnet explorer base URLs
export const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/testnet';
export const STELLAR_EXPERT_TX = `${STELLAR_EXPERT_BASE}/tx`;
export const STELLAR_EXPERT_CONTRACT = `${STELLAR_EXPERT_BASE}/contract`;

// Native XLM asset contract on Testnet (Stellar Asset Contract wrapper)
export const XLM_SAC_TESTNET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Real Test USDC issuer and SAC on Stellar Testnet for this AMM pool
export const USDC_ISSUER_TESTNET = 'GCX2VFJGK2IT5OWGQGDFZWDQRZAFUJSMLMI3HVIMGTZFMSJOFTGSGWQ3';
export const USDC_SAC_TESTNET = 'CDO2QBWEPOA4HGJ4VMNC26MYRHHRIEK354X5TQQAYQTOKBFSKWMZUH77';
export const USDC_ASSET_CODE = 'USDC';

// Soroban transaction options
export const TX_FEE = '100'; // stroops (0.00001 XLM base fee)
export const MAX_LEDGER_ADVANCE = 60; // max ledger offset for transaction validity window
