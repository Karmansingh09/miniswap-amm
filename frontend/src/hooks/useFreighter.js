/**
 * useFreighter — Freighter wallet integration hook
 *
 * Wraps @stellar/freighter-api to provide:
 *   - connect()         → requests wallet access, returns { address, network }
 *   - disconnect()      → clears local wallet state
 *   - walletAddress     → full Stellar public key (G…)
 *   - network           → e.g. "TESTNET" | "PUBLIC"
 *   - networkPassphrase → full passphrase string
 *   - isConnected       → boolean
 *   - isLoading         → boolean (while waiting for extension)
 *   - error             → string | null
 *   - freighterInstalled → boolean (extension present)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  isConnected as freighterIsConnected,
  requestAccess,
  getNetworkDetails,
} from '@stellar/freighter-api';

export function useFreighter() {
  const [walletAddress,      setWalletAddress]      = useState('');
  const [network,            setNetwork]            = useState('');
  const [networkPassphrase,  setNetworkPassphrase]  = useState('');
  const [networkUrl,         setNetworkUrl]         = useState('');
  const [isConnectedState,   setIsConnectedState]   = useState(false);
  const [isLoading,          setIsLoading]          = useState(false);
  const [error,              setError]              = useState(null);
  const [freighterInstalled, setFreighterInstalled] = useState(false);

  /* ── Check whether the Freighter extension is installed on mount ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await freighterIsConnected();
        if (!cancelled) {
          // extension present if no node-environment error
          setFreighterInstalled(!result.error);
        }
      } catch {
        if (!cancelled) setFreighterInstalled(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Connect ── */
  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      /* 1. Check extension presence */
      const connResult = await freighterIsConnected();
      if (connResult.error || !connResult.isConnected) {
        throw new Error('Freighter extension not found. Please install it from freighter.app');
      }

      /* 2. Request wallet access → returns { address } */
      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error(accessResult.error.message || 'User rejected the connection request');
      }
      const address = accessResult.address;
      if (!address) {
        throw new Error('No address returned from Freighter');
      }

      /* 3. Fetch network details */
      const netResult = await getNetworkDetails();
      if (netResult.error) {
        throw new Error(netResult.error.message || 'Failed to fetch network details');
      }

      setWalletAddress(address);
      setNetwork(netResult.network);          // e.g. "TESTNET"
      setNetworkPassphrase(netResult.networkPassphrase);
      setNetworkUrl(netResult.networkUrl);
      setIsConnectedState(true);
    } catch (err) {
      setError(err.message || 'Connection failed');
      setIsConnectedState(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ── Disconnect ── */
  const disconnect = useCallback(() => {
    setWalletAddress('');
    setNetwork('');
    setNetworkPassphrase('');
    setNetworkUrl('');
    setIsConnectedState(false);
    setError(null);
  }, []);

  /* ── Shorten address for display, e.g. GABCD…XYZ ── */
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : '';

  return {
    connect,
    disconnect,
    walletAddress,
    shortAddress,
    network,
    networkPassphrase,
    networkUrl,
    isConnected: isConnectedState,
    isLoading,
    error,
    freighterInstalled,
  };
}
