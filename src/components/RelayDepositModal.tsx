'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '@/store/useAppState';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { synthSound } from './ClientWrapper';
import { X, Zap, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Loader2, Sparkles, Search, QrCode, Copy, Check, Smartphone, Wallet } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';

export interface DynamicChainCurrency {
  id?: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  supportsBridging?: boolean;
  metadata?: {
    logoURI?: string;
  };
}

export interface DynamicRelayChain {
  id: number;
  name: string;
  displayName: string;
  httpRpcUrl?: string;
  explorerUrl?: string;
  vmType?: string;
  iconUrl?: string;
  currency: DynamicChainCurrency;
  featuredTokens?: DynamicChainCurrency[];
  erc20Currencies?: DynamicChainCurrency[];
  solverCurrencies?: DynamicChainCurrency[];
}

// Fallback initial chains before API fetch resolves
const FALLBACK_CHAINS: DynamicRelayChain[] = [
  {
    id: 8453,
    name: 'base',
    displayName: 'Base',
    iconUrl: 'https://assets.relay.link/icons/8453/light.png',
    currency: { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }
    ]
  },
  {
    id: 42161,
    name: 'arbitrum',
    displayName: 'Arbitrum One',
    iconUrl: 'https://assets.relay.link/icons/42161/light.png',
    currency: { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }
    ]
  },
  {
    id: 1,
    name: 'ethereum',
    displayName: 'Ethereum',
    iconUrl: 'https://assets.relay.link/icons/1/light.png',
    currency: { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 }
    ]
  },
  {
    id: 10,
    name: 'optimism',
    displayName: 'OP Mainnet',
    iconUrl: 'https://assets.relay.link/icons/10/light.png',
    currency: { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097F853', decimals: 6 }
    ]
  },
  {
    id: 137,
    name: 'polygon',
    displayName: 'Polygon POS',
    iconUrl: 'https://assets.relay.link/icons/137/light.png',
    currency: { symbol: 'POL', name: 'Polygon', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'POL', name: 'Polygon', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 }
    ]
  },
  {
    id: 56,
    name: 'bsc',
    displayName: 'BNB Smart Chain',
    iconUrl: 'https://assets.relay.link/icons/56/light.png',
    currency: { symbol: 'BNB', name: 'BNB', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    featuredTokens: [
      { symbol: 'BNB', name: 'BNB', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 6 }
    ]
  }
];

