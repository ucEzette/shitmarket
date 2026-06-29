import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAppState, Room } from '../store/useAppState';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';
import { INDEXER_URL } from '../utils/config';

export default function CreateRoomScreen({ navigation }: any) {
  const { createRoom, placeBet, user, wallet, isTransactionLoading } = useAppState();

  const [contractAddress, setContractAddress] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [seedSide, setSeedSide] = useState<'moon' | 'jeet'>('moon');
  const [seedAmount, setSeedAmount] = useState<number>(0.1);
  const [openingPriceType, setOpeningPriceType] = useState<'market' | 'set'>('market');
  const [customSetPrice, setCustomSetPrice] = useState<string>('');

  const [scanning, setScanning] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    icon: string;
    liquidity: string;
    priceUsd: string;
    fdv: string;
    volume24h: string;
    rawLiquidity?: number;
    rawFdv?: number;
    chainId?: string;
    pairAddress?: string;
    rawPriceUsd?: number;
  } | null>(null);

  const handleScan = async () => {
    if (!contractAddress.trim()) {
      Alert.alert("Scan Error", "Please enter a valid token address first.");
      return;
    }

    setScanning(true);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${contractAddress.trim()}`);
      const data = await res.json();
      
      if (data && data.pairs && data.pairs.length > 0) {
        // Sort pairs by liquidity descending to get the best pair
        const sortedPairs = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const pair = sortedPairs[0];

        // Security check via indexer
        try {
          const valRes = await fetch(`${INDEXER_URL}/api/rooms/validate?mint=${contractAddress.trim()}`);
          if (valRes.ok) {
            const valData = await valRes.json();
            if (!valData.valid) {
              Alert.alert("Security Exclusion", `Token security check failed: ${valData.reason}`);
              setTokenInfo(null);
              setScanning(false);
              return;
            }
          }
        } catch (valErr) {
          console.warn("Could not validate token mint with indexer, proceeding with caution.");
        }

        const rawPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });

        setTokenInfo({
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          icon: pair.info?.imageUrl ? pair.info.imageUrl : '📊',
          liquidity: pair.liquidity?.usd ? `${formatter.format(pair.liquidity.usd)}` : 'UNKNOWN',
          priceUsd: pair.priceUsd ? priceFormatter.format(rawPrice) : 'UNKNOWN',
          fdv: pair.fdv ? formatter.format(pair.fdv) : 'UNKNOWN',
          volume24h: pair.volume?.h24 ? formatter.format(pair.volume.h24) : 'UNKNOWN',
          rawLiquidity: pair.liquidity?.usd,
          rawFdv: pair.fdv,
          chainId: pair.chainId,
          pairAddress: pair.pairAddress,
          rawPriceUsd: rawPrice
        });
        setCustomSetPrice(rawPrice.toString());
      } else {
        Alert.alert("Scan Error", "No trading pairs found on Dexscreener for this address.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Scan Error", "Failed to fetch details from Dexscreener.");
    } finally {
      setScanning(false);
    }
  };

  const handleLaunch = async () => {
    if (!tokenInfo) {
      Alert.alert("Launch Stalled", "Please scan a valid token contract address first.");
      return;
    }

    if (!wallet || !wallet.publicKey) {
      Alert.alert("Wallet Required", "Please connect your crypto helmet first.");
      return;
    }

    if (seedAmount < 0.01) {
      Alert.alert("Validation Error", "Minimum seeding ammo is 0.01 SOL.");
      return;
    }

    if (user && user.balance < seedAmount) {
      Alert.alert("Insufficient Funds", "Insufficient SOL in active wallet to seed this room.");
      return;
    }

    const generatedId = String(Date.now());
    const targetOpeningPrice = openingPriceType === 'set'
      ? (parseFloat(customSetPrice) || tokenInfo.rawPriceUsd)
      : tokenInfo.rawPriceUsd;

    const newRoom: Room = {
      id: generatedId,
      token: {
        address: contractAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        icon: tokenInfo.icon,
        liquidity: tokenInfo.rawLiquidity,
        marketCap: tokenInfo.rawFdv,
        chainId: tokenInfo.chainId,
        pairAddress: tokenInfo.pairAddress
      },
      creator: wallet.publicKey.toBase58(),
      moonPool: seedSide === 'moon' ? seedAmount : 0.01,
      jeetPool: seedSide === 'jeet' ? seedAmount : 0.01,
      expiry: Date.now() + duration * 60000,
      status: 'active',
      createdAt: Date.now(),
      duration: duration,
      openingPrice: targetOpeningPrice
    };

    try {
      const res = await createRoom(newRoom, openingPriceType === 'set');
      
      if (res && !res.alreadyExists && res.roomPda) {
        try {
          await placeBet(res.roomPda, seedSide, seedAmount, true);
        } catch (betErr) {
          console.warn("Seeding bet failed but room was deployed on-chain:", betErr);
        }
      }

      Alert.alert(
        "Trench Deployed 💣",
        "Arena created successfully on-chain! Redirection in progress...",
        [{ text: "TO THE TRENCHES!", onPress: () => navigation.navigate('Home') }]
      );
    } catch (err: any) {
      Alert.alert("Deployment Failed", err?.message || "Transaction failed on-chain.");
    }
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[COMMON_STYLES.premiumCard, styles.clipboard]}>
          <Text style={styles.header}>LAUNCH ARENA ⛏️</Text>
          <Text style={styles.subtext}>
            Dig a new prediction trench. The keeper contract validates security constraints in real-time.
          </Text>

          {/* 1. Contract Search */}
          <View style={styles.section}>
            <Text style={styles.label}>PASTE SOLANA TOKEN CONTRACT ADDRESS:</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="TOKEN MINT ADDRESS..."
                placeholderTextColor="rgba(163, 150, 130, 0.4)"
                value={contractAddress}
                onChangeText={(val) => {
                  setContractAddress(val);
                  setTokenInfo(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={scanning}>
                {scanning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.scanBtnText}>SCAN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Scan Results */}
          {tokenInfo && (
            <View style={styles.metricsBox}>
              <View style={styles.metricsHeader}>
                <Text style={styles.metricsTitle}>
                  {tokenInfo.name} (${tokenInfo.symbol})
                </Text>
                <Text style={styles.validatedBadge}>SECURE ✓</Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>PRICE</Text>
                  <Text style={styles.metricVal}>{tokenInfo.priceUsd}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>LIQUIDITY</Text>
                  <Text style={styles.metricVal}>{tokenInfo.liquidity}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>24H VOL</Text>
                  <Text style={styles.metricVal}>{tokenInfo.volume24h}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>FDV / MCAP</Text>
                  <Text style={styles.metricVal}>{tokenInfo.fdv}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 3. Duration Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>BATTLE DURATION: {duration} MINUTES</Text>
            <View style={styles.presetsGrid}>
              {[30, 60, 240, 1440, 10080].map((mins) => {
                const label = mins >= 1440 ? `${mins/1440}D` : `${mins}M`;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.presetBtn, duration === mins ? styles.presetActive : null]}
                    onPress={() => setDuration(mins)}
                  >
                    <Text style={[styles.presetText, duration === mins ? styles.presetActiveText : null]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. Ammo Seeding */}
          <View style={styles.section}>
            <Text style={styles.label}>AMMO SEEDING SIDE:</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.sideBtn, seedSide === 'moon' ? styles.sideMoonActive : null]}
                onPress={() => setSeedSide('moon')}
              >
                <Text style={[styles.sideText, seedSide === 'moon' ? styles.sideMoonActiveText : null]}>
                  SEED MOON 🚀
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideBtn, seedSide === 'jeet' ? styles.sideJeetActive : null]}
                onPress={() => setSeedSide('jeet')}
              >
                <Text style={[styles.sideText, seedSide === 'jeet' ? styles.sideJeetActiveText : null]}>
                  SEED JEET 💀
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 15 }]}>SEED AMOUNT (SOL):</Text>
            <View style={styles.presetsGrid}>
              {[0.05, 0.1, 0.5, 1.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.presetBtn, seedAmount === val ? styles.presetActive : null]}
                  onPress={() => setSeedAmount(val)}
                >
                  <Text style={[styles.presetText, seedAmount === val ? styles.presetActiveText : null]}>
                    {val} SOL
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 5. Opening Price Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>OPENING PRICE TYPE:</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.sideBtn, openingPriceType === 'market' ? styles.sideMoonActive : null]}
                onPress={() => setOpeningPriceType('market')}
              >
                <Text style={[styles.sideText, openingPriceType === 'market' ? styles.sideMoonActiveText : null]}>
                  MARKET PRICE ⚡
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideBtn, openingPriceType === 'set' ? styles.sideMoonActive : null]}
                onPress={() => setOpeningPriceType('set')}
              >
                <Text style={[styles.sideText, openingPriceType === 'set' ? styles.sideMoonActiveText : null]}>
                  SET PRICE 🎯
                </Text>
              </TouchableOpacity>
            </View>

            {openingPriceType === 'set' && (
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="CUSTOM OPENING USD PRICE..."
                placeholderTextColor="rgba(163, 150, 130, 0.4)"
                value={customSetPrice}
                onChangeText={setCustomSetPrice}
                keyboardType="numeric"
              />
            )}
          </View>

          {/* Launch Button */}
          <TouchableOpacity
            style={[styles.launchBtn, isTransactionLoading ? styles.disabledBtn : null]}
            onPress={handleLaunch}
            disabled={isTransactionLoading}
          >
            {isTransactionLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.launchBtnText}>LAUNCH ARENA ON-CHAIN 💣</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  clipboard: {
    padding: 20,
    backgroundColor: COLORS.cardBgSolid,
  },
  header: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    lineHeight: 15,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    color: COLORS.neonMoon,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  scanBtn: {
    backgroundColor: COLORS.cardBgSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  metricsBox: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 82, 68, 0.2)',
    paddingBottom: 8,
    marginBottom: 10,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.neonMoon,
  },
  validatedBadge: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  metricVal: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1.2,
    borderColor: COLORS.sandbag,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetActive: {
    borderColor: COLORS.neonMoon,
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
  },
  presetText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  presetActiveText: {
    color: COLORS.neonMoon,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: COLORS.sandbag,
    borderRadius: 6,
    padding: 3,
    gap: 6,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
  sideMoonActive: {
    backgroundColor: COLORS.neonMoon,
  },
  sideJeetActive: {
    backgroundColor: COLORS.jeetRed,
  },
  sideText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gasmask,
  },
  sideMoonActiveText: {
    color: '#000',
  },
  sideJeetActiveText: {
    color: '#fff',
  },
  launchBtn: {
    backgroundColor: COLORS.neonMoon,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: COLORS.neonMoon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: {
    backgroundColor: COLORS.gasmask,
    borderColor: COLORS.sandbag,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  launchBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
  },
});
