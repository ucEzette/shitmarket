'use client';

import React, { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { connection } from '@/utils/solanaClient';
import { SystemProgram, PublicKey, Transaction } from '@solana/web3.js';
import { synthSound } from '@/components/ClientWrapper';
import { useAppState, formatPrice } from '@/store/useAppState';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { Folder, Upload, Plus, Send, Check, Copy, ArrowRight, Loader2, ArrowDown, Download, Edit2, Archive, Trash2, Key } from 'lucide-react';

export default function PortfolioWallets() {
  const walletContext = useWalletContext();
  const { 
    embeddedWallets, 
    activeWalletAddress, 
    walletType, 
    isImportedWalletLocked, 
    activeWalletPublicKey,
    createAdditionalWallet,
    importPrivateKeyOrMnemonic,
    sendTransaction,
    balance: currentWalletBalance,
    exportImportedWallet
  } = walletContext;

  const { user, addToast } = useAppState();
  const exportWalletHook = useExportWallet();

  const [balances, setBalances] = useState<{ [address: string]: number }>({});
  const [sourceAddress, setSourceAddress] = useState<string>('');
  const [destAddress, setDestAddress] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Local storage state
  const [walletNames, setWalletNames] = useState<{ [address: string]: string }>({});
  const [archivedWallets, setArchivedWallets] = useState<string[]>([]);
  const [withdrawalWallets, setWithdrawalWallets] = useState<{address: string, name: string}[]>([]);
  
  // UI State
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddWithdrawal, setShowAddWithdrawal] = useState(false);
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState('');
  const [newWithdrawalName, setNewWithdrawalName] = useState('');

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

  const saveWithdrawal = (withdrawals: {address: string, name: string}[]) => {
    setWithdrawalWallets(withdrawals);
    localStorage.setItem('shitmarket_withdrawalWallets', JSON.stringify(withdrawals));
  };

  // Combine trading wallets (embedded + currently active hot wallet + external)
  const tradingWallets = React.useMemo(() => {
    const list = [...embeddedWallets];
    
    // Add current active wallet if it's imported or external and not already in the list
    if (activeWalletAddress && walletType !== 'embedded') {
      const exists = list.find(w => w.address === activeWalletAddress);
      if (!exists) {
        list.push({
          address: activeWalletAddress,
          walletClientType: walletType,
          connectorType: walletType
        } as any);
      }
    }
    // Filter out archived wallets
    return list.filter(w => !archivedWallets.includes(w.address));
  }, [embeddedWallets, activeWalletAddress, walletType, archivedWallets]);

  // Derived archived wallets list
  const archivedWalletsList = React.useMemo(() => {
    const list = [...embeddedWallets];
    if (activeWalletAddress && walletType !== 'embedded') {
      const exists = list.find(w => w.address === activeWalletAddress);
      if (!exists) {
        list.push({
          address: activeWalletAddress,
          walletClientType: walletType,
          connectorType: walletType
        } as any);
      }
    }
    return list.filter(w => archivedWallets.includes(w.address));
  }, [embeddedWallets, activeWalletAddress, walletType, archivedWallets]);

  // Fetch balances for all trading wallets
  useEffect(() => {
    const fetchBalances = async () => {
      const newBalances = { ...balances };
      for (const wallet of tradingWallets) {
        if (!newBalances[wallet.address]) {
          try {
            const bal = await connection.getBalance(new PublicKey(wallet.address));
            newBalances[wallet.address] = bal / 1e9;
          } catch (e) {
            console.error("Failed to fetch balance for", wallet.address, e);
          }
        }
      }
      // Update with current active balance from context for instant updates
      if (activeWalletAddress) {
        newBalances[activeWalletAddress] = currentWalletBalance;
      }
      setBalances(newBalances);
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
    
    if (sourceAddress !== activeWalletAddress) {
      addToast('You can only transfer from your currently active wallet.', 'error');
      return;
    }

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast('Invalid amount', 'error');
      return;
    }

    if (amountNum > currentWalletBalance) {
      addToast('Insufficient funds', 'error');
      return;
    }

    try {
      setIsTransferring(true);
      const destPubkey = new PublicKey(destAddress);
      
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: activeWalletPublicKey!,
          toPubkey: destPubkey,
          lamports: Math.floor(amountNum * 1e9),
        })
      );

      addToast('Initiating transfer...', 'info');
      const sig = await sendTransaction(tx);
      addToast('Transfer successful!', 'success', undefined, sig);
      
      setTransferAmount('');
      setDestAddress('');
      synthSound('victory');
    } catch (e: any) {
      console.error('Transfer failed:', e);
      addToast('Transfer failed', 'error', e.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleExportWallet = async (walletAddress: string) => {
    // Determine wallet type
    const isEmbedded = embeddedWallets.some(w => w.address === walletAddress);
    const isImported = walletType === 'imported' && walletAddress === activeWalletAddress;

    if (isEmbedded && exportWalletHook?.exportWallet) {
      try {
        await exportWalletHook.exportWallet({ address: walletAddress });
      } catch (e) {
        console.error("Failed to export privy wallet", e);
      }
    } else if (isImported) {
      const privKeyStr = exportImportedWallet();
      if (privKeyStr) {
        navigator.clipboard.writeText(privKeyStr);
        addToast('Private Key copied to clipboard', 'success');
      } else {
        addToast('Wallet is locked, cannot export', 'error');
      }
    } else {
      addToast('Cannot export this external wallet', 'error');
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
    if (address === activeWalletAddress) {
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
    try {
      new PublicKey(newWithdrawalAddress); // Validate address
    } catch {
      addToast('Invalid Solana address', 'error');
      return;
    }
    saveWithdrawal([...withdrawalWallets, { address: newWithdrawalAddress, name: newWithdrawalName }]);
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
    <div className="flex-1 flex flex-col md:flex-row gap-6 mt-2">
      
      {/* LEFT PANE: YOUR WALLETS */}
      <div className="w-full md:w-1/2 flex flex-col gap-6">
        <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase">Your wallets</h3>
        
        {/* Trading Wallets */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest">
              Trading Wallets <span className="bg-trench-black px-1.5 py-0.5 rounded ml-2">{tradingWallets.length}</span>
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => { walletContext.setIsModalOpen(true); synthSound('bet'); }}
                className="flex items-center gap-1.5 px-3 py-1 bg-trench-black border border-trench-sandbag rounded text-trench-gasmask hover:text-white hover:border-white transition-colors font-mono text-[9px] uppercase font-bold"
              >
                <Upload size={10} />
                Import
              </button>
              <button 
                onClick={() => { createAdditionalWallet(); synthSound('bet'); }}
                className="flex items-center gap-1.5 px-3 py-1 bg-neon-moon/20 border border-neon-moon rounded text-neon-moon hover:bg-neon-moon hover:text-black transition-colors font-mono text-[9px] uppercase font-bold shadow-glow-moon"
              >
                Create <ArrowDown size={10} />
              </button>
            </div>
          </div>
          
          <div className="bg-trench-black border border-trench-sandbag rounded-lg overflow-hidden">
            <table className="w-full text-left font-mono text-[10px]">
              <thead className="bg-trench-mud/50 text-trench-gasmask border-b border-trench-sandbag">
                <tr>
                  <th className="py-2 px-3 font-normal uppercase">Wallet</th>
                  <th className="py-2 px-3 font-normal uppercase text-right">Balance</th>
                  <th className="py-2 px-3 font-normal uppercase text-center">Holdings</th>
                  <th className="py-2 px-3 font-normal uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trench-sandbag/40 text-white">
                {tradingWallets.map((wallet, idx) => {
                  const bal = balances[wallet.address] || 0;
                  const isActive = activeWalletAddress === wallet.address;
                  const isEmbedded = embeddedWallets.some(w => w.address === wallet.address);
                  
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
                                  {walletNames[wallet.address] || (isEmbedded ? `Embedded Wallet ${idx + 1}` : 'Imported Wallet')}
                                  {isActive && <span className="ml-2 text-[8px] bg-neon-moon text-black px-1 rounded uppercase tracking-wider">Active</span>}
                                </span>
                              </span>
                            )}
                            <span className="block text-[9px] text-trench-gasmask cursor-pointer hover:text-white flex items-center gap-1 mt-0.5" onClick={() => handleCopy(wallet.address)}>
                              {wallet.address.slice(0, 4)}...{wallet.address.slice(-4)} <Copy size={8} />
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-neon-moon font-bold w-1/4">
                        {bal.toFixed(3)} SOL
                      </td>
                      <td className="py-3 px-3 text-center text-trench-gasmask w-1/6">
                        0 tokens
                      </td>
                      <td className="py-3 px-3 text-right w-1/4">
                        <div className="flex items-center justify-end gap-2 text-trench-gasmask">
                          <button onClick={() => { setSourceAddress(wallet.address); synthSound('bet'); }} title="Set as Source" className="hover:text-neon-moon transition-colors"><Upload size={12} /></button>
                          <button onClick={() => handleExportWallet(wallet.address)} title="Export Private Key" className="hover:text-white transition-colors"><Key size={12} /></button>
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
              Withdrawal Wallets <span className="bg-trench-black px-1.5 py-0.5 rounded ml-2">{withdrawalWallets.length}</span>
            </span>
            <button 
              onClick={() => setShowAddWithdrawal(!showAddWithdrawal)}
              className="flex items-center gap-1.5 px-3 py-1 bg-trench-black border border-trench-sandbag rounded text-trench-gasmask hover:text-white hover:border-white transition-colors font-mono text-[9px] uppercase font-bold"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          
          {showAddWithdrawal && (
            <div className="bg-trench-black border border-trench-sandbag rounded-lg p-3 mb-3 flex flex-col gap-2">
              <input type="text" placeholder="Name (e.g. My Ledger)" value={newWithdrawalName} onChange={e => setNewWithdrawalName(e.target.value)} className="bg-transparent border border-trench-sandbag rounded p-2 text-xs text-white outline-none" />
              <input type="text" placeholder="Solana Address" value={newWithdrawalAddress} onChange={e => setNewWithdrawalAddress(e.target.value)} className="bg-transparent border border-trench-sandbag rounded p-2 text-xs text-white outline-none" />
              <div className="flex justify-end gap-2 mt-1">
                <button onClick={() => setShowAddWithdrawal(false)} className="px-3 py-1 text-[10px] uppercase text-trench-gasmask hover:text-white transition-colors">Cancel</button>
                <button onClick={handleAddWithdrawalWallet} className="px-3 py-1 text-[10px] uppercase bg-neon-moon text-black font-bold rounded">Save</button>
              </div>
            </div>
          )}

          {withdrawalWallets.length === 0 ? (
            <div className="bg-trench-black border border-trench-sandbag rounded-lg p-6 text-center text-trench-gasmask font-mono text-[10px] uppercase">
              You don't have any withdrawal wallets
            </div>
          ) : (
            <div className="bg-trench-black border border-trench-sandbag rounded-lg overflow-hidden">
              <table className="w-full text-left font-mono text-[10px]">
                <tbody className="divide-y divide-trench-sandbag/40 text-white">
                  {withdrawalWallets.map((w, idx) => (
                    <tr key={idx} className="hover:bg-trench-mud/30 transition-colors">
                      <td className="py-3 px-3">
                        <span className="block text-white font-bold">{w.name}</span>
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

        {/* Archived Wallets */}
        {archivedWalletsList.length > 0 && (
          <div className="mt-4 opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest">
                Archived Wallets <span className="bg-trench-black px-1.5 py-0.5 rounded ml-2">{archivedWalletsList.length}</span>
              </span>
            </div>
            <div className="bg-trench-black border border-trench-sandbag rounded-lg overflow-hidden">
              <table className="w-full text-left font-mono text-[10px]">
                <tbody className="divide-y divide-trench-sandbag/40 text-trench-gasmask">
                  {archivedWalletsList.map((wallet, idx) => (
                    <tr key={idx} className="hover:bg-trench-mud/30 transition-colors">
                      <td className="py-2 px-3 line-through">
                        {walletNames[wallet.address] || `Wallet ${idx + 1}`} ({wallet.address.slice(0,4)}...{wallet.address.slice(-4)})
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => handleUnarchive(wallet.address)} className="text-[9px] uppercase border border-trench-sandbag px-2 py-1 rounded hover:bg-white hover:text-black transition-colors">
                          Unarchive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANE: TRANSFER ASSETS */}
      <div className="w-full md:w-1/2 flex flex-col gap-6">
        <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase">Transfer assets</h3>
        
        <div className="flex flex-col gap-4 bg-trench-mud/30 border border-trench-sandbag rounded-lg p-4 h-full relative">
          
          <div className="absolute inset-0 scanlines pointer-events-none opacity-20"></div>
          
          {/* Source Input */}
          <div className="flex flex-col gap-1.5 relative z-10">
            <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">Source</label>
            <div className="bg-trench-black border border-trench-sandbag rounded p-3 flex items-center gap-3">
              <Upload className="text-trench-gasmask" size={16} />
              <input 
                type="text" 
                value={sourceAddress}
                onChange={(e) => setSourceAddress(e.target.value)}
                placeholder="Select or enter source wallet"
                className="bg-transparent outline-none text-white font-mono text-xs w-full placeholder:text-trench-gasmask/50"
              />
            </div>
            {sourceAddress && sourceAddress !== activeWalletAddress && (
              <span className="text-[9px] text-jeet-red font-mono uppercase">Warning: You must select your Active Wallet to sign transfers.</span>
            )}
          </div>

          <div className="flex justify-center -my-2 relative z-20">
            <div className="bg-trench-black border border-trench-sandbag rounded-full p-1.5">
              <ArrowDown size={14} className="text-trench-gasmask" />
            </div>
          </div>

          {/* Destination Input */}
          <div className="flex flex-col gap-1.5 relative z-10">
            <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">Destination</label>
            <div className="bg-trench-black border border-trench-sandbag rounded p-3 flex items-center gap-3">
              <Send className="text-trench-gasmask" size={16} />
              <input 
                type="text" 
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                placeholder="Enter destination address"
                className="bg-transparent outline-none text-white font-mono text-xs w-full placeholder:text-trench-gasmask/50"
              />
            </div>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-1.5 relative z-10 mt-2">
            <label className="font-mono text-[10px] text-trench-gasmask uppercase font-bold flex justify-between">
              <span>Amount (SOL)</span>
              {sourceAddress === activeWalletAddress && (
                <span className="text-neon-moon cursor-pointer hover:underline" onClick={() => setTransferAmount((currentWalletBalance - 0.005).toString())}>Max: {currentWalletBalance.toFixed(4)}</span>
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
              <span className="text-trench-gasmask font-staatliches text-xl">SOL</span>
            </div>
          </div>

          {/* Transfer Button */}
          <button 
            onClick={handleTransfer}
            disabled={isTransferring || !sourceAddress || !destAddress || !transferAmount || sourceAddress !== activeWalletAddress}
            className="mt-auto w-full py-4 font-staatliches text-2xl uppercase tracking-wider text-black bg-neon-moon hover:bg-green-400 rounded disabled:opacity-50 disabled:bg-trench-sandbag disabled:text-trench-gasmask transition-all flex items-center justify-center gap-2 shadow-glow-moon disabled:shadow-none"
          >
            {isTransferring ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Transfer Assets</span>
              </>
            )}
          </button>
        </div>
      </div>
      
    </div>
  );
}
