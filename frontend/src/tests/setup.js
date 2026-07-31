import '@testing-library/jest-dom';

// Mock window.freighter presence
if (typeof window !== 'undefined') {
  window.freighter = {
    isConnected: () => Promise.resolve(true),
    getPublicKey: () => Promise.resolve('GBMK...WXYZ'),
    getNetwork: () => Promise.resolve('TESTNET'),
  };
}
