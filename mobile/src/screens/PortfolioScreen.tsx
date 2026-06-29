import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Clipboard,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useAppState, formatCashtag, formatPrice } from '../store/useAppState';
import { useWalletContext } from '../components/WalletProvider';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';
import { SystemProgram, PublicKey, Transaction } from '@solana/web3.js';
import { connection } from '../utils/solanaClient';

export default function PortfolioScreen({ navigation }: any) {
  const { 
    user, 
    rooms, 
    fetchRooms, 
    refreshProfile, 
    claimReferralRewardsOnChain, 
    settings, 
    updateSettings 
  } = useAppState();
  
  const walletContext = useWalletContext();
  const { 
    tradingWallets = [], 
    activeWalletAddress, 
    walletType, 
    balance: activeBalance,
    sendTransaction,
    activeWalletPublicKey,
    disconnect,
    exportImportedWallet,
    forgetWallet
  } = walletContext as any;

  const [activeTab, setActiveTab] = useState<'positions' | 'trades' | 'referrals' | 'wallets' | 'settings'>('positions');
  
  // SOL Transfer form state
  const [destAddress, setDestAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Settings panel state
  const [estimatedFees, setEstimatedFees] = useState<{ low: number; medium: number; high: number; turbo: number } | null>(null);
  const [congestionStatus, setCongestionStatus] = useState<'LOW' | 'NORMAL' | 'CONGESTED' | 'CRITICAL'>('NORMAL');
  const [fetchingFees, setFetchingFees] = useState(false);

  const [customFeeText, setCustomFeeText] = useState(settings.customPriorityFee.toString());
  const [customSlipText, setCustomSlipText] = useState(settings.slippage.toString());
  const [isCustomSlip, setIsCustomSlip] = useState(![0.5, 1.0, 3.0].includes(settings.slippage));

  // Live prices and claiming state
  const [livePrices, setLivePrices] = useState<{ [address: string]: number }>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [claimingRoomId, setClaimingRoomId] = useState<string | null>(null);

  // Sync profile details, wagers, and rooms on mount and periodically
  useEffect(() => {
    fetchRooms().catch(console.error);
    refreshProfile().catch(console.error);

    const interval = setInterval(() => {
      fetchRooms().catch(console.error);
      refreshProfile().catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeWalletAddress]);

  // Timer clock ticking for countdowns
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  useEffect(() => {
    const updateTimers = () => {
      const texts: { [id: string]: string } = {};
      const now = Date.now();

      rooms.forEach((room) => {
        if (room.status !== 'active') {
          texts[room.id] = 'SETTLED';
          return;
        }

        const delta = room.expiry - now;
        if (delta <= 0) {
          texts[room.id] = 'SETTLING...';
          return;
        }

        const hrs = Math.floor(delta / 3600000);
        const mins = Math.floor((delta % 3600000) / 60000);
        const secs = Math.floor((delta % 60000) / 1000);

        const format = (val: number) => String(val).padStart(2, '0');
        texts[room.id] = `${format(hrs)}:${format(mins)}:${format(secs)}`;
      });

      setTimeRemainingText(texts);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [rooms]);

  // Fetch live token prices from DexScreener for all user bet tokens
  useEffect(() => {
    if (!user || !user.bets || user.bets.length === 0) return;

    const fetchBetPrices = async () => {
      setIsLoadingPrices(true);
      const addressesToFetch = Array.from(
        new Set(
          user.bets
            .map((b) => rooms.find((r) => r.id === b.roomId)?.token.address)
            .filter((addr): addr is string => !!addr)
        )
      );

      if (addressesToFetch.length === 0) {
        setIsLoadingPrices(false);
        return;
      }

      const priceMap: { [address: string]: number } = {};
      try {
        await Promise.all(
          addressesToFetch.map(async (address) => {
            try {
              const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
              if (res.ok) {
                const json = await res.json();
                const pairs = json?.pairs || [];
                if (pairs.length > 0) {
                  const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                  const price = parseFloat(sorted[0].priceUsd);
                  if (isFinite(price) && price > 0) {
                    priceMap[address] = price;
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch live price for token ${address}:`, e);
            }
          })
        );
        setLivePrices((prev) => ({ ...prev, ...priceMap }));
      } catch (err) {
        console.error('Failed to fetch token prices:', err);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchBetPrices();
    const priceInterval = setInterval(fetchBetPrices, 10000);
    return () => clearInterval(priceInterval);
  }, [user?.bets, rooms]);

  // Sync priority fees from RPC when settings tab loads
  useEffect(() => {
    if (activeTab !== 'settings') return;
    let active = true;
    const fetchFees = async () => {
      setFetchingFees(true);
      try {
        const recentFees = await connection.getRecentPrioritizationFees();
        if (!active) return;
        if (recentFees && recentFees.length > 0) {
          const sorted = recentFees.map(f => f.prioritizationFee).sort((a, b) => b - a);
          const maxFee = sorted[0] || 0;
          const avgFee = sorted.reduce((sum, f) => sum + f, 0) / sorted.length;
          
          const estLow = Math.max(5_000, Math.round(avgFee * 0.5));
          const estMed = Math.max(50_000, Math.round(avgFee));
          const estHigh = Math.max(250_000, Math.round(avgFee * 2));
          const estTurbo = Math.max(2_000_000, Math.round(maxFee * 1.5));
          
          setEstimatedFees({
            low: estLow,
            medium: estMed,
            high: estHigh,
            turbo: estTurbo
          });
          
          if (maxFee > 5_000_000) {
            setCongestionStatus('CRITICAL');
          } else if (maxFee > 1_000_000) {
            setCongestionStatus('CONGESTED');
          } else if (avgFee > 50_000) {
            setCongestionStatus('NORMAL');
          } else {
            setCongestionStatus('LOW');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch priority fees:", err);
      } finally {
        if (active) setFetchingFees(false);
      }
    };
    fetchFees();
    return () => { active = false; };
  }, [activeTab]);

  const getPriorityLabel = (key: string) => {
    if (!estimatedFees || key === 'custom') {
      if (key === 'low') return 'LOW';
      if (key === 'medium') return 'MED';
      if (key === 'high') return 'HIGH';
      if (key === 'turbo') return 'TURBO';
      return 'CUSTOM';
    }
    const val = estimatedFees[key as keyof typeof estimatedFees];
    let displayVal = '';
    if (val >= 1_000_000) {
      displayVal = `${(val / 1_000_000).toFixed(1)}M`;
    } else if (val >= 1_000) {
      displayVal = `${(val / 1_000).toFixed(0)}K`;
    } else {
      displayVal = `${val}`;
    }
    return `${key.toUpperCase()} (${displayVal})`;
  };

  const getSlippageWarning = (slip: number) => {
    if (slip < 0.5) {
      return {
        type: 'warning',
        text: 'LOW SLIPPAGE: BET MIGHT FAIL DURING HIGH VOLATILITY.'
      };
    }
    if (slip > 10.0) {
      return {
        type: 'danger',
        text: 'HIGH SLIPPAGE: EXPOSES WAGER TO SANDWICH ATTACK FRONTRUNS.'
      };
    }
    return null;
  };

  const handlePrioritySelect = (type: any) => {
    updateSettings({ priorityFeeType: type });
  };

  const handleSlippageSelect = (val: any) => {
    if (val === 'custom') {
      setIsCustomSlip(true);
    } else {
      setIsCustomSlip(false);
      updateSettings({ slippage: val });
    }
  };

  const handleCustomFeeChangeText = (val: string) => {
    setCustomFeeText(val);
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) {
      updateSettings({ customPriorityFee: num });
    }
  };

  const handleCustomSlipChangeText = (val: string) => {
    setCustomSlipText(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      updateSettings({ slippage: num });
    }
  };

  const handleCopy = (address: string) => {
    Clipboard.setString(address);
    Alert.alert("Copied", "Address copied to clipboard!");
  };

  const handleExportKey = () => {
    if (walletType === 'imported') {
      const pKey = exportImportedWallet();
      if (pKey) {
        Clipboard.setString(pKey);
        Alert.alert("Export Success", "Private key copied to clipboard! Keep it secure.");
      } else {
        Alert.alert("Lock Alert", "Hot wallet is locked. Please unlock first.");
      }
    } else {
      Alert.alert("Export Error", "Only imported hot wallets can be exported.");
    }
  };

  const handleTransfer = async () => {
    if (!destAddress.trim() || !transferAmount.trim()) {
      Alert.alert("Error", "Please fill out all fields.");
      return;
    }
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (amt > activeBalance) {
      Alert.alert("Error", "Insufficient balance.");
      return;
    }

    setTransferring(true);
    try {
      const destPub = new PublicKey(destAddress.trim());
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: activeWalletPublicKey!,
          toPubkey: destPub,
          lamports: Math.floor(amt * 1e9),
        })
      );

      const sig = await sendTransaction(tx);
      Alert.alert("Success", `SOL Transferred successfully! Tx: ${sig.slice(0, 8)}...`);
      setTransferAmount('');
      setDestAddress('');
      refreshProfile();
    } catch (e: any) {
      Alert.alert("Transfer Failed", e?.message || "Transaction failed.");
    } finally {
      setTransferring(false);
    }
  };

  const handleClaimReferral = async () => {
    try {
      await claimReferralRewardsOnChain();
      Alert.alert("Success", "Referral rewards claimed on-chain!");
    } catch (e: any) {
      Alert.alert("Claim Failed", e?.message || "Could not claim referral rewards.");
    }
  };

  const handleClaimWinnings = async (roomId: string) => {
    setClaimingRoomId(roomId);
    try {
      await useAppState.getState().claimWinnings(roomId);
      Alert.alert("Success", "Winnings claimed successfully!");
    } catch (e: any) {
      Alert.alert("Claim Failed", e?.message || "Could not claim winnings.");
    } finally {
      setClaimingRoomId(null);
    }
  };

  const handleOpenTx = (txSig: string) => {
    const url = `https://solscan.io/tx/${txSig}?cluster=devnet`;
    Linking.openURL(url).catch(err => {
      console.warn("Could not load Solscan link:", err);
    });
  };

  if (!activeWalletAddress) {
    return (
      <SafeAreaView style={[COMMON_STYLES.container, styles.center]}>
        <Text style={styles.noWalletText}>NO WALLET DETECTED</Text>
        <Text style={styles.noWalletSub}>Connect a crypto helmet to review your profile headquarters.</Text>
      </SafeAreaView>
    );
  }

  // --- Calculations for Portfolio Assets ---
  const parsedPositions = (user?.bets || []).map((bet) => {
    const room = rooms.find((r) => r.id === bet.roomId);
    const token = room?.token;
    const isSettled = room ? room.status === 'settled' : false;
    
    // Live price from DexScreener, fallback to opening price or 0
    const livePrice = token ? livePrices[token.address] || room.openingPrice || 0 : 0;
    const openingPrice = room?.openingPrice || 0;

    let isWinning = false;
    let multiplier = 1.0;
    let netPayout = 0;
    let pnl = 0;
    let pnlPercent = 0;

    if (room) {
      const moonPool = room.moonPool || 0.01;
      const jeetPool = room.jeetPool || 0.01;
      const totalPool = moonPool + jeetPool;
      const netTotalPot = totalPool * 0.9875; // 1.25% fee

      if (bet.side === 'moon') {
        isWinning = livePrice > openingPrice;
        multiplier = totalPool > 0 ? netTotalPot / moonPool : 1.0;
      } else {
        isWinning = livePrice < openingPrice;
        multiplier = totalPool > 0 ? netTotalPot / jeetPool : 1.0;
      }

      if (isSettled) {
        const won = room.winner === bet.side;
        if (won) {
          netPayout = bet.amount * multiplier;
          pnl = netPayout - bet.amount;
          pnlPercent = ((netPayout - bet.amount) / bet.amount) * 100;
        } else {
          pnl = -bet.amount;
          pnlPercent = -100;
        }
      } else {
        // Active Position
        if (isWinning) {
          netPayout = bet.amount * multiplier;
          pnl = netPayout - bet.amount;
          pnlPercent = ((netPayout - bet.amount) / bet.amount) * 100;
        } else {
          pnl = -bet.amount;
          pnlPercent = -100;
        }
      }
    }

    return {
      bet,
      room,
      token,
      isSettled,
      livePrice,
      openingPrice,
      isWinning,
      multiplier,
      pnl,
      pnlPercent,
      cost: bet.amount
    };
  });

  const openPositions = parsedPositions.filter((p) => p.room && p.room.status === 'active');
  const settledPositions = parsedPositions.filter((p) => p.isSettled);

  // Summary statistics totals
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);
  const realizedPnl = settledPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalVolume = parsedPositions.reduce((sum, p) => sum + p.cost, 0);

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      {/* 1. Header Faction details */}
      <View style={styles.profileHeader}>
        <View style={styles.profileMain}>
          <Text style={styles.avatar}>🎖️</Text>
          <View>
            <Text style={styles.username}>
              {user?.username || `COMMANDER_${activeWalletAddress.slice(0, 4).toUpperCase()}`}
            </Text>
            <Text style={styles.walletAddr} onPress={() => handleCopy(activeWalletAddress)}>
              {activeWalletAddress.slice(0, 6)}...{activeWalletAddress.slice(-6)} 📋
            </Text>
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <Text style={styles.badgeLabel}>TRENCH SCORE</Text>
          <Text style={styles.badgeVal}>{user?.trenchScore || 'D'}</Text>
        </View>
      </View>

      {/* 2. Premium 4 Stats Badges Grid */}
      <View style={styles.summaryGrid}>
        <View style={[COMMON_STYLES.premiumCard, styles.summaryCard]}>
          <Text style={styles.summaryLabel}>AMMO BALANCE</Text>
          <Text style={styles.summaryVal}>
            {activeBalance.toFixed(3)} SOL
          </Text>
          <Text style={styles.summarySub}>IN CORE VAULT</Text>
        </View>

        <View style={[COMMON_STYLES.premiumCard, styles.summaryCard]}>
          <Text style={styles.summaryLabel}>UNREALIZED PNL</Text>
          <Text style={[
            styles.summaryVal,
            unrealizedPnl >= 0 ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
          ]}>
            {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(3)} SOL
          </Text>
          <Text style={styles.summarySub}>{openPositions.length} OPEN CHANNELS</Text>
        </View>

        <View style={[COMMON_STYLES.premiumCard, styles.summaryCard]}>
          <Text style={styles.summaryLabel}>REALIZED PNL</Text>
          <Text style={[
            styles.summaryVal,
            realizedPnl >= 0 ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
          ]}>
            {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(3)} SOL
          </Text>
          <Text style={styles.summarySub}>{settledPositions.length} BATTLES RESOLVED</Text>
        </View>

        <View style={[COMMON_STYLES.premiumCard, styles.summaryCard]}>
          <Text style={styles.summaryLabel}>TOTAL VOLUME</Text>
          <Text style={[styles.summaryVal, { color: COLORS.gold }]}>
            {totalVolume.toFixed(3)} SOL
          </Text>
          <Text style={styles.summarySub}>{user?.bets?.length || 0} WAGERS</Text>
        </View>
      </View>

      {/* 3. Sub Tabs Navigator */}
      <View style={styles.tabBar}>
        {[
          { key: 'positions', label: `POSITIONS (${openPositions.length})` },
          { key: 'trades', label: 'TRADES' },
          { key: 'referrals', label: 'REFERRALS' },
          { key: 'wallets', label: 'WALLETS' },
          { key: 'settings', label: 'SETTINGS' }
        ].map((tabInfo) => (
          <TouchableOpacity
            key={tabInfo.key}
            style={[styles.tab, activeTab === tabInfo.key ? styles.activeTab : null]}
            onPress={() => setActiveTab(tabInfo.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tabInfo.key ? styles.activeTabText : null]}>
              {tabInfo.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* TAB 1: POSITIONS */}
        {activeTab === 'positions' && (
          <View style={styles.pane}>
            {openPositions.length > 0 ? (
              openPositions.map((pos, idx) => {
                const room = pos.room!;
                const token = pos.token!;
                const timeText = timeRemainingText[room.id] || '00:00:00';
                const pnlIsPositive = pos.pnl >= 0;

                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[COMMON_STYLES.premiumCard, styles.positionCard]}
                    onPress={() => navigation.navigate('Room', { roomId: room.id })}
                  >
                    <View style={styles.positionHeader}>
                      <View>
                        <Text style={styles.positionTitle}>
                          {token.name} ({formatCashtag(token.symbol)})
                        </Text>
                        <Text style={styles.positionRoomSub}>
                          SECTOR: {room.id.slice(0, 12)}...
                        </Text>
                      </View>
                      <View style={[
                        styles.sideBadge,
                        pos.bet.side === 'moon' ? styles.sideBadgeMoon : styles.sideBadgeJeet
                      ]}>
                        <Text style={pos.bet.side === 'moon' ? styles.sideBadgeMoonText : styles.sideBadgeJeetText}>
                          {pos.bet.side.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.positionRow}>
                      <View style={styles.positionCol}>
                        <Text style={styles.positionColLabel}>STAKE</Text>
                        <Text style={styles.positionColVal}>{pos.cost.toFixed(2)} SOL</Text>
                      </View>
                      <View style={styles.positionCol}>
                        <Text style={styles.positionColLabel}>STRIKE / LIVE</Text>
                        <Text style={styles.positionColVal}>
                          ${formatPrice(pos.openingPrice)} /{' '}
                          <Text style={pos.isWinning ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }}>
                            ${formatPrice(pos.livePrice)}
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.positionCol}>
                        <Text style={styles.positionColLabel}>REMAINING</Text>
                        <Text style={styles.positionTimeText}>⏳ {timeText}</Text>
                      </View>
                    </View>

                    <View style={styles.positionFooter}>
                      <Text style={styles.positionPnlLabel}>LIVE ESTIMATE PNL:</Text>
                      <Text style={[
                        styles.positionPnlVal,
                        pnlIsPositive ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
                      ]}>
                        {pnlIsPositive ? '+' : ''}{pos.pnl.toFixed(3)} SOL ({pnlIsPositive ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>NO ACTIVE ALLIANCES FOUND IN CORE SYSTEM.</Text>
            )}
          </View>
        )}

        {/* TAB 2: TRADES */}
        {activeTab === 'trades' && (
          <View style={styles.pane}>
            {user?.bets && user.bets.length > 0 ? (
              parsedPositions.map((pos, idx) => {
                const room = pos.room;
                const symbol = room ? room.token.symbol : 'UNKNOWN';
                const pnlIsPositive = pos.pnl >= 0;
                const isSettled = pos.isSettled;

                return (
                  <View key={idx} style={[COMMON_STYLES.premiumCard, styles.tradeCard]}>
                    <View style={styles.tradeHeader}>
                      <View>
                        <Text style={styles.tradeTitle}>{symbol} — {pos.bet.side.toUpperCase()}</Text>
                        <Text style={styles.tradeTimeSub}>
                          {new Date(pos.bet.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.tradeOutcomeBox}>
                        {!room || room.status === 'active' ? (
                          <View style={styles.outcomeBadgeActive}>
                            <Text style={styles.outcomeBadgeActiveText}>ACTIVE</Text>
                          </View>
                        ) : room.winner === pos.bet.side ? (
                          <View style={styles.outcomeBadgeWin}>
                            <Text style={styles.outcomeBadgeWinText}>WON</Text>
                          </View>
                        ) : (
                          <View style={styles.outcomeBadgeLoss}>
                            <Text style={styles.outcomeBadgeLossText}>REKT</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.tradeRow}>
                      <View>
                        <Text style={styles.tradeLabel}>STAKED AMOUNT</Text>
                        <Text style={styles.tradeVal}>{pos.cost.toFixed(2)} SOL</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.tradeLabel}>REALIZED PNL</Text>
                        <Text style={[
                          styles.tradeVal,
                          pnlIsPositive ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
                        ]}>
                          {pnlIsPositive ? '+' : ''}{pos.pnl.toFixed(3)} SOL ({pnlIsPositive ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tradeActionRow}>
                      {pos.bet.txSig && (
                        <TouchableOpacity onPress={() => handleOpenTx(pos.bet.txSig!)}>
                          <Text style={styles.solscanLink}>🔍 View on Solscan</Text>
                        </TouchableOpacity>
                      )}
                      
                      {isSettled && room && room.winner === pos.bet.side && (
                        !pos.bet.claimed ? (
                          <TouchableOpacity
                            style={styles.claimWinningsBtn}
                            onPress={() => handleClaimWinnings(pos.bet.roomId)}
                            disabled={claimingRoomId === pos.bet.roomId}
                          >
                            {claimingRoomId === pos.bet.roomId ? (
                              <ActivityIndicator size="small" color="#000" />
                            ) : (
                              <Text style={styles.claimWinningsText}>CLAIM SOL SPOILS 💣</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.claimedText}>✓ CLAIMED</Text>
                        )
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>NO TRADES RECORDED ON THIS HELMET ID.</Text>
            )}
          </View>
        )}

        {/* REFERRALS TAB */}
        {activeTab === 'referrals' && (
          <View style={styles.pane}>
            <View style={[COMMON_STYLES.premiumCard, styles.refCard]}>
              <Text style={styles.refTitle}>YOUR REFERRAL SYSTEM</Text>
              <Text style={styles.refSubtitle}>SHARE TACTICAL LINKS & EARN SOL COMMISSION</Text>
              
              <View style={styles.refMetrics}>
                <View style={styles.refMetric}>
                  <Text style={styles.refMetricLabel}>CODE</Text>
                  <Text style={styles.refMetricVal} onPress={() => handleCopy(user?.referralCode || '')}>
                    {user?.referralCode || 'NONE'} 📋
                  </Text>
                </View>
                <View style={styles.refMetric}>
                  <Text style={styles.refMetricLabel}>RECRUITS</Text>
                  <Text style={styles.refMetricVal}>{user?.referralsCount || 0}</Text>
                </View>
                <View style={styles.refMetric}>
                  <Text style={styles.refMetricLabel}>EARNINGS</Text>
                  <Text style={styles.refMetricVal}>{user?.referralEarnings || '0'} SOL</Text>
                </View>
              </View>

              <View style={styles.claimBox}>
                <Text style={styles.claimLabel}>UNCLAIMED VAULT COMMISSION:</Text>
                <Text style={styles.claimAmount}>{(user?.unclaimedReferralRewards || 0).toFixed(4)} SOL</Text>
                
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={handleClaimReferral}
                  disabled={(user?.unclaimedReferralRewards || 0) <= 0}
                >
                  <Text style={styles.claimBtnText}>SECURE SPOILS FROM VAULT 💣</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* WALLETS TAB */}
        {activeTab === 'wallets' && (
          <View style={styles.pane}>
            {/* Wallet metadata */}
            <View style={[COMMON_STYLES.premiumCard, styles.walletInfoCard]}>
              <Text style={styles.walletHeading}>ACTIVE SOLANA VAULT</Text>
              <View style={styles.walletDetailsRow}>
                <Text style={styles.walletDetailsLabel}>TYPE:</Text>
                <Text style={styles.walletDetailsVal}>{walletType?.toUpperCase()}</Text>
              </View>
              <View style={styles.walletDetailsRow}>
                <Text style={styles.walletDetailsLabel}>BALANCE:</Text>
                <Text style={styles.walletDetailsVal}>{activeBalance.toFixed(4)} SOL</Text>
              </View>

              <View style={styles.walletBtnRow}>
                {walletType === 'imported' && (
                  <TouchableOpacity style={styles.walletActionBtn} onPress={handleExportKey}>
                    <Text style={styles.walletActionText}>EXPORT KEY 🔑</Text>
                  </TouchableOpacity>
                )}
                {walletType === 'imported' && (
                  <TouchableOpacity style={[styles.walletActionBtn, { borderColor: COLORS.jeetRed }]} onPress={forgetWallet}>
                    <Text style={[styles.walletActionText, { color: COLORS.jeetRed }]}>FORGET</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.walletActionBtn, { borderColor: COLORS.jeetRed }]} onPress={disconnect}>
                  <Text style={[styles.walletActionText, { color: COLORS.jeetRed }]}>LOG OUT</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Asset Transfer form */}
            <View style={[COMMON_STYLES.premiumCard, styles.transferCard]}>
              <Text style={styles.refTitle}>TRANSFER ASSETS (WITHDRAW)</Text>
              
              <Text style={styles.inputLabel}>DESTINATION ADDRESS (SOLANA):</Text>
              <TextInput
                style={styles.input}
                placeholder="PASTE TARGET PUBLIC KEY..."
                placeholderTextColor="rgba(163, 150, 130, 0.4)"
                value={destAddress}
                onChangeText={setDestAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>AMOUNT (SOL):</Text>
              <View style={styles.amountInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0.00"
                  placeholderTextColor="rgba(163, 150, 130, 0.4)"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.maxBtn}
                  onPress={() => setTransferAmount((activeBalance - 0.005).toString())}
                >
                  <Text style={styles.maxBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.transferBtn}
                onPress={handleTransfer}
                disabled={transferring}
              >
                {transferring ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.transferBtnText}>EXECUTE TRANSFER 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <View style={styles.pane}>
            {/* Solana Congestion Widget */}
            <View style={[COMMON_STYLES.premiumCard, styles.congestionCard]}>
              <Text style={styles.settingsLabel}>SOLANA NETWORK CONGESTION</Text>
              <View style={[
                styles.congestionBadge,
                congestionStatus === 'LOW' ? { backgroundColor: 'rgba(74, 222, 128, 0.1)', borderColor: '#4ade80' } :
                congestionStatus === 'NORMAL' ? { backgroundColor: 'rgba(96, 165, 250, 0.1)', borderColor: '#60a5fa' } :
                congestionStatus === 'CONGESTED' ? { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: '#fbbf24' } :
                { backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: '#f87171' }
              ]}>
                <Text style={[
                  styles.congestionText,
                  congestionStatus === 'LOW' ? { color: '#4ade80' } :
                  congestionStatus === 'NORMAL' ? { color: '#60a5fa' } :
                  congestionStatus === 'CONGESTED' ? { color: '#fbbf24' } :
                  { color: '#f87171' }
                ]}>
                  {congestionStatus} {fetchingFees && '🔄'}
                </Text>
              </View>
            </View>

            {/* Priority Fee Speed Section */}
            <View style={[COMMON_STYLES.premiumCard, styles.settingsCard]}>
              <Text style={styles.settingsLabel}>AMMO SPEED (PRIORITY FEE PRESETS)</Text>
              <View style={styles.settingsGridRow}>
                {['low', 'medium', 'high', 'turbo', 'custom'].map((preset) => {
                  const isActive = settings.priorityFeeType === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.settingsButton,
                        isActive ? { borderColor: COLORS.neonMoon, backgroundColor: 'rgba(57, 255, 20, 0.1)' } : null
                      ]}
                      onPress={() => handlePrioritySelect(preset)}
                    >
                      <Text style={[styles.settingsButtonText, isActive ? { color: COLORS.neonMoon } : null]}>
                        {getPriorityLabel(preset)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {settings.priorityFeeType === 'custom' && (
                <View style={styles.customSettingsInputRow}>
                  <Text style={styles.customInputLabel}>MICRO-LAMPORTS:</Text>
                  <TextInput
                    style={styles.customInput}
                    keyboardType="numeric"
                    value={customFeeText}
                    onChangeText={handleCustomFeeChangeText}
                  />
                </View>
              )}
            </View>

            {/* Slippage Target Variance Section */}
            <View style={[COMMON_STYLES.premiumCard, styles.settingsCard]}>
              <Text style={styles.settingsLabel}>TARGET VARIANCE (SLIPPAGE LIMIT)</Text>
              <View style={styles.settingsGridRow}>
                {[0.5, 1.0, 3.0, 'custom'].map((preset) => {
                  const isActive = preset === 'custom' ? isCustomSlip : (!isCustomSlip && settings.slippage === preset);
                  return (
                    <TouchableOpacity
                      key={String(preset)}
                      style={[
                        styles.settingsButton,
                        isActive ? { borderColor: COLORS.neonMoon, backgroundColor: 'rgba(57, 255, 20, 0.1)' } : null
                      ]}
                      onPress={() => handleSlippageSelect(preset)}
                    >
                      <Text style={[styles.settingsButtonText, isActive ? { color: COLORS.neonMoon } : null]}>
                        {typeof preset === 'number' ? `${preset}%` : 'CUSTOM'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {isCustomSlip && (
                <View style={styles.customSettingsInputRow}>
                  <Text style={styles.customInputLabel}>MAX SLIPPAGE %:</Text>
                  <TextInput
                    style={styles.customInput}
                    keyboardType="numeric"
                    value={customSlipText}
                    onChangeText={handleCustomSlipChangeText}
                  />
                </View>
              )}

              {/* Slippage Warning Alert Block */}
              {getSlippageWarning(settings.slippage) && (
                <View style={[
                  styles.warningBoxSettings,
                  getSlippageWarning(settings.slippage)?.type === 'danger'
                    ? { backgroundColor: 'rgba(248, 113, 113, 0.05)', borderColor: 'rgba(248, 113, 113, 0.3)' }
                    : { backgroundColor: 'rgba(251, 191, 36, 0.05)', borderColor: 'rgba(251, 191, 36, 0.3)' }
                ]}>
                  <Text style={[
                    styles.warningTextSettings,
                    getSlippageWarning(settings.slippage)?.type === 'danger' ? { color: '#f87171' } : { color: COLORS.gold }
                  ]}>
                    {getSlippageWarning(settings.slippage)?.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noWalletText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.jeetRed,
    letterSpacing: 2,
    marginBottom: 10,
  },
  noWalletSub: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    textAlign: 'center',
    lineHeight: 15,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    fontSize: 32,
  },
  username: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
  },
  walletAddr: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gasmask,
    marginTop: 2,
    fontWeight: 'bold',
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  badgeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  badgeVal: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.neonMoon,
    textShadowColor: COLORS.neonMoon,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
    marginTop: -2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    backgroundColor: COLORS.cardBgSolid,
  },
  summaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: 2,
  },
  summarySub: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: 'rgba(163, 150, 130, 0.6)',
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0b0f',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.neonMoon,
  },
  tabText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    textAlign: 'center',
  },
  activeTabText: {
    color: COLORS.neonMoon,
  },
  scroll: {
    padding: 16,
    flexGrow: 1,
  },
  pane: {
    gap: 12,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    textAlign: 'center',
    marginVertical: 40,
    fontWeight: 'bold',
  },
  positionCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 14,
    gap: 12,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  positionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
  positionRoomSub: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    marginTop: 2,
  },
  sideBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sideBadgeMoon: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderColor: COLORS.neonMoon,
  },
  sideBadgeJeet: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: COLORS.jeetRed,
  },
  sideBadgeMoonText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.neonMoon,
  },
  sideBadgeJeetText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.jeetRed,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
  },
  positionCol: {
    flex: 1,
  },
  positionColLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  positionColVal: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  positionTimeText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
  },
  positionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionPnlLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  positionPnlVal: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '900',
  },
  tradeCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 12,
    gap: 10,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: COLORS.white,
  },
  tradeTimeSub: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    color: 'rgba(163, 150, 130, 0.5)',
    marginTop: 1,
  },
  tradeOutcomeBox: {
    alignItems: 'flex-end',
  },
  outcomeBadgeActive: {
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outcomeBadgeActiveText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#fbbf24',
  },
  outcomeBadgeWin: {
    borderWidth: 1,
    borderColor: COLORS.neonMoon,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outcomeBadgeWinText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: COLORS.neonMoon,
  },
  outcomeBadgeLoss: {
    borderWidth: 1,
    borderColor: COLORS.jeetRed,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outcomeBadgeLossText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: COLORS.jeetRed,
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tradeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  tradeVal: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  tradeActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  solscanLink: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  claimWinningsBtn: {
    backgroundColor: COLORS.neonMoon,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimWinningsText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#000',
  },
  claimedText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  refCard: {
    backgroundColor: COLORS.cardBgSolid,
  },
  refTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  refSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  refMetrics: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  refMetric: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
  },
  refMetricLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  refMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 4,
  },
  claimBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  claimLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  claimAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.gold,
    marginVertical: 6,
  },
  claimBtn: {
    backgroundColor: COLORS.gold,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  walletInfoCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 16,
  },
  walletHeading: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  walletDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  walletDetailsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  walletDetailsVal: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  walletBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  walletActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  walletActionText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  transferCard: {
    backgroundColor: COLORS.cardBgSolid,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    color: COLORS.neonMoon,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  amountInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  maxBtn: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1.5,
    borderColor: COLORS.neonMoon,
    borderRadius: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
  },
  transferBtn: {
    backgroundColor: COLORS.neonMoon,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  transferBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  congestionCard: {
    backgroundColor: COLORS.cardBgSolid,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  settingsCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 14,
  },
  settingsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginBottom: 10,
  },
  congestionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  congestionText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  settingsGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  settingsButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    minWidth: 44,
    alignItems: 'center',
  },
  settingsButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  customSettingsInputRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customInputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  customInput: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    color: COLORS.neonMoon,
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  warningBoxSettings: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
  warningTextSettings: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 11,
  },
});
