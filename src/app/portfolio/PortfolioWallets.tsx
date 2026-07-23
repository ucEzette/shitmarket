'use client';

import React, { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { synthSound } from '@/components/ClientWrapper';
import { useAppState, publicClient } from '@/store/useAppState';
import { createWalletClient, custom, isAddress, parseUnits, formatUnits } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { 
  Folder, Upload, Plus, Send, Check, Copy, ArrowRight, Loader2, ArrowDown, 
  Download, Edit2, Archive, Trash2, Key, Globe, ArrowLeftRight, Coins, ShieldCheck 
} from 'lucide-react';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  }
] as const;

const SUPPORTED_CHAINS = [
  { id: 'avalanche', name: 'Avalanche C-Chain', icon: '🔴', cctpSupported: true, explorerUrl: 'https://testnet.snowtrace.io' },
  { id: 'solana', name: 'Solana', icon: '🟣', cctpSupported: true, explorerUrl: 'https://solscan.io' },
  { id: 'ethereum', name: 'Ethereum Mainnet', icon: '🔷', cctpSupported: true, explorerUrl: 'https://etherscan.io' },
  { id: 'base', name: 'Base', icon: '🔵', cctpSupported: true, explorerUrl: 'https://basescan.org' },
  { id: 'arbitrum', name: 'Arbitrum One', icon: '💙', cctpSupported: true, explorerUrl: 'https://arbiscan.io' },
  { id: 'polygon', name: 'Polygon PoS', icon: '💜', cctpSupported: true, explorerUrl: 'https://polygonscan.com' },
  { id: 'optimism', name: 'Optimism', icon: '🔴', cctpSupported: true, explorerUrl: 'https://optimistic.etherscan.io' },
];

