import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowUpDown,
  Droplets,
  BarChart3,
  Clock,
  ChevronDown,
  Zap,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Star,
  Activity,
  Shield,
  AlertCircle,
  ExternalLink,
  Copy,
  CheckCircle,
  Globe,
  Wifi,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useFreighter } from './hooks/useFreighter';
import {
  shortenAddress,
  shortenTxHash,
  calculateFee,
  formatCurrency,
  formatPercentChange,
} from './utils/helpers';
import {
  getPoolReserves,
  getXlmBalance,
  getUserShares,
  depositLiquidity,
  executeSwap,
  withdrawLiquidity,
  computeOutputFromInput,
  computeRequiredInput,
  toRawAmount,
  fromRawAmount,
  checkTestUsdcTrustline,
  establishTestUsdcTrustline,
} from './services/stellar';
import { CONTRACT_ID, USDC_ISSUER_TESTNET, STELLAR_EXPERT_TX, STELLAR_EXPERT_CONTRACT } from './config/constants';

/* ─── Animation variants ─────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Nav tabs ───────────────────────────────── */
const NAV_TABS = [
  { id: 'wallet',       label: 'Wallet',       icon: Wallet      },
  { id: 'swap',         label: 'Swap',         icon: ArrowUpDown },
  { id: 'liquidity',    label: 'Liquidity',    icon: Droplets    },
  { id: 'analytics',   label: 'Analytics',    icon: BarChart3   },
  { id: 'transactions', label: 'Transactions', icon: Clock       },
];

/* ─── Network badge colour ───────────────────── */
function networkStyle(net) {
  const n = (net || '').toUpperCase();
  if (n === 'TESTNET') return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', color: '#fbbf24' };
  if (n === 'PUBLIC')  return { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)',  color: '#34d399' };
  return { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.35)', color: '#818cf8' };
}

