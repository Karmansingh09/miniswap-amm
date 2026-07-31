import { describe, it, expect } from 'vitest';
import {
  calculateSwapOutput,
  calculateFee,
  shortenTxHash,
} from '../utils/helpers';

describe('Swap Logic Tests', () => {
  it('should calculate swap output preview with 7 decimal places', () => {
    // These are OFF-CHAIN preview calculations only.
    // Real swap amounts are computed by the Soroban contract on-chain.
    expect(calculateSwapOutput(100, 0.982)).toBe('98.2000000');
    expect(calculateSwapOutput('50', 0.982)).toBe('49.1000000');
    expect(calculateSwapOutput(0, 0.982)).toBe('');
    expect(calculateSwapOutput(-1, 0.982)).toBe('');
  });

  it('should calculate swap fee display with 7 decimal places', () => {
    // 0.3% fee on 100 = 0.3
    expect(calculateFee(100, 0.3)).toBe('0.3000000');
    // 0.3% fee on 50 = 0.15
    expect(calculateFee(50, 0.3)).toBe('0.1500000');
    expect(calculateFee(0, 0.3)).toBe('—');
  });

  it('should shorten a 64-char transaction hash for display', () => {
    const realHash = 'a3fd91e24b7c4e4519abc2abf1283cd9baa8839fc8d5ef01234567890abcdef12';
    const shortened = shortenTxHash(realHash);
    // shortenTxHash: first 8 chars + … + last 8 chars
    expect(shortened).toBe('a3fd91e2…abcdef12');
    expect(shortened.includes('…')).toBe(true);
    expect(shortened.length).toBeLessThan(realHash.length);
  });

  it('should return empty string for null/empty hash', () => {
    expect(shortenTxHash('')).toBe('');
    expect(shortenTxHash(null)).toBe('');
  });
});
