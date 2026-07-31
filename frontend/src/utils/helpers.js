/**
 * Helper utilities for StellarSwap Pro / MiniSwap AMM
 */

/**
 * Shortens a Stellar public address (G...) to GABCD...WXYZ
 * @param {string} address
 * @returns {string}
 */
export function shortenAddress(address) {
  if (!address || typeof address !== 'string') return '';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Shortens a 64-character Stellar transaction hash for display.
 * e.g. "a3fd91e2...b7c4e451"
 * @param {string} hash - 64-character hex transaction hash
 * @returns {string}
 */
export function shortenTxHash(hash) {
  if (!hash || typeof hash !== 'string') return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

/**
 * Calculates output amount for swap preview (off-chain only, using cached reserves).
 * The actual on-chain calculation is done by the Soroban contract.
 * @param {number|string} amount
 * @param {number} rate
 * @returns {string}
 */
export function calculateSwapOutput(amount, rate) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '';
  return (num * rate).toFixed(7);
}

/**
 * Calculates swap fees for display
 * @param {number|string} amount
 * @param {number} feePercent (e.g., 0.3)
 * @returns {string}
 */
export function calculateFee(amount, feePercent = 0.3) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '—';
  return (num * (feePercent / 100)).toFixed(7);
}

/**
 * Formats a number/string as USD currency (e.g. $50,000)
 * @param {number|string} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0';
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Formats percentage change (e.g. +12.4% or -2.5% or Stable)
 * @param {string|number} change
 * @returns {string}
 */
export function formatPercentChange(change) {
  if (change === 'Stable' || change === 'stable') return 'Stable';
  const str = String(change);
  if (str.endsWith('%')) return str;
  const num = parseFloat(change);
  if (isNaN(num)) return str;
  return num >= 0 ? `+${num}%` : `${num}%`;
}
