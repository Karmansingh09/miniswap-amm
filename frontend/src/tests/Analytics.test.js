import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentChange } from '../utils/helpers';

describe('Analytics Utility Tests', () => {
  it('should format currency values as USD strings', () => {
    expect(formatCurrency(50000)).toBe('$50,000');
    expect(formatCurrency('12450')).toBe('$12,450');
    expect(formatCurrency(null)).toBe('$0');
  });

  it('should format percent change labels correctly', () => {
    expect(formatPercentChange('Stable')).toBe('Stable');
    expect(formatPercentChange(12.4)).toBe('+12.4%');
    expect(formatPercentChange(-3.5)).toBe('-3.5%');
  });
});