export const RelayDepositModal: React.FC = () => {
  const {
    isRelayDepositOpen,
    closeRelayDepositModal,
    relayInitialOriginChainId,
    user,
    fetchBalance,
    addToast
  } = useAppState();

  // Dynamic Relay Chains from API
  const [allChains, setAllChains] = useState<DynamicRelayChain[]>(FALLBACK_CHAINS);
  const [chainsLoading, setChainsLoading] = useState<boolean>(false);
  const [chainSearch, setChainSearch] = useState<string>('');
  const [isSelectingChain, setIsSelectingChain] = useState<boolean>(false);

  // Selected Origin Chain & Currency
  const [selectedChain, setSelectedChain] = useState<DynamicRelayChain>(FALLBACK_CHAINS[0]);
  const [selectedCurrency, setSelectedCurrency] = useState<DynamicChainCurrency>(FALLBACK_CHAINS[0].currency);
  const [amountInput, setAmountInput] = useState<string>('0.005');

  // Execution Mode: '1click' (Wallet) vs 'qr' (QR Code / Manual Address)
  const [depositMode, setDepositMode] = useState<'1click' | 'qr'>('1click');

  // Copy States
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [copiedAmt, setCopiedAmt] = useState<boolean>(false);

  // Quote State
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<any | null>(null);

  // Execution State
  const [executingStep, setExecutingStep] = useState<'idle' | 'network_switch' | 'approving' | 'submitting' | 'fulfilling' | 'success' | 'failed'>('idle');
  const [executingMsg, setExecutingMsg] = useState<string>('');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch all 68+ dynamic chains from Relay API on mount
  useEffect(() => {
    let isMounted = true;
    const fetchChains = async () => {
      setChainsLoading(true);
      try {
        const res = await fetch('https://api.relay.link/chains');
        if (res.ok) {
          const data = await res.json();
          if (data.chains && Array.isArray(data.chains) && data.chains.length > 0) {
            const formatted: DynamicRelayChain[] = data.chains.map((c: any) => ({
              id: c.id,
              name: c.name,
              displayName: c.displayName || c.name,
              httpRpcUrl: c.httpRpcUrl,
              explorerUrl: c.explorerUrl,
              vmType: c.vmType,
              iconUrl: c.iconUrl || `https://assets.relay.link/icons/${c.id}/light.png`,
              currency: c.currency || { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
              featuredTokens: c.featuredTokens || [],
              erc20Currencies: c.erc20Currencies || [],
              solverCurrencies: c.solverCurrencies || []
            }));

            if (isMounted) {
              setAllChains(formatted);
              // Pick match if passed or default to Base
              const initialId = relayInitialOriginChainId || 8453;
              const match = formatted.find(c => c.id === initialId) || formatted[0];
              setSelectedChain(match);
              setSelectedCurrency(match.currency);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Relay dynamic chains:', err);
      } finally {
        if (isMounted) setChainsLoading(false);
      }
    };

    if (isRelayDepositOpen) {
      fetchChains();
    }
    return () => { isMounted = false; };
  }, [isRelayDepositOpen, relayInitialOriginChainId]);

  // Aggregate all tokens for the currently selected chain
  const availableCurrencies = useMemo(() => {
    const list: DynamicChainCurrency[] = [];
    if (selectedChain.currency) list.push(selectedChain.currency);

    const merged = [
      ...(selectedChain.featuredTokens || []),
      ...(selectedChain.erc20Currencies || []),
      ...(selectedChain.solverCurrencies || [])
    ];

    merged.forEach(t => {
      if (t.symbol && !list.some(existing => existing.address.toLowerCase() === t.address.toLowerCase())) {
        list.push(t);
      }
    });

    return list;
  }, [selectedChain]);

  // Update selected currency when chain changes
  useEffect(() => {
    if (availableCurrencies.length > 0) {
      setSelectedCurrency(availableCurrencies[0]);
    }
  }, [selectedChain, availableCurrencies]);

  // Filter chains by search query
  const filteredChains = useMemo(() => {
    if (!chainSearch.trim()) return allChains;
    const q = chainSearch.toLowerCase();
    return allChains.filter(c =>
      c.displayName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.currency.symbol.toLowerCase().includes(q)
    );
  }, [allChains, chainSearch]);

  // Fetch Relay Quote
  const fetchQuote = useCallback(async () => {
    if (!user?.wallet || !amountInput || parseFloat(amountInput) <= 0) {
      setQuoteData(null);
      setQuoteError(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const decimals = selectedCurrency.decimals || 18;
      const parsedAmount = parseUnits(amountInput, decimals).toString();

      // Target: Avalanche C-Chain (43114) Native USDC
      const payload = {
        user: user.wallet,
        originChainId: selectedChain.id,
        destinationChainId: 43114,
        originCurrency: selectedCurrency.address || '0x0000000000000000000000000000000000000000',
        destinationCurrency: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // Avalanche USDC
        amount: parsedAmount,
        tradeType: 'EXACT_INPUT',
        recipient: user.wallet
      };

      const res = await fetch('https://api.relay.link/quote/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.message || data.errorCode) {
        throw new Error(data.message || 'Failed to fetch cross-chain Relay quote');
      }

      setQuoteData(data);
    } catch (err: any) {
      console.warn('Relay quote fetch error:', err);
      setQuoteError(err.message || 'Unable to quote cross-chain route');
      setQuoteData(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [user?.wallet, amountInput, selectedChain, selectedCurrency]);

  // Debounced quote fetch
  useEffect(() => {
    if (!isRelayDepositOpen) return;
    const timer = setTimeout(() => {
      fetchQuote();
    }, 400);
    return () => clearTimeout(timer);
  }, [isRelayDepositOpen, fetchQuote]);

  // Real-time fulfillment polling whenever quote data has a check endpoint
  useEffect(() => {
    if (!isRelayDepositOpen || !quoteData?.steps) return;
    const checkEndpoint = quoteData.steps[0]?.items[0]?.check?.endpoint;
    if (!checkEndpoint) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`https://api.relay.link${checkEndpoint}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' || data.status === 'refunded') {
            clearInterval(interval);
            setExecutingStep('success');
            setExecutingMsg('DEPOSIT DETECTED & FULFILLED ON AVALANCHE!');
            synthSound('victory');
            addToast('DEPOSIT FULFILLED', 'success', 'Avalanche USDC balance credited!');
            setTimeout(() => {
              fetchBalance();
            }, 1000);
          }
        }
      } catch (err) {
        // silent check retry
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRelayDepositOpen, quoteData, fetchBalance, addToast]);

  if (!isRelayDepositOpen) return null;

  // Extract payment details for deposit address & QR code
  const stepItemData = quoteData?.steps?.[0]?.items?.[0]?.data;
  const depositAddress = stepItemData?.to || '';
  const payValueWei = stepItemData?.value || '0';
  const outputFormatted = quoteData?.details?.currencyOut?.amountFormatted || '0.00';
  const timeEstimate = quoteData?.details?.timeEstimate || 2;

  // Format pay value nicely
  const payValueFormatted = payValueWei && payValueWei !== '0'
    ? formatUnits(BigInt(payValueWei), selectedCurrency.decimals || 18)
    : amountInput;

  // QR Code URL
  const qrCodeUrl = depositAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(depositAddress)}`
    : '';

  // Execute 1-Click Connected Wallet Deposit
  const handleExecuteDeposit = async () => {
    if (!quoteData || !quoteData.steps || quoteData.steps.length === 0) return;
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      addToast('WALLET PROVIDER MISSING', 'error', 'Please ensure an EVM wallet is connected');
      return;
    }

    const ethereum = (window as any).ethereum;
    setExecutingStep('network_switch');
    setExecutingMsg(`Switching network to ${selectedChain.displayName}...`);
    synthSound('bet');

    try {
      // 1. Ensure user is on origin chain
      const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
      const targetHex = `0x${selectedChain.id.toString(16)}`;

      if (currentChainHex.toLowerCase() !== targetHex.toLowerCase()) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetHex }]
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            throw new Error(`Please add ${selectedChain.displayName} network to your wallet.`);
          }
          throw switchErr;
        }
      }

      // 2. Execute Relay steps
      for (let i = 0; i < quoteData.steps.length; i++) {
        const step = quoteData.steps[i];
        for (let j = 0; j < step.items.length; j++) {
          const item = step.items[j];
          const txData = item.data;

          if (step.id === 'approve' || item.kind === 'approve') {
            setExecutingStep('approving');
            setExecutingMsg('Approving Relay Cross-Chain Bridge contract...');
          } else {
            setExecutingStep('submitting');
            setExecutingMsg('Signing 1-Click Cross-Chain Deposit...');
          }

          const hash = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: txData.from,
              to: txData.to,
              data: txData.data,
              value: txData.value ? `0x${BigInt(txData.value).toString(16)}` : '0x0',
              gas: txData.gas ? `0x${BigInt(txData.gas).toString(16)}` : undefined
            }]
          });

          setTxHash(hash);
          console.log('Relay step tx submitted:', hash);
          setExecutingStep('fulfilling');
          setExecutingMsg('Relay Solver fulfilling deposit to Avalanche USDC (~2s)...');
        }
      }

    } catch (err: any) {
      console.error('Relay deposit execution failed:', err);
      setExecutingStep('failed');
      setExecutingMsg(err.message || 'Deposit transaction rejected or failed');
      synthSound('defeat');
    }
  };

  const handleCopyAddr = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopiedAddr(true);
    synthSound('bet');
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleCopyAmt = () => {
    if (!payValueFormatted) return;
    navigator.clipboard.writeText(payValueFormatted);
    setCopiedAmt(true);
    synthSound('bet');
    setTimeout(() => setCopiedAmt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
      
      {/* Modal Container */}
      <div className="bg-white dark:bg-[#080B11] border-2 border-cyan-200 dark:border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative text-slate-800 dark:text-white transition-colors duration-200 max-h-[90vh] flex flex-col">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-cyan-100 via-sky-50 to-cyan-100 dark:from-gray-900 dark:via-[#0E1525] dark:to-gray-900 border-b border-cyan-200 dark:border-gray-800 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <PepePortrait src={PEPE_ASSETS.apeGeneral} size={42} glowColor="gold" className="rounded-lg shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] text-[#00796B] dark:text-neon-moon font-extrabold bg-teal-50 dark:bg-neon-moon/10 px-2 py-0.5 border border-[#00796B]/30 rounded uppercase tracking-wider">
                  CROSS-CHAIN DEPOSIT ({allChains.length} CHAINS)
                </span>
              </div>
              <h3 className="font-staatliches text-2xl text-[#0A1A2A] dark:text-white uppercase tracking-wide leading-none mt-1">
                CROSS-CHAIN DEPOSIT
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              if (executingStep !== 'submitting' && executingStep !== 'fulfilling') {
                closeRelayDepositModal();
              }
            }}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-cyan-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* 68+ Chain Selector Overlay */}
          {isSelectingChain ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="font-staatliches text-xl text-[#0A1A2A] dark:text-white uppercase">
                  SELECT ORIGIN CHAIN ({allChains.length} SUPPORTED)
                </h4>
                <button
                  type="button"
                  onClick={() => setIsSelectingChain(false)}
                  className="font-mono text-xs text-[#00796B] dark:text-neon-moon font-bold uppercase hover:underline"
                >
                  BACK
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH CHAIN OR TOKEN (E.G., SOLANA, ARBITRUM, UNICHAIN...)"
                  value={chainSearch}
                  onChange={(e) => setChainSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-cyan-50 dark:bg-[#05080E] border border-cyan-200 dark:border-gray-800 text-[#0A1A2A] dark:text-white font-mono text-xs rounded-xl focus:border-[#00796B] dark:focus:border-neon-moon focus:outline-none uppercase font-bold"
                />
              </div>

              {/* Chain Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
                {filteredChains.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => {
                      setSelectedChain(chain);
                      setIsSelectingChain(false);
                      synthSound('bet');
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                      selectedChain.id === chain.id
                        ? 'border-[#00796B] dark:border-neon-moon bg-teal-50 dark:bg-neon-moon/10 font-bold shadow-xs'
                        : 'border-cyan-200 dark:border-gray-800 bg-white dark:bg-[#0A0E17] hover:border-cyan-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <img src={chain.iconUrl} alt={chain.displayName} className="w-6 h-6 rounded-full shrink-0" />
                    <div className="min-w-0">
                      <span className="font-staatliches text-sm tracking-wide block truncate text-[#0A1A2A] dark:text-white uppercase leading-tight">
                        {chain.displayName}
                      </span>
                      <span className="font-mono text-[9px] text-slate-500 dark:text-gray-400 block uppercase">
                        {chain.currency.symbol}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Execution Progress State */}
              {executingStep !== 'idle' ? (
                <div className="py-8 px-4 text-center space-y-4">
                  {executingStep === 'success' ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-teal-100 dark:bg-emerald-950 border-2 border-[#00796B] dark:border-neon-moon rounded-full flex items-center justify-center mx-auto text-[#00796B] dark:text-neon-moon animate-bounce">
                        <CheckCircle2 size={36} />
                      </div>
                      <h4 className="font-staatliches text-3xl text-[#0A1A2A] dark:text-white uppercase tracking-wider">
                        DEPOSIT FULFILLED!
                      </h4>
                      <p className="font-mono text-xs text-slate-600 dark:text-trench-gasmask uppercase font-bold max-w-sm mx-auto">
                        Your Avalanche USDC balance has been updated and credited instantly!
                      </p>

                      {txHash && (
                        <a
                          href={`https://snowtrace.io/tx/${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-[#00796B] dark:text-neon-moon hover:underline font-bold uppercase"
                        >
                          <span>VIEW TRANSACTION</span>
                          <ExternalLink size={12} />
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setExecutingStep('idle');
                          closeRelayDepositModal();
                        }}
                        className="w-full mt-4 py-3 bg-[#00796B] dark:bg-neon-moon text-white dark:text-black font-staatliches text-xl rounded-xl uppercase font-bold hover:scale-[1.01] transition-transform shadow-md"
                      >
                        DONE & RETURN TO WAR TABLE
                      </button>
                    </div>
                  ) : executingStep === 'failed' ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-950 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                        <AlertTriangle size={36} />
                      </div>
                      <h4 className="font-staatliches text-3xl text-red-600 dark:text-red-400 uppercase tracking-wider">
                        TRANSACTION FLUNKED
                      </h4>
                      <p className="font-mono text-xs text-slate-600 dark:text-trench-gasmask uppercase font-bold max-w-sm mx-auto">
                        {executingMsg}
                      </p>
                      <button
                        onClick={() => setExecutingStep('idle')}
                        className="w-full mt-4 py-3 bg-red-600 text-white font-staatliches text-xl rounded-xl uppercase font-bold hover:bg-red-700 transition-colors shadow-md"
                      >
                        TRY AGAIN
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-cyan-100 dark:bg-gray-800 border-2 border-[#00796B] dark:border-neon-moon rounded-full flex items-center justify-center mx-auto text-[#00796B] dark:text-neon-moon">
                        <Loader2 size={36} className="animate-spin" />
                      </div>
                      <h4 className="font-staatliches text-2xl text-[#0A1A2A] dark:text-white uppercase tracking-wider">
                        EXECUTING CROSS-CHAIN DEPOSIT
                      </h4>
                      <p className="font-mono text-xs text-slate-600 dark:text-trench-gasmask uppercase font-bold animate-pulse">
                        {executingMsg}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Deposit Mode Toggle Tabs */}
                  <div className="grid grid-cols-2 gap-2 bg-cyan-100 dark:bg-gray-900 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDepositMode('1click')}
                      className={`py-2 px-3 rounded-lg font-staatliches text-sm uppercase flex items-center justify-center gap-1.5 transition-all ${
                        depositMode === '1click'
                          ? 'bg-[#00796B] dark:bg-neon-moon text-white dark:text-black font-bold shadow-xs'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Wallet size={15} />
                      <span>1-CLICK WALLET</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMode('qr')}
                      className={`py-2 px-3 rounded-lg font-staatliches text-sm uppercase flex items-center justify-center gap-1.5 transition-all ${
                        depositMode === 'qr'
                          ? 'bg-[#00796B] dark:bg-neon-moon text-white dark:text-black font-bold shadow-xs'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <QrCode size={15} />
                      <span>📱 QR & DEPOSIT ADDR</span>
                    </button>
                  </div>

                  {/* 1. Origin Chain & Token Selection Box */}
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold text-slate-600 dark:text-trench-gasmask uppercase tracking-wider">
                      1. ORIGIN CHAIN & TOKEN ({allChains.length} AVAILABLE):
                    </label>

                    <div className="flex gap-2">
                      {/* Selected Chain Button */}
                      <button
                        type="button"
                        onClick={() => setIsSelectingChain(true)}
                        className="flex-1 p-3 bg-cyan-50 dark:bg-[#05080E] border border-cyan-200 dark:border-gray-800 hover:border-[#00796B] dark:hover:border-neon-moon rounded-xl flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={selectedChain.iconUrl} alt={selectedChain.displayName} className="w-6 h-6 rounded-full" />
                          <div className="text-left">
                            <span className="font-staatliches text-base text-[#0A1A2A] dark:text-white block uppercase leading-none">
                              {selectedChain.displayName}
                            </span>
                            <span className="font-mono text-[9px] text-slate-500 dark:text-gray-400 block uppercase mt-0.5">
                              CHAIN ID: {selectedChain.id}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-[#00796B] dark:text-neon-moon font-bold uppercase">
                          CHANGE ▾
                        </span>
                      </button>

                      {/* Token Selector */}
                      <select
                        value={selectedCurrency.address}
                        onChange={(e) => {
                          const match = availableCurrencies.find(t => t.address.toLowerCase() === e.target.value.toLowerCase());
                          if (match) setSelectedCurrency(match);
                        }}
                        className="w-36 px-3 py-3 bg-cyan-50 dark:bg-[#05080E] border border-cyan-200 dark:border-gray-800 text-[#0A1A2A] dark:text-white font-mono text-xs rounded-xl focus:border-[#00796B] dark:focus:border-neon-moon focus:outline-none font-bold uppercase cursor-pointer"
                      >
                        {availableCurrencies.map((t, idx) => (
                          <option key={idx} value={t.address} className="bg-white dark:bg-gray-900 text-slate-900 dark:text-white">
                            {t.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Amount Input */}
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold text-slate-600 dark:text-trench-gasmask uppercase tracking-wider">
                      2. DEPOSIT AMOUNT:
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.0"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-full px-4 py-3 bg-cyan-50 dark:bg-[#05080E] border border-cyan-200 dark:border-gray-800 text-[#0A1A2A] dark:text-white font-mono text-lg rounded-xl focus:border-[#00796B] dark:focus:border-neon-moon focus:outline-none font-bold"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-cyan-200 dark:border-gray-800 px-2.5 py-1 rounded-lg">
                        <img src={selectedChain.iconUrl} alt={selectedCurrency.symbol} className="w-4 h-4 rounded-full" />
                        <span className="font-staatliches text-xs text-slate-800 dark:text-white">{selectedCurrency.symbol}</span>
                      </div>
                    </div>

                    {/* Preset quick buttons */}
                    <div className="flex gap-2">
                      {(selectedCurrency.symbol === 'USDC' || selectedCurrency.symbol === 'USDT' ? ['10', '25', '50', '100'] : ['0.005', '0.01', '0.05', '0.1']).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setAmountInput(preset);
                            synthSound('bet');
                          }}
                          className="flex-1 py-1 bg-white dark:bg-[#0A0E17] border border-cyan-200 dark:border-gray-800 hover:border-[#00796B] dark:hover:border-neon-moon rounded-lg font-mono text-[10px] text-slate-700 dark:text-gray-300 font-bold uppercase transition-colors"
                        >
                          +{preset} {selectedCurrency.symbol}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Quote Information & Realtime Solver Box */}
                  <div className="bg-cyan-50/60 dark:bg-[#05080E] border border-cyan-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-cyan-200 dark:border-gray-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-[#00796B] dark:text-neon-moon" />
                        <span className="font-staatliches text-base text-[#0A1A2A] dark:text-white uppercase tracking-wider">
                          TARGET: AVALANCHE USDC
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-teal-700 dark:text-neon-moon font-extrabold bg-teal-50 dark:bg-neon-moon/10 px-2 py-0.5 rounded border border-[#00796B]/30">
                        EST. TIME: ~{timeEstimate}s
                      </span>
                    </div>

                    {quoteLoading ? (
                      <div className="py-4 text-center space-y-1 font-mono text-xs text-slate-500 dark:text-gray-400">
                        <Loader2 size={18} className="animate-spin mx-auto text-[#00796B] dark:text-neon-moon mb-1" />
                        <span>CALCULATING RELAY SOLVER ROUTE...</span>
                      </div>
                    ) : quoteError ? (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 font-mono text-[10px] font-bold">
                        ⚠️ {quoteError}
                      </div>
                    ) : quoteData ? (
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-gray-400 text-[10px] font-bold uppercase">YOU SEND:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {payValueFormatted} {selectedCurrency.symbol} ({selectedChain.displayName})
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-gray-400 text-[10px] font-bold uppercase">YOU RECEIVE:</span>
                          <span className="font-extrabold text-[#00796B] dark:text-neon-moon text-sm">
                            +{outputFormatted} USDC (Avalanche)
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[9.5px] text-slate-500 dark:text-gray-400 pt-1 border-t border-cyan-200 dark:border-gray-800">
                          <span>SOLVER REAL-TIME MONITOR:</span>
                          <span className="font-bold text-[#00796B] dark:text-neon-moon flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping inline-block" />
                            ACTIVE LISTENER
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center font-mono text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">
                        ENTER DEPOSIT AMOUNT ABOVE TO FETCH QUOTE
                      </div>
                    )}
                  </div>

                  {/* Mode Specific Display */}
                  {depositMode === 'qr' && quoteData && depositAddress ? (
                    <div className="bg-white dark:bg-[#0A0E17] border border-cyan-200 dark:border-gray-800 rounded-xl p-4 text-center space-y-3">
                      <div className="font-mono text-[10px] font-bold text-slate-600 dark:text-gray-300 uppercase flex items-center justify-center gap-1.5">
                        <QrCode size={14} className="text-[#00796B] dark:text-neon-moon" />
                        <span>RELAY DEPOSITORY QR CODE & ADDRESS</span>
                      </div>

                      {/* QR Image */}
                      {qrCodeUrl && (
                        <div className="flex justify-center p-2 bg-white rounded-xl max-w-[180px] mx-auto border shadow-sm">
                          <img src={qrCodeUrl} alt="Deposit QR" className="w-40 h-40 object-contain" />
                        </div>
                      )}

                      {/* Deposit Details Copy Boxes */}
                      <div className="space-y-2 text-left font-mono text-xs">
                        <div>
                          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase block mb-1">
                            SEND EXACT AMOUNT ({selectedCurrency.symbol}):
                          </span>
                          <div className="flex items-center gap-2 bg-cyan-50 dark:bg-black p-2 rounded-lg border border-cyan-200 dark:border-gray-800">
                            <span className="font-bold text-slate-900 dark:text-white flex-1 truncate">{payValueFormatted} {selectedCurrency.symbol}</span>
                            <button
                              onClick={handleCopyAmt}
                              className="px-2 py-1 bg-[#00796B] dark:bg-neon-moon text-white dark:text-black text-[10px] font-bold uppercase rounded flex items-center gap-1 shrink-0"
                            >
                              {copiedAmt ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedAmt ? 'COPIED' : 'COPY'}</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase block mb-1">
                            RELAY SOLVER DEPOSIT ADDRESS:
                          </span>
                          <div className="flex items-center gap-2 bg-cyan-50 dark:bg-black p-2 rounded-lg border border-cyan-200 dark:border-gray-800">
                            <span className="font-bold text-slate-900 dark:text-white flex-1 truncate text-[10px]">{depositAddress}</span>
                            <button
                              onClick={handleCopyAddr}
                              className="px-2 py-1 bg-[#00796B] dark:bg-neon-moon text-white dark:text-black text-[10px] font-bold uppercase rounded flex items-center gap-1 shrink-0"
                            >
                              {copiedAddr ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedAddr ? 'COPIED' : 'COPY'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="font-mono text-[9px] text-slate-500 dark:text-trench-gasmask uppercase font-bold leading-normal pt-1">
                        Send from any external wallet, exchange (Binance/Coinbase), or mobile app on <strong className="text-slate-900 dark:text-white">{selectedChain.displayName}</strong>. Funds will automatically bridge and credit your Avalanche USDC balance upon broadcast!
                      </p>
                    </div>
                  ) : (
                    /* 1-Click Execution Button */
                    <button
                      type="button"
                      onClick={handleExecuteDeposit}
                      disabled={!quoteData || quoteLoading || !!quoteError}
                      className="w-full py-3.5 bg-[#00796B] dark:bg-neon-moon hover:bg-[#004D40] dark:hover:bg-green-400 text-white dark:text-black font-staatliches text-2xl rounded-xl uppercase tracking-wider font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Wallet size={22} />
                      <span>1-CLICK CROSS-CHAIN DEPOSIT</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

        </div>

      </div>

    </div>
  );
};