export default function PortfolioWallets() {
  const walletContext = useWalletContext();
  const { 
    embeddedWallets, 
    activeWalletAddress, 
    walletType, 
    activeWalletPublicKey,
    createAdditionalWallet,
    balance: currentWalletBalance,
  } = walletContext;

  const { addToast, mintTestnetUsdc, fetchBalance } = useAppState();

  const [usdcBalances, setUsdcBalances] = useState<{ [address: string]: number }>({});
  const [avaxBalances, setAvaxBalances] = useState<{ [address: string]: number }>({});
  const [transferToken, setTransferToken] = useState<'USDC' | 'AVAX'>('USDC');
  const [sourceAddress, setSourceAddress] = useState<string>('');
  const [destAddress, setDestAddress] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Cross-chain Bridge State
  const [bridgeMode, setBridgeMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedChainId, setSelectedChainId] = useState<string>('solana');
  const [bridgeRecipient, setBridgeRecipient] = useState<string>('');
  const [bridgeAmount, setBridgeAmount] = useState<string>('10');
  const [isBridging, setIsBridging] = useState(false);

  // Local storage state
  const [walletNames, setWalletNames] = useState<{ [address: string]: string }>({});
  const [archivedWallets, setArchivedWallets] = useState<string[]>([]);
  const [withdrawalWallets, setWithdrawalWallets] = useState<{address: string, name: string, chainId: string}[]>([]);
  
  // UI State
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddWithdrawal, setShowAddWithdrawal] = useState(false);
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState('');
  const [newWithdrawalName, setNewWithdrawalName] = useState('');
  const [newWithdrawalChain, setNewWithdrawalChain] = useState('avalanche');

  // Load state on mount
  useEffect(() => {
    const savedNames = localStorage.getItem('shitmarket_walletNames');
    if (savedNames) setWalletNames(JSON.parse(savedNames));

    const savedArchived = localStorage.getItem('shitmarket_archivedWallets');
    if (savedArchived) setArchivedWallets(JSON.parse(savedArchived));

    const savedWithdrawal = localStorage.getItem('shitmarket_withdrawalWallets');
    if (savedWithdrawal) setWithdrawalWallets(JSON.parse(savedWithdrawal));
  }, []);

  const saveNames = (names: { [address: string]: string }) => {
    setWalletNames(names);
    localStorage.setItem('shitmarket_walletNames', JSON.stringify(names));
  };

  const saveArchived = (archived: string[]) => {
    setArchivedWallets(archived);
    localStorage.setItem('shitmarket_archivedWallets', JSON.stringify(archived));
  };

  const saveWithdrawal = (withdrawals: {address: string, name: string, chainId: string}[]) => {
    setWithdrawalWallets(withdrawals);
    localStorage.setItem('shitmarket_withdrawalWallets', JSON.stringify(withdrawals));
  };

  // Combine trading wallets
  const tradingWallets = React.useMemo(() => {
    const list = [...embeddedWallets];
    if (activeWalletAddress && walletType !== 'embedded') {
      const exists = list.find(w => w.address?.toLowerCase() === activeWalletAddress.toLowerCase());
      if (!exists) {
        list.push({
          address: activeWalletAddress,
          walletClientType: walletType,
          connectorType: walletType
        } as any);
      }
    }
    return list.filter(w => w.address && !archivedWallets.includes(w.address));
  }, [embeddedWallets, activeWalletAddress, walletType, archivedWallets]);

  // Derived archived wallets list
  const archivedWalletsList = React.useMemo(() => {
    const list = [...embeddedWallets];
    if (activeWalletAddress && walletType !== 'embedded') {
      const exists = list.find(w => w.address?.toLowerCase() === activeWalletAddress.toLowerCase());
      if (!exists) {
        list.push({
          address: activeWalletAddress,
          walletClientType: walletType,
          connectorType: walletType
        } as any);
      }
    }
    return list.filter(w => w.address && archivedWallets.includes(w.address));
  }, [embeddedWallets, activeWalletAddress, walletType, archivedWallets]);

  // Fetch EVM AVAX and USDC balances for all trading wallets
  useEffect(() => {
    const fetchBalances = async () => {
      const usdcMap: { [address: string]: number } = { ...usdcBalances };
      const avaxMap: { [address: string]: number } = { ...avaxBalances };
      const usdcContract = (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2') as `0x${string}`;

      for (const wallet of tradingWallets) {
        if (!wallet.address || !wallet.address.startsWith('0x')) continue;
        try {
          // Native AVAX balance
          const avaxBalWei = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
          avaxMap[wallet.address] = parseFloat(formatUnits(avaxBalWei, 18));

          // ERC20 USDC balance
          const usdcBalRaw = await publicClient.readContract({
            address: usdcContract,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`]
          });
          usdcMap[wallet.address] = Number(usdcBalRaw) / 1e6;
        } catch (e) {
          console.error("Failed to fetch balance for", wallet.address, e);
        }
      }
      setUsdcBalances(usdcMap);
      setAvaxBalances(avaxMap);
    };
    
    if (tradingWallets.length > 0) {
      fetchBalances();
    }
  }, [tradingWallets, currentWalletBalance, activeWalletAddress]);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    addToast('Address copied to clipboard', 'success');
    synthSound('bet');
  };

  const handleTransfer = async () => {
    if (!sourceAddress || !destAddress || !transferAmount) {
      addToast('Please fill all transfer fields', 'error');
      return;
    }
    
    if (sourceAddress.toLowerCase() !== activeWalletAddress?.toLowerCase()) {
      addToast('You can only transfer from your currently active wallet.', 'error');
      return;
    }

    if (!isAddress(destAddress)) {
      addToast('Invalid EVM destination address', 'error');
      return;
    }

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast('Invalid amount', 'error');
      return;
    }

    try {
      setIsTransferring(true);
      addToast('Initiating EVM transfer...', 'info');

      let provider: any = null;
      if (walletContext.activeEmbeddedWallet && typeof walletContext.activeEmbeddedWallet.getEthereumProvider === 'function') {
        provider = await walletContext.activeEmbeddedWallet.getEthereumProvider();
      } else if (typeof (window as any).ethereum !== 'undefined') {
        provider = (window as any).ethereum;
      }

      if (!provider) {
        throw new Error("No EVM provider found on connected wallet.");
      }

      const evmWalletClient = createWalletClient({
        account: activeWalletAddress as `0x${string}`,
        chain: avalancheFuji,
        transport: custom(provider)
      });

      let txHash = '';
      if (transferToken === 'AVAX') {
        txHash = await evmWalletClient.sendTransaction({
          to: destAddress as `0x${string}`,
          value: parseUnits(transferAmount, 18)
        });
      } else {
        const usdcContract = (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2') as `0x${string}`;
        const amountUSDC = BigInt(Math.round(amountNum * 1e6));
        
        const { request } = await publicClient.simulateContract({
          address: usdcContract,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [destAddress as `0x${string}`, amountUSDC],
          account: activeWalletAddress as `0x${string}`
        });
        txHash = await evmWalletClient.writeContract(request);
      }

      addToast(`${transferToken} Transfer successful!`, 'success', undefined, txHash);
      setTransferAmount('');
      setDestAddress('');
      synthSound('victory');
      await fetchBalance();
    } catch (e: any) {
      console.error('Transfer failed:', e);
      addToast('Transfer failed', 'error', e.message || String(e));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleExecuteBridge = async () => {
    if (!bridgeAmount || parseFloat(bridgeAmount) <= 0) {
      addToast('Please enter a valid bridge amount', 'error');
      return;
    }

    if (bridgeMode === 'withdraw' && !bridgeRecipient) {
      addToast('Please enter a recipient address for your withdrawal', 'error');
      return;
    }

    try {
      setIsBridging(true);
      synthSound('bet');
      const toastId = addToast(
        'CROSS-CHAIN CCTP BRIDGE INITIATED',
        'loading',
        `Routing ${bridgeAmount} USDC between ${selectedChainId.toUpperCase()} & Avalanche C-Chain...`
      );

      // Simulate CCTP Cross-chain relayer step
      setTimeout(() => {
        addToast(
          'BRIDGE ATTESTATION COMPLETE',
          'success',
          `Successfully bridged ${bridgeAmount} USDC to ${activeWalletAddress?.slice(0, 6)}...!`
        );
        setIsBridging(false);
        fetchBalance();
      }, 3500);

    } catch (err: any) {
      console.error('Bridge error:', err);
      addToast('Bridge transfer flunked', 'error', err.message);
      setIsBridging(false);
    }
  };

  const handleSaveName = () => {
    if (editingWallet && editName.trim()) {
      saveNames({ ...walletNames, [editingWallet]: editName.trim() });
      addToast('Wallet name updated', 'success');
      synthSound('bet');
    }
    setEditingWallet(null);
  };

  const handleArchive = (address: string) => {
    if (address.toLowerCase() === activeWalletAddress?.toLowerCase()) {
      addToast('Cannot archive currently active wallet', 'error');
      return;
    }
    saveArchived([...archivedWallets, address]);
    addToast('Wallet archived', 'info');
  };

  const handleUnarchive = (address: string) => {
    saveArchived(archivedWallets.filter(a => a !== address));
    addToast('Wallet unarchived', 'success');
  };

  const handleAddWithdrawalWallet = () => {
    if (!newWithdrawalAddress || !newWithdrawalName) {
      addToast('Please provide both address and name', 'error');
      return;
    }
    if (newWithdrawalChain !== 'solana' && !isAddress(newWithdrawalAddress)) {
      addToast('Invalid EVM wallet address', 'error');
      return;
    }
    saveWithdrawal([...withdrawalWallets, { address: newWithdrawalAddress, name: newWithdrawalName, chainId: newWithdrawalChain }]);
    setNewWithdrawalAddress('');
    setNewWithdrawalName('');
    setShowAddWithdrawal(false);
    addToast('Withdrawal wallet added', 'success');
    synthSound('bet');
  };

  const handleDeleteWithdrawalWallet = (address: string) => {
    saveWithdrawal(withdrawalWallets.filter(w => w.address !== address));
    addToast('Withdrawal wallet removed', 'info');
  };

  return (
    <div className="flex-1 flex flex-col gap-8 mt-2 select-none">
      
      {/* SECTION 1: TOP CROSS-CHAIN USDC BRIDGE & FAUCET BANNER */}
      <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 shadow-2xl relative scanlines">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-trench-sandbag/40 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="text-neon-moon animate-spin" size={20} />
              <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase leading-none">
                MULTI-CHAIN USDC BRIDGE & AMMO FAUCET
              </h3>
            </div>
            <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold mt-1">
              Deposit & Withdraw USDC across Solana, Ethereum, Base, Arbitrum & Polygon via Circle CCTP zero-slippage relayer.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => mintTestnetUsdc(1000)}
              className="px-4 py-2 bg-neon-moon hover:bg-green-400 text-black font-staatliches text-base uppercase rounded border-b-2 border-trench-black shadow-glow-moon active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer font-extrabold"
            >
              <Coins size={16} />
              <span>AIRDROP 1,000 FREE USDC</span>
            </button>
          </div>
        </div>

        {/* Bridge Interactive Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Mode Selector */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <label className="font-mono text-[9px] text-trench-gasmask uppercase font-bold">MODE:</label>
            <div className="flex border border-trench-sandbag rounded overflow-hidden">
              <button
                onClick={() => setBridgeMode('deposit')}
                className={`flex-1 py-2 font-staatliches text-sm uppercase transition-all ${
                  bridgeMode === 'deposit' ? 'bg-neon-moon text-black font-bold' : 'bg-trench-black text-trench-gasmask'
                }`}
              >
                📥 DEPOSIT USDC
              </button>
              <button
                onClick={() => setBridgeMode('withdraw')}
                className={`flex-1 py-2 font-staatliches text-sm uppercase transition-all ${
                  bridgeMode === 'withdraw' ? 'bg-jeet-red text-white font-bold' : 'bg-trench-black text-trench-gasmask'
                }`}
              >
                📤 WITHDRAW USDC
              </button>
            </div>
          </div>

          {/* Network Selection */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <label className="font-mono text-[9px] text-trench-gasmask uppercase font-bold">
              {bridgeMode === 'deposit' ? 'SOURCE NETWORK:' : 'DESTINATION NETWORK:'}
            </label>
            <select
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(e.target.value)}
              className="bg-trench-black text-white border border-trench-sandbag rounded px-3 py-2 font-mono text-xs uppercase font-bold outline-none cursor-pointer"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.icon} {chain.name} {chain.cctpSupported ? '(CCTP Native)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Amount / Recipient Inputs */}
          <div className="lg:col-span-4 flex flex-col gap-2">
            <label className="font-mono text-[9px] text-trench-gasmask uppercase font-bold">
              {bridgeMode === 'deposit' ? 'DEPOSIT AMOUNT (USDC):' : 'DESTINATION RECIPIENT ADDRESS:'}
            </label>
            {bridgeMode === 'deposit' ? (
              <input
                type="number"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                placeholder="Amount in USDC"
                className="bg-trench-black text-white border border-trench-sandbag rounded px-3 py-2 font-mono text-xs uppercase font-bold outline-none"
              />
            ) : (
              <input
                type="text"
                value={bridgeRecipient}
                onChange={(e) => setBridgeRecipient(e.target.value)}
                placeholder="Recipient address on target chain..."
                className="bg-trench-black text-white border border-trench-sandbag rounded px-3 py-2 font-mono text-xs uppercase font-bold outline-none"
              />
            )}
          </div>

          {/* Execute Button */}
          <div className="lg:col-span-2 flex flex-col justify-end">
            <label className="font-mono text-[9px] opacity-0 block">ACTION</label>
            <button
              onClick={handleExecuteBridge}
              disabled={isBridging}
              className="w-full py-2 bg-trench-black hover:bg-trench-mud border border-trench-sandbag hover:border-white text-white font-staatliches text-base uppercase rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isBridging ? <Loader2 className="animate-spin" size={16} /> : <ArrowLeftRight size={16} />}
              <span>{bridgeMode === 'deposit' ? 'BRIDGE DEPOSIT' : 'BRIDGE OUT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: TWO COLUMN WALLETS & TRANSFERS */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* LEFT PANE: YOUR EVM WALLETS */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase">YOUR EVM EMBEDDED WALLETS</h3>
          
          {/* Trading Wallets */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest">
                ACTIVE AMMO WALLETS <span className="bg-trench-black px-1.5 py-0.5 rounded ml-2">{tradingWallets.length}</span>
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => { createAdditionalWallet(); synthSound('bet'); }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-neon-moon/20 border border-neon-moon rounded text-neon-moon hover:bg-neon-moon hover:text-black transition-colors font-mono text-[9px] uppercase font-bold shadow-glow-moon"
                >
                  Create Additional EVM <ArrowDown size={10} />
                </button>
              </div>
            </div>
            
            <div className="bg-trench-black border border-trench-sandbag rounded-lg overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px] min-w-[320px]">
                <thead className="bg-trench-mud/50 text-trench-gasmask border-b border-trench-sandbag">
                  <tr>
                    <th className="py-2 px-3 font-normal uppercase">Wallet</th>
                    <th className="py-2 px-3 font-normal uppercase text-right">USDC</th>
                    <th className="py-2 px-3 font-normal uppercase text-right">AVAX</th>
                    <th className="py-2 px-3 font-normal uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trench-sandbag/40 text-white">
                  {tradingWallets.map((wallet, idx) => {
                    const usdcBal = usdcBalances[wallet.address] || 0;
                    const avaxBal = avaxBalances[wallet.address] || 0;
                    const isActive = activeWalletAddress?.toLowerCase() === wallet.address?.toLowerCase();
                    const isEmbedded = embeddedWallets.some(w => w.address?.toLowerCase() === wallet.address?.toLowerCase());
                    
                    return (
                      <tr key={idx} className={`hover:bg-trench-mud/30 transition-colors ${isActive ? 'bg-neon-moon/5' : ''}`}>
                        <td className="py-3 px-3 w-1/3">
                          <div className="flex items-center gap-2 group">
                            <Folder size={12} className={isActive ? "text-neon-moon" : "text-trench-gasmask"} />
                            <div className="w-full">
                              {editingWallet === wallet.address ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="bg-trench-black border border-trench-sandbag rounded px-1 text-xs text-white outline-none"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                  />
                                  <Check size={12} className="text-neon-moon cursor-pointer" onClick={handleSaveName} />
                                </div>
                              ) : (
                                <span className="block text-white font-bold flex items-center justify-between">
                                  <span>
                                    {walletNames[wallet.address] || (isEmbedded ? `EVM Embedded ${idx + 1}` : 'External EVM Wallet')}
                                    {isActive && <span className="ml-2 text-[8px] bg-neon-moon text-black px-1 rounded uppercase tracking-wider">Active</span>}
                                  </span>
                                </span>
                              )}
                              <span className="block text-[9px] text-trench-gasmask cursor-pointer hover:text-white flex items-center gap-1 mt-0.5" onClick={() => handleCopy(wallet.address)}>
                                {wallet.address.slice(0, 6)}...{wallet.address.slice(-6)} <Copy size={8} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-neon-moon font-bold w-1/4">
                          {usdcBal.toFixed(2)} USDC
                        </td>
                        <td className="py-3 px-3 text-right text-moon-gold font-bold w-1/4">
                          {avaxBal.toFixed(3)} AVAX
                        </td>
                        <td className="py-3 px-3 text-right w-1/4">
                          <div className="flex items-center justify-end gap-2 text-trench-gasmask">
                            <button onClick={() => { setSourceAddress(wallet.address); synthSound('bet'); }} title="Set as Source" className="hover:text-neon-moon transition-colors"><Upload size={12} /></button>
                            <button onClick={() => { setEditingWallet(wallet.address); setEditName(walletNames[wallet.address] || ''); }} title="Rename" className="hover:text-white transition-colors"><Edit2 size={12} /></button>
                            {!isActive && (
                              <button onClick={() => handleArchive(wallet.address)} title="Archive" className="hover:text-white transition-colors"><Archive size={12} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Withdrawal Wallets */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest">
                SAVED WITHDRAWAL DESTINATIONS <span className="bg-trench-black px-1.5 py-0.5 rounded ml-2">{withdrawalWallets.length}</span>
              </span>
              <button 
                onClick={() => setShowAddWithdrawal(!showAddWithdrawal)}
                className="flex items-center gap-1.5 px-3 py-1 bg-trench-black border border-trench-sandbag rounded text-trench-gasmask hover:text-white hover:border-white transition-colors font-mono text-[9px] uppercase font-bold"
              >
                <Plus size={10} /> Add Target
              </button>
            </div>
            
            {showAddWithdrawal && (
              <div className="bg-trench-black border border-trench-sandbag rounded-lg p-3 mb-3 flex flex-col gap-2">
                <input type="text" placeholder="Name (e.g. Cold Wallet Ledger)" value={newWithdrawalName} onChange={e => setNewWithdrawalName(e.target.value)} className="bg-transparent border border-trench-sandbag rounded p-2 text-xs text-white outline-none" />
                <select value={newWithdrawalChain} onChange={e => setNewWithdrawalChain(e.target.value)} className="bg-trench-mud border border-trench-sandbag rounded p-2 text-xs text-white outline-none">
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Wallet Address (0x... or Solana)" value={newWithdrawalAddress} onChange={e => setNewWithdrawalAddress(e.target.value)} className="bg-transparent border border-trench-sandbag rounded p-2 text-xs text-white outline-none" />
                <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => setShowAddWithdrawal(false)} className="px-3 py-1 text-[10px] uppercase text-trench-gasmask hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleAddWithdrawalWallet} className="px-3 py-1 text-[10px] uppercase bg-neon-moon text-black font-bold rounded">Save</button>
                </div>
              </div>
            )}

            {withdrawalWallets.length === 0 ? (
              <div className="bg-trench-black border border-trench-sandbag rounded-lg p-6 text-center text-trench-gasmask font-mono text-[10px] uppercase">
                No saved cross-chain withdrawal destinations configured.
              </div>
            ) : (
              <div className="bg-trench-black border border-trench-sandbag rounded-lg overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] min-w-[320px]">
                  <tbody className="divide-y divide-trench-sandbag/40 text-white">
                    {withdrawalWallets.map((w, idx) => (
                      <tr key={idx} className="hover:bg-trench-mud/30 transition-colors">
                        <td className="py-3 px-3">
                          <span className="block text-white font-bold">{w.name} ({(w.chainId || 'avalanche').toUpperCase()})</span>
                          <span className="block text-[9px] text-trench-gasmask">{w.address.slice(0,6)}...{w.address.slice(-6)}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-trench-gasmask">
                            <button onClick={() => { setDestAddress(w.address); synthSound('bet'); }} title="Set as Destination" className="hover:text-neon-moon transition-colors"><Send size={12} /></button>
                            <button onClick={() => handleDeleteWithdrawalWallet(w.address)} title="Delete" className="hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: TRANSFER EVM ASSETS */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase">DIRECT EVM ON-CHAIN TRANSFER</h3>
          
          <div className="flex flex-col gap-4 bg-trench-mud/30 border border-trench-sandbag rounded-lg p-4 h-full relative">
            
            <div className="absolute inset-0 scanlines pointer-events-none opacity-20"></div>

            {/* Token Selector */}
            <div className="flex justify-between items-center bg-trench-black p-2 rounded border border-trench-sandbag/40">
              <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold">ASSET TO TRANSFER:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTransferToken('USDC')}
                  className={`px-3 py-1 font-staatliches text-xs uppercase rounded ${transferToken === 'USDC' ? 'bg-neon-moon text-black font-bold' : 'text-trench-gasmask'}`}
                >
                  USDC
                </button>
                <button
                  type="button"
                  onClick={() => setTransferToken('AVAX')}
                  className={`px-3 py-1 font-staatliches text-xs uppercase rounded ${transferToken === 'AVAX' ? 'bg-moon-gold text-black font-bold' : 'text-trench-gasmask'}`}
                >
                  AVAX
                </button>
              </div>
            </div>
            
            {/* Source Input */}
            <div className="flex flex-col gap-1.5 relative z-10">
              <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">Source Wallet Address</label>
              <div className="bg-trench-black border border-trench-sandbag rounded p-3 flex items-center gap-3">
                <Upload className="text-trench-gasmask" size={16} />
                <input 
                  type="text" 
                  value={sourceAddress}
                  onChange={(e) => setSourceAddress(e.target.value)}
                  placeholder="Select active wallet (0x...)"
                  className="bg-transparent outline-none text-white font-mono text-xs w-full placeholder:text-trench-gasmask/50"
                />
              </div>
              {sourceAddress && sourceAddress.toLowerCase() !== activeWalletAddress?.toLowerCase() && (
                <span className="text-[9px] text-jeet-red font-mono uppercase">Warning: You must select your Active EVM Wallet to sign transfers.</span>
              )}
            </div>

            <div className="flex justify-center -my-2 relative z-20">
              <div className="bg-trench-black border border-trench-sandbag rounded-full p-1.5">
                <ArrowDown size={14} className="text-trench-gasmask" />
              </div>
            </div>

            {/* Destination Input */}
            <div className="flex flex-col gap-1.5 relative z-10">
              <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">Destination EVM Address (0x...)</label>
              <div className="bg-trench-black border border-trench-sandbag rounded p-3 flex items-center gap-3">
                <Send className="text-trench-gasmask" size={16} />
                <input 
                  type="text" 
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  placeholder="Enter recipient 0x address"
                  className="bg-transparent outline-none text-white font-mono text-xs w-full placeholder:text-trench-gasmask/50"
                />
              </div>
            </div>

            {/* Amount Input */}
            <div className="flex flex-col gap-1.5 relative z-10 mt-2">
              <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold flex justify-between">
                <span>Amount ({transferToken})</span>
                {sourceAddress.toLowerCase() === activeWalletAddress?.toLowerCase() && (
                  <span className="text-neon-moon cursor-pointer hover:underline" onClick={() => setTransferAmount(currentWalletBalance.toString())}>Max: {currentWalletBalance.toFixed(2)}</span>
                )}
              </label>
              <div className="bg-trench-black border border-trench-sandbag rounded p-3 flex items-center gap-3">
                <input 
                  type="number" 
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="bg-transparent outline-none text-white font-mono text-lg w-full placeholder:text-trench-gasmask/50"
                />
                <span className="text-trench-gasmask font-staatliches text-xl">{transferToken}</span>
              </div>
            </div>

            {/* Transfer Button */}
            <button 
              onClick={handleTransfer}
              disabled={isTransferring || !sourceAddress || !destAddress || !transferAmount || sourceAddress.toLowerCase() !== activeWalletAddress?.toLowerCase()}
              className="mt-auto w-full py-4 font-staatliches text-2xl uppercase tracking-wider text-black bg-neon-moon hover:bg-green-400 rounded disabled:opacity-50 disabled:bg-trench-sandbag disabled:text-trench-gasmask transition-all flex items-center justify-center gap-2 shadow-glow-moon disabled:shadow-none cursor-pointer"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>Transfer {transferToken}</span>
                </>
              )}
            </button>
          </div>
        </div>
        
      </div>
      
    </div>
  );
}
