import { describe, it, expect } from 'vitest';
import { shortenAddress } from '../utils/helpers';

describe('Wallet Integration Tests', () => {
  it('should shorten public address correctly', () => {
    const address = 'GD3W5VMT5FCRGOH72Q3SOP2KIPW7PLU6EXXQCPWJ42KGLK2F4OUPYVXY';
    expect(shortenAddress(address)).toBe('GD3W5V…YVXY');
  });

  it('should return empty string for null or undefined address', () => {
    expect(shortenAddress(null)).toBe('');
    expect(shortenAddress(undefined)).toBe('');
  });

  it('should return the original address if it is already short', () => {
    expect(shortenAddress('GD3W5V')).toBe('GD3W5V');
  });
});