/* ─── Responsive Error Component ─────────────────────── */
function ResponsiveError({ title, message, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!message) return null;

  const isLongError = message.length > 90 || message.includes('\n') || message.includes('{') || message.includes('simulation');
  const summary = isLongError
    ? message.split('.')[0] + (message.includes('.') ? '.' : '')
    : message;

  return (
    <div className="error-box" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#f87171' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
          <div className="break-word" style={{ color: '#fca5a5', lineHeight: 1.4, fontSize: 13 }}>
            {summary}
          </div>
          {isLongError && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}
          {isLongError && showDetails && (
            <pre className="error-details-pre">
              {message}
            </pre>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════ */
export default function App() {
  const [activeTab,  setActiveTab]  = useState('swap');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount,   setToAmount]   = useState('');
  const [fromToken,  setFromToken]  = useState('XLM');
  const [toToken,    setToToken]    = useState('USDC');
  const [lpAmount,   setLpAmount]   = useState('');
  const [lpAmountB,  setLpAmountB]  = useState('');
  const [swapping,   setSwapping]   = useState(false);
  const [swapMsg,    setSwapMsg]    = useState({ type: '', text: '' }); // type: 'success'|'error'
  const [lpMsg,      setLpMsg]      = useState({ type: '', text: '' });
  const [copied,     setCopied]     = useState(false);

  /* ── On-chain state ── */
  const [reserveA,    setReserveA]    = useState(null); // bigint or null
  const [reserveB,    setReserveB]    = useState(null);
  const [xlmBalance,  setXlmBalance]  = useState(null); // string from Horizon
  const [userShares,  setUserShares]  = useState(null); // bigint
  const [reserveLoading, setReserveLoading] = useState(false);
  const [reserveError,   setReserveError]   = useState('');

  /* ── Trustline state ── */
  const [trustlineState, setTrustlineState] = useState({ hasTrustline: false, balance: '0', accountExists: true });
  const [trustlineMsg,   setTrustlineMsg]   = useState({ type: '', text: '', hash: '', explorerUrl: '' });

  /* ── Transaction history (only real txs; starts empty) ── */
  const [transactionsList, setTransactionsList] = useState([]);

  /* ── Real Freighter wallet hook ── */
  const {
    connect,
    disconnect,
    walletAddress,
    shortAddress: freighterShortAddress,
    network: freighterNetwork,
    networkUrl,
    isConnected,
    isLoading: walletLoading,
    error: walletError,
    freighterInstalled,
  } = useFreighter();

  /* ── Only show contract-deployed banner if it's not set ── */
  const contractDeployed = CONTRACT_ID !== null;

  /* ── Fetch on-chain pool state ── */
  const refreshPoolState = useCallback(async () => {
    if (!contractDeployed) return;
    setReserveLoading(true);
    setReserveError('');
    try {
      const { reserveA: ra, reserveB: rb } = await getPoolReserves();
      setReserveA(ra);
      setReserveB(rb);
    } catch (err) {
      setReserveError(err.message);
    } finally {
      setReserveLoading(false);
    }
  }, [contractDeployed]);

  /* ── Fetch user balances when wallet connects ── */
  const refreshUserState = useCallback(async () => {
    if (!isConnected || !walletAddress) return;
    try {
      const bal = await getXlmBalance(walletAddress);
      setXlmBalance(bal);
    } catch {
      setXlmBalance(null);
    }
    try {
      const tl = await checkTestUsdcTrustline(walletAddress);
      setTrustlineState(tl);
    } catch {
      setTrustlineState({ hasTrustline: false, balance: '0', accountExists: true });
    }
    if (contractDeployed) {
      try {
        const shares = await getUserShares(walletAddress);
        setUserShares(shares);
      } catch {
        setUserShares(null);
      }
    }
  }, [isConnected, walletAddress, contractDeployed]);

  /* ── Establish exact Test USDC Trustline via Freighter ── */
  async function handleEstablishTrustline() {
    if (!isConnected || !walletAddress) return;
    setTrustlineMsg({ type: '', text: '', hash: '', explorerUrl: '' });
    setSwapping(true);
    try {
      const { hash, explorerUrl } = await establishTestUsdcTrustline(walletAddress);
      const newTx = {
        id: hash,
        type: 'ChangeTrust',
        from: 'User Wallet',
        to: `USDC:${USDC_ISSUER_TESTNET.slice(0, 4)}…`,
        time: new Date().toLocaleTimeString(),
        status: 'success',
        hash,
        explorerUrl,
        network: 'Testnet',
      };
      setTransactionsList(prev => [newTx, ...prev]);
      setTrustlineMsg({
        type: 'success',
        text: '✅ Trustline established for Test USDC!',
        hash,
        explorerUrl,
      });
      await refreshUserState();
    } catch (err) {
      setTrustlineMsg({ type: 'error', text: `❌ Trustline creation failed: ${err.message}` });
    } finally {
      setSwapping(false);
    }
  }

  /* ── Load pool reserves on mount and when contract changes ── */
  useEffect(() => {
    refreshPoolState();
  }, [refreshPoolState]);

  /* ── Refresh user state when wallet connects ── */
  useEffect(() => {
    refreshUserState();
  }, [refreshUserState]);

  /* ── Copy address to clipboard ── */
  async function copyAddress() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ── Wallet connect / disconnect toggle ── */
  async function handleWalletClick() {
    if (isConnected) {
      disconnect();
      setXlmBalance(null);
      setUserShares(null);
    } else {
      await connect();
    }
  }

  /* ── Real-time swap output preview using on-chain reserves ── */
  function handleFromAmountChange(v) {
    setFromAmount(v);
    const amtRaw = toRawAmount(v);
    if (amtRaw <= 0n || reserveA === null || reserveB === null) {
      setToAmount('');
      return;
    }
    const [resIn, resOut] = fromToken === 'XLM'
      ? [reserveA, reserveB]
      : [reserveB, reserveA];
    const outRaw = computeOutputFromInput(resIn, resOut, amtRaw);
    setToAmount(fromRawAmount(outRaw));
  }

  function flipTokens() {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  }

  /* ── Real Swap via Soroban ── */
  async function handleSwap() {
    if (!fromAmount || !isConnected) return;
    if (!contractDeployed) {
      setSwapMsg({ type: 'error', text: 'Contract not deployed. Follow the deployment instructions in README.' });
      return;
    }
    setSwapping(true);
    setSwapMsg({ type: '', text: '' });

    try {
      const amtRaw = toRawAmount(fromAmount);
      const outRaw = toRawAmount(toAmount);

      const buyA = toToken === 'XLM';
      const slippageFactor = 101n;
      const maxIn = (amtRaw * slippageFactor) / 100n;

      const { hash, explorerUrl } = await executeSwap(
        walletAddress,
        buyA,
        outRaw,
        maxIn,
      );

      const newTx = {
        id: hash,
        type: 'Swap',
        from: `${fromAmount} ${fromToken}`,
        to: `${parseFloat(toAmount).toFixed(7)} ${toToken}`,
        time: new Date().toLocaleTimeString(),
        status: 'success',
        hash,
        explorerUrl,
        network: 'Testnet',
      };
      setTransactionsList(prev => [newTx, ...prev]);
      setSwapMsg({
        type: 'success',
        text: `Swapped ${fromAmount} ${fromToken} → ${parseFloat(toAmount).toFixed(4)} ${toToken}`,
        hash,
        explorerUrl,
      });
      setFromAmount('');
      setToAmount('');

      await Promise.all([refreshPoolState(), refreshUserState()]);
    } catch (err) {
      setSwapMsg({ type: 'error', text: `Swap failed: ${err.message}` });
    } finally {
      setSwapping(false);
    }
  }

  /* ── Real Add Liquidity via Soroban ── */
  async function handleAddLiquidity() {
    if (!lpAmount || !isConnected) return;
    if (!contractDeployed) {
      setLpMsg({ type: 'error', text: 'Contract not deployed. Follow the deployment instructions in README.' });
      return;
    }
    setLpMsg({ type: '', text: '' });
    setSwapping(true);

    try {
      const amtA = toRawAmount(lpAmount);
      const amtB = toRawAmount(lpAmountB || lpAmount);

      const { hash, explorerUrl } = await depositLiquidity(
        walletAddress,
        amtA,
        amtB,
        0n,
        0n,
      );

      const newTx = {
        id: hash,
        type: 'Add Liquidity',
        from: `${lpAmount} Native XLM`,
        to: `${lpAmountB || lpAmount} Test USDC`,
        time: new Date().toLocaleTimeString(),
        status: 'success',
        hash,
        explorerUrl,
        network: 'Testnet',
      };
      setTransactionsList(prev => [newTx, ...prev]);
      setLpMsg({
        type: 'success',
        text: `Liquidity added successfully`,
        hash,
        explorerUrl,
      });
      setLpAmount('');
      setLpAmountB('');

      await Promise.all([refreshPoolState(), refreshUserState()]);
    } catch (err) {
      setLpMsg({ type: 'error', text: `Add Liquidity failed: ${err.message}` });
    } finally {
      setSwapping(false);
    }
  }

  /* ── Real Remove Liquidity via Soroban ── */
  async function handleRemoveLiquidity() {
    if (!isConnected) return;
    if (!contractDeployed) {
      setLpMsg({ type: 'error', text: 'Contract not deployed. Follow the deployment instructions in README.' });
      return;
    }
    if (!userShares || userShares <= 0n) {
      setLpMsg({ type: 'error', text: 'You have no LP shares to withdraw.' });
      return;
    }
    setLpMsg({ type: '', text: '' });
    setSwapping(true);

    try {
      const { hash, explorerUrl } = await withdrawLiquidity(
        walletAddress,
        userShares,
        0n,
        0n,
      );

      const newTx = {
        id: hash,
        type: 'Remove Liquidity',
        from: `${userShares.toString()} shares`,
        to: 'Tokens returned',
        time: new Date().toLocaleTimeString(),
        status: 'success',
        hash,
        explorerUrl,
        network: 'Testnet',
      };
      setTransactionsList(prev => [newTx, ...prev]);
      setLpMsg({
        type: 'success',
        text: `Liquidity removed successfully`,
        hash,
        explorerUrl,
      });

      await Promise.all([refreshPoolState(), refreshUserState()]);
    } catch (err) {
      setLpMsg({ type: 'error', text: `Remove Liquidity failed: ${err.message}` });
    } finally {
      setSwapping(false);
    }
  }

  /* ── Computed display values from on-chain reserves ── */
  const displayReserveA = reserveA !== null ? fromRawAmount(reserveA) : null;
  const displayReserveB = reserveB !== null ? fromRawAmount(reserveB) : null;

  const swapRate = reserveA && reserveB && reserveA > 0n && reserveB > 0n
    ? (Number(reserveB) / Number(reserveA)).toFixed(6)
    : null;

  const netStyle = networkStyle(freighterNetwork || 'TESTNET');
  const activeNetwork = isConnected ? freighterNetwork : 'TESTNET';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP NAVBAR (Compact on Mobile, Full on Desktop) ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        background: 'rgba(2,4,15,0.88)',
      }}>
        <div className="nav-container" style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64, gap: 12,
        }}>

          {/* Compact Logo */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(99,102,241,0.4)', flexShrink: 0,
            }}>
              <Zap size={16} color="#fff" fill="#fff" />
            </div>
            <span className="nav-logo-text" style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              <span className="gradient-text">Stellar</span>
              <span style={{ color: 'var(--text-1)' }}>Swap</span>
              <span style={{
                fontSize: 10, fontWeight: 700, marginLeft: 4,
                background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: 5, padding: '2px 5px', verticalAlign: 'middle',
              }}>PRO</span>
            </span>
          </motion.div>

          {/* Desktop Tab Navigation (Hidden on Mobile via CSS) */}
          <motion.div
            className="desktop-nav-tabs"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', gap: 2,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 14, padding: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="btn btn-ghost"
                  style={{
                    position: 'relative', padding: '7px 14px', borderRadius: 10,
                    color: active ? '#fff' : 'var(--text-2)',
                    background: 'transparent', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      style={{
                        position: 'absolute', inset: 0, borderRadius: 10,
                        background: 'linear-gradient(135deg,rgba(99,102,241,0.9),rgba(168,85,247,0.9))',
                        boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} />
                    <span className="nav-text">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>

          {/* Header Action: Testnet Badge + Compact Wallet Button */}
          <motion.div
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          >
            {/* Compact Testnet Indicator */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 8px', borderRadius: 8,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
              fontSize: 11, fontWeight: 700, color: '#fbbf24',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <Globe size={11} />
              <span>TESTNET</span>
            </div>

            {/* Wallet Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleWalletClick}
              disabled={walletLoading}
              className="btn"
              style={isConnected ? {
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#34d399', padding: '6px 12px', fontSize: 12, borderRadius: 10, minHeight: 36,
              } : {
                background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                color: '#fff', padding: '6px 14px', fontSize: 12, borderRadius: 10, minHeight: 36,
                boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
              }}
            >
              {walletLoading ? (
                <><RefreshCw size={12} className="spin" /></>
              ) : isConnected ? (
                <><span className="dot dot-green" style={{ flexShrink: 0 }} />Wallet</>
              ) : (
                <><Wallet size={13} />Connect</>
              )}
            </motion.button>
          </motion.div>
        </div>
      </nav>

      {/* ── MOBILE STATUS STRIP (Mobile Only) ── */}
      <div className="mobile-status-strip">
        <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>⚡ StellarSwap Pro</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#34d399', fontWeight: 600 }}>
          <span className="dot dot-green" /> Pool Active
        </span>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`bottom-nav-item ${active ? 'active' : ''}`}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    style={{
                      position: 'absolute', inset: '4px 6px', borderRadius: 10,
                      background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon size={18} className="bottom-nav-icon" style={{ position: 'relative', zIndex: 1 }} />
                <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── DESKTOP HERO STRIP (Desktop Only) ── */}
      <div className="desktop-hero-strip">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 style={{ fontSize: 'clamp(26px, 4.5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Trade on <span className="gradient-text">Stellar</span> Network
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>
            Lightning-fast token swaps, deep liquidity pools, and real-time analytics — all on Testnet.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}
        >
          {[
            { icon: Shield, label: 'Non-custodial' },
            { icon: Zap,    label: '~3s Finality'  },
            { icon: Star,   label: 'Low 0.3% Fee'  },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)', fontSize: 13, fontWeight: 500 }}>
              <Icon size={14} style={{ color: 'var(--blue)' }} />{label}
            </div>
          ))}

          {/* Live pool reserves from chain */}
          {reserveA !== null && reserveB !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#34d399', fontSize: 13, fontWeight: 600 }}>
              <Activity size={14} />
              Pool: {parseFloat(displayReserveA).toFixed(2)} XLM / {parseFloat(displayReserveB).toFixed(2)} Test USDC
            </div>
          )}
        </motion.div>
      </div>

      {/* ── CONTRACT NOT DEPLOYED BANNER ── */}
      {!contractDeployed && (
        <div style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
          fontSize: 12, color: '#fbbf24',
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>Soroban contract not deployed yet.</span>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '24px 16px 80px', flex: 1 }}>
        <AnimatePresence mode="wait">

          {/* ══ WALLET TAB ══════════════════════════ */}
          {activeTab === 'wallet' && (
            <motion.div key="wallet" variants={scaleIn} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97 }}>
              <SectionHeader title="Wallet" subtitle="Connected wallet details & Testnet assets" />

              <AnimatePresence>
                {walletError && (
                  <ResponsiveError title="Connection Error" message={walletError} />
                )}
              </AnimatePresence>

              <div className="grid-2" style={{ marginTop: 16 }}>

                {/* ── Connection Card ── */}
                <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="card" style={{ padding: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18, margin: '0 auto 14px',
                      background: isConnected
                        ? 'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(16,185,129,0.08))'
                        : 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.08))',
                      border: `1px solid ${isConnected ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.4)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isConnected ? <CheckCircle size={26} color="#34d399" /> : <Wallet size={26} color="#818cf8" />}
                    </div>

                    <h3 style={{ marginBottom: 4, fontSize: 17 }}>
                      {isConnected ? 'Connected • Testnet' : 'Connect Wallet'}
                    </h3>

                    <p style={{ fontSize: 13, marginBottom: 18, color: 'var(--text-2)' }}>
                      {isConnected ? 'Freighter Wallet active on Stellar Testnet' : 'Connect Freighter to trade on Testnet.'}
                    </p>

                    {freighterInstalled ? (
                      <button
                        onClick={handleWalletClick}
                        disabled={walletLoading}
                        className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`}
                        style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14 }}
                      >
                        {walletLoading ? <RefreshCw size={14} className="spin" /> : isConnected ? 'Disconnect Wallet' : 'Connect with Freighter'}
                      </button>
                    ) : (
                      <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                        Install Freighter
                      </a>
                    )}
                  </div>
                </motion.div>

                {/* ── Wallet Details Card ── */}
                <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible" className="card" style={{ padding: 20 }}>
                  <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600 }}>Wallet Details</h3>

                  {isConnected ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                      <DetailRow
                        icon={<DollarSign size={14} color="#818cf8" />}
                        label="Native XLM Balance"
                        value={
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                            {xlmBalance !== null ? `${parseFloat(xlmBalance).toFixed(4)} XLM` : 'Loading…'}
                          </span>
                        }
                      />

                      <DetailRow
                        icon={<Shield size={14} color="#34d399" />}
                        label="Test USDC Balance & Trustline"
                        value={
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700,
                                color: trustlineState.hasTrustline ? '#34d399' : '#fbbf24',
                                background: trustlineState.hasTrustline ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                border: `1px solid ${trustlineState.hasTrustline ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                padding: '2px 7px', borderRadius: 6,
                              }}>
                                {trustlineState.hasTrustline ? '✓ Trustline Active' : '⚠️ Trustline Missing'}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 700 }}>
                                {parseFloat(trustlineState.balance).toFixed(2)} Test USDC
                              </span>
                            </div>

                            {!trustlineState.hasTrustline && (
                              <button
                                onClick={handleEstablishTrustline}
                                disabled={swapping}
                                className="btn btn-primary"
                                style={{ marginTop: 8, padding: '8px 12px', fontSize: 12, borderRadius: 10, width: '100%', justifyContent: 'center' }}
                              >
                                {swapping ? <RefreshCw size={12} className="spin" /> : 'Establish Exact Test USDC Trustline'}
                              </button>
                            )}

                            {trustlineMsg.text && (
                              <div style={{ marginTop: 6, fontSize: 12, color: trustlineMsg.type === 'error' ? '#f87171' : '#34d399' }}>
                                {trustlineMsg.text}
                              </div>
                            )}
                          </div>
                        }
                      />

                      {contractDeployed && (
                        <DetailRow
                          icon={<Droplets size={14} color="#a855f7" />}
                          label="LP Shares (on-chain)"
                          value={
                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                              {userShares !== null ? userShares.toString() : 'Loading…'}
                            </span>
                          }
                        />
                      )}

                      <DetailRow
                        icon={<Wallet size={14} color="#818cf8" />}
                        label="Wallet Address"
                        value={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--blue-lt)' }}>
                              {shortenAddress(walletAddress)}
                            </span>
                            <button onClick={copyAddress} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#34d399' : 'var(--text-3)', padding: 4 }}>
                              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        }
                      />

                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>
                      Connect wallet to view details
                    </p>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ══ SWAP TAB ════════════════════════════ */}
          {activeTab === 'swap' && (
            <motion.div key="swap" variants={scaleIn} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97 }}>
              <SectionHeader title="Swap Tokens" subtitle="Instant on-chain token swaps on Stellar Testnet" />
              
              <div style={{ maxWidth: 460, margin: '16px auto 0', width: '100%' }}>
                <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="card glow-border" style={{ padding: 18 }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {swapRate ? (
                        <>1 {fromToken} ≈ <span style={{ color: 'var(--blue-lt)', fontWeight: 600 }}>{fromToken === 'XLM' ? swapRate : (1/parseFloat(swapRate)).toFixed(4)} {toToken}</span></>
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>Loading rate…</span>
                      )}
                    </span>
                    <span className="badge badge-green">0.3% Fee</span>
                  </div>

                  {/* From Input */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid var(--border)', padding: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>FROM</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        className="input"
                        style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, flex: 1, minWidth: 0, boxShadow: 'none' }}
                        placeholder="0.00"
                        type="number"
                        value={fromAmount}
                        onChange={e => handleFromAmountChange(e.target.value)}
                      />
                      <div className="token-pill" style={{ flexShrink: 0, height: 40, padding: '4px 10px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#818cf8' }}>
                          {fromToken.slice(0, 2)}
                        </div>
                        <span>{fromToken}</span>
                      </div>
                    </div>
                    {isConnected && xlmBalance && fromToken === 'XLM' && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                        Balance: {parseFloat(xlmBalance).toFixed(4)} XLM
                      </div>
                    )}
                  </div>

                  {/* Swap Direction Flip Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                    <button
                      onClick={flipTokens}
                      style={{
                        width: 38, height: 38, borderRadius: 11,
                        background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.15))',
                        border: '1px solid rgba(99,102,241,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#818cf8', flexShrink: 0,
                      }}
                    ><ArrowUpDown size={15} /></button>
                  </div>

                  {/* To Input */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid var(--border)', padding: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>TO (estimated)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        className="input"
                        style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, flex: 1, minWidth: 0, boxShadow: 'none', color: 'var(--blue-lt)' }}
                        placeholder="0.00"
                        type="number"
                        readOnly
                        value={toAmount}
                      />
                      <div className="token-pill" style={{ flexShrink: 0, height: 40, padding: '4px 10px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#60a5fa' }}>
                          {toToken.slice(0, 2)}
                        </div>
                        <span>{toToken}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 16, padding: '0 2px' }}>
                    <span>Protocol Fee (0.3%)</span>
                    <span>{calculateFee(fromAmount, 0.3)} {fromToken}</span>
                  </div>

                  {!isConnected && (
                    <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, textAlign: 'center' }}>
                      Connect Freighter to swap tokens
                    </div>
                  )}

                  <button
                    onClick={handleSwap}
                    disabled={swapping || !fromAmount || !isConnected}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15, borderRadius: 12 }}
                  >
                    {swapping
                      ? <><RefreshCw size={15} className="spin" />Awaiting Freighter…</>
                      : <><ArrowUpDown size={15} />Swap {fromToken} → {toToken}</>}
                  </button>

                  {/* Compact Success / Error Banners */}
                  <AnimatePresence>
                    {swapMsg.text && (
                      swapMsg.type === 'error' ? (
                        <ResponsiveError title="Swap Failed" message={swapMsg.text} onDismiss={() => setSwapMsg({ type: '', text: '' })} />
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="compact-success-banner"
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>✓ {swapMsg.text}</div>
                            {swapMsg.hash && (
                              <a href={swapMsg.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                Tx: {shortenTxHash(swapMsg.hash)} <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          <button onClick={() => setSwapMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: 2 }}>
                            <X size={14} />
                          </button>
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ══ LIQUIDITY TAB ═══════════════════════ */}
          {activeTab === 'liquidity' && (
            <motion.div key="liquidity" variants={scaleIn} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97 }}>
              <SectionHeader title="Liquidity" subtitle="Provide liquidity and earn 0.3% fees on every swap" />

              {/* Compact Status Banner */}
              <AnimatePresence>
                {lpMsg.text && (
                  lpMsg.type === 'error' ? (
                    <ResponsiveError title="Liquidity Error" message={lpMsg.text} onDismiss={() => setLpMsg({ type: '', text: '' })} />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="compact-success-banner" style={{ maxWidth: 500, margin: '10px auto 0' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>✓ {lpMsg.text}</div>
                        {lpMsg.hash && (
                          <a href={lpMsg.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            Tx: {shortenTxHash(lpMsg.hash)} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <button onClick={() => setLpMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              <div className="grid-2" style={{ marginTop: 16 }}>

                {/* Add Liquidity Card */}
                <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Plus size={16} color="#818cf8" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, marginBottom: 1 }}>Add Liquidity</h3>
                      <p style={{ fontSize: 12 }}>Deposit tokens into pool</p>
                    </div>
                  </div>

                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4, fontWeight: 500 }}>Native XLM</label>
                  <input className="input" placeholder="0.00 XLM" type="number" value={lpAmount} onChange={e => setLpAmount(e.target.value)} style={{ marginBottom: 10 }} />
                  
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 4, fontWeight: 500 }}>Test USDC</label>
                  <input className="input" placeholder="0.00 USDC" type="number" value={lpAmountB} onChange={e => setLpAmountB(e.target.value)} style={{ marginBottom: 16 }} />

                  <button
                    onClick={handleAddLiquidity}
                    disabled={!lpAmount || !isConnected || swapping}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14, borderRadius: 12 }}
                  >
                    {swapping ? <RefreshCw size={14} className="spin" /> : <><Plus size={15} />Add Liquidity</>}
                  </button>
                </motion.div>

                {/* Remove Liquidity & Position Card */}
                <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible" className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Minus size={16} color="#f87171" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, marginBottom: 1 }}>Your Position</h3>
                      <p style={{ fontSize: 12 }}>On-chain pool shares</p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)', padding: 12, marginBottom: 16 }}>
                    {isConnected ? (
                      <>
                        {[
                          { label: 'LP Shares', val: userShares !== null ? userShares.toString() : '—' },
                          { label: 'Pool XLM', val: displayReserveA !== null ? `${parseFloat(displayReserveA).toFixed(2)}` : '—' },
                          { label: 'Pool USDC', val: displayReserveB !== null ? `${parseFloat(displayReserveB).toFixed(2)}` : '—' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
                            <span style={{ fontWeight: 600 }}>{r.val}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Connect wallet to view position</p>
                    )}
                  </div>

                  <button
                    onClick={handleRemoveLiquidity}
                    disabled={!isConnected || !userShares || userShares <= 0n || swapping}
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14, borderRadius: 12 }}
                  >
                    {swapping ? <RefreshCw size={14} className="spin" /> : <><Minus size={15} />Remove Liquidity</>}
                  </button>
                </motion.div>

              </div>
            </motion.div>
          )}

          {/* ══ ANALYTICS TAB ═══════════════════════ */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" variants={scaleIn} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97 }}>
              <SectionHeader title="Analytics" subtitle="On-chain protocol metrics from Stellar Testnet" />
              
              <div className="grid-4" style={{ marginTop: 16 }}>
                {[
                  { label: 'Pool XLM',  value: displayReserveA !== null ? `${parseFloat(displayReserveA).toFixed(2)}` : '—', icon: DollarSign, color: '#6366f1' },
                  { label: 'Pool USDC', value: displayReserveB !== null ? `${parseFloat(displayReserveB).toFixed(2)}` : '—', icon: DollarSign, color: '#a855f7' },
                  { label: 'Rate',      value: swapRate ? `${swapRate}` : '—',   icon: Activity,   color: '#10b981' },
                  { label: 'LP Supply', value: userShares !== null ? userShares.toString() : '—', icon: TrendingUp, color: '#f59e0b' },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div key={s.label} variants={fadeUp} custom={i} initial="hidden" animate="visible" className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${s.color}18`, border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} color={s.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>{s.label}</p>
                        <div className="break-word" style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                          {reserveLoading ? '…' : s.value}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible" className="card" style={{ marginTop: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>Pool Statistics</h3>
                  <button onClick={refreshPoolState} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <RefreshCw size={12} className={reserveLoading ? 'spin' : ''} /> Refresh
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Reserve A', val: displayReserveA ? `${parseFloat(displayReserveA).toFixed(2)} XLM` : '—', color: '#6366f1' },
                    { label: 'Reserve B', val: displayReserveB ? `${parseFloat(displayReserveB).toFixed(2)} USDC` : '—', color: '#a855f7' },
                    { label: 'K Constant', val: reserveA && reserveB ? `${(Number(reserveA) * Number(reserveB)).toExponential(2)}` : '—', color: '#10b981' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: 12, borderRadius: 10, background: `${s.color}0d`, border: `1px solid ${s.color}22` }}>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{s.label}</div>
                      <div className="break-word" style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{reserveLoading ? '…' : s.val}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ══ TRANSACTIONS TAB ════════════════════ */}
          {activeTab === 'transactions' && (
            <motion.div key="transactions" variants={scaleIn} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97 }}>
              <SectionHeader title="Transactions" subtitle="Real Stellar Testnet session transactions" />

              {transactionsList.length === 0 ? (
                <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="card" style={{ marginTop: 16, padding: '32px 16px', textAlign: 'center' }}>
                  <Clock size={36} style={{ marginBottom: 12, opacity: 0.2 }} />
                  <h3 style={{ fontSize: 15, marginBottom: 4 }}>No transactions yet</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Execute a swap or liquidity operation to see on-chain records here.
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="tx-table-container card" style={{ marginTop: 16, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>HASH</th>
                          <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>TYPE</th>
                          <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>AMOUNT</th>
                          <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>EXPLORER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionsList.map((tx) => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', color: 'var(--blue-lt)' }}>
                              {shortenTxHash(tx.hash)}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>
                              <span className="badge badge-blue">{tx.type}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600 }}>
                              {tx.from} → {tx.to}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>
                              <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                                View ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Cards List */}
                  <div className="tx-card-list" style={{ marginTop: 14 }}>
                    {transactionsList.map((tx) => (
                      <div key={tx.id} className="tx-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className={`badge ${tx.type === 'Swap' ? 'badge-blue' : tx.type === 'Add Liquidity' ? 'badge-purple' : 'badge-yellow'}`}>
                            {tx.type}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tx.time}</span>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                          {tx.from} → {tx.to}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--blue-lt)' }}>
                            {shortenTxHash(tx.hash)}
                          </span>
                          <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
                            View on Explorer ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '16px', textAlign: 'center',
        color: 'var(--text-3)', fontSize: 11, lineHeight: 1.5,
        background: 'rgba(2,4,15,0.6)',
      }}>
        <div>
          <span>StellarSwap Pro · </span>
          <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Stellar Testnet</span>
          <span> · Powered by </span>
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>Freighter</a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Shared Section Header ─────────────────── */
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 10 }}>
      <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 28px)', fontWeight: 800, marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 400, margin: '0 auto' }}>{subtitle}</p>
    </div>
  );
}

/* ─── Wallet Detail Row ─────────────────────── */
function DetailRow({ icon, label, value }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      width: '100%', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div>{value}</div>
    </div>
  );
}