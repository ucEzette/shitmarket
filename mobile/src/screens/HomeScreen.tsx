import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAppState, Room, formatCashtag } from '../store/useAppState';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

type Props = {
  navigation: any;
};

export default function HomeScreen({ navigation }: Props) {
  const { rooms, roomsLoaded, fetchRooms, placeBet, user } = useAppState();
  const [activeSubTab, setActiveSubTab] = useState<'ending' | 'newest' | 'expired'>('ending');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{ [id: string]: string }>({});



  useEffect(() => {
    fetchRooms().catch(console.error);
  }, []);

  // Timer Tick Loop for countdowns
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

        const pad = (val: number) => String(val).padStart(2, '0');
        texts[room.id] = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      });

      setTimeRemaining(texts);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [rooms]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRooms();
    } catch (e) {
      console.warn("Pull to refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const getFilteredRooms = () => {
    const now = Date.now();
    let filtered = rooms;

    // Filter by tab status
    if (activeSubTab === 'expired') {
      filtered = rooms.filter((r) => r.status === 'settled' || r.expiry <= now);
    } else {
      filtered = rooms.filter((r) => r.status === 'active' && r.expiry > now);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }

    // Sort by tab criteria
    if (activeSubTab === 'ending') {
      filtered.sort((a, b) => a.expiry - b.expiry);
    } else if (activeSubTab === 'newest') {
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    } else if (activeSubTab === 'expired') {
      filtered.sort((a, b) => b.expiry - a.expiry);
    }

    return filtered;
  };

  const handleQuickBet = async (roomId: string, side: 'moon' | 'jeet') => {
    if (!user) {
      Alert.alert("Wallet Required", "Please connect a crypto helmet first!");
      return;
    }
    const defaultAmount = 0.1; // SOL
    if (user.balance < defaultAmount) {
      Alert.alert("Insufficient Funds", `You need at least ${defaultAmount} SOL to quick-bet.`);
      return;
    }

    Alert.alert(
      "Confirm Stake",
      `Stack ${defaultAmount} SOL on ${side.toUpperCase()} for this room?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "STRIKE! 💣",
          onPress: async () => {
            try {
              await placeBet(roomId, side, defaultAmount);
            } catch (e: any) {
              Alert.alert("Bet Failed", e?.message || "Failed to place bet.");
            }
          }
        }
      ]
    );
  };

  const renderRoomCard = ({ item }: { item: Room }) => {
    const isSettled = item.status === 'settled';
    const timerText = timeRemaining[item.id] || (isSettled ? 'SETTLED' : 'LOCKED');
    
    // Pool calculations
    const totalPool = item.moonPool + item.jeetPool;
    const moonPct = totalPool > 0 ? (item.moonPool / totalPool) * 100 : 50;
    const jeetPct = totalPool > 0 ? (item.jeetPool / totalPool) * 100 : 50;

    return (
      <TouchableOpacity
        style={[COMMON_STYLES.premiumCard, styles.card]}
        onPress={() => navigation.navigate('Room', { roomId: item.id })}
      >
        {/* Token Metadata Header */}
        <View style={styles.cardHeader}>
          <View style={styles.tokenMeta}>
            <Text style={styles.tokenIcon}>💰</Text>
            <View>
              <Text style={styles.tokenName}>{item.token.name}</Text>
              <Text style={styles.tokenSymbol}>{formatCashtag(item.token.symbol)}</Text>
            </View>
          </View>
          <View style={styles.timerBadge}>
            <Text style={[styles.timerText, !isSettled ? styles.activeTimer : null]}>
              {timerText}
            </Text>
          </View>
        </View>

        {/* Faction Pools Ratio Bar */}
        <View style={styles.ratioBarContainer}>
          <View style={[styles.ratioBarPart, { flex: moonPct, backgroundColor: COLORS.neonMoon }]} />
          <View style={[styles.ratioBarPart, { flex: jeetPct, backgroundColor: COLORS.jeetRed }]} />
        </View>

        {/* Pool Details */}
        <View style={styles.poolStats}>
          <View>
            <Text style={styles.statLabel}>MOON ALLIANCE 🚀</Text>
            <Text style={[styles.statValue, { color: COLORS.neonMoon }]}>
              {item.moonPool.toFixed(2)} SOL
            </Text>
          </View>
          <View style={styles.rightStat}>
            <Text style={[styles.statLabel, styles.rightAlign]}>JEET SNIPERS 💀</Text>
            <Text style={[styles.statValue, styles.rightAlign, { color: COLORS.jeetRed }]}>
              {item.jeetPool.toFixed(2)} SOL
            </Text>
          </View>
        </View>

        {/* Final Twap / Price or Quick Action panel */}
        {isSettled ? (
          <View style={styles.outcomePanel}>
            <Text style={styles.outcomeLabel}>RESOLVED WINNER:</Text>
            <Text style={[
              styles.outcomeValue,
              item.winner === 'moon' ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
            ]}>
              {item.winner?.toUpperCase() || 'DRAW'}
            </Text>
          </View>
        ) : (
          <View style={styles.actionPanel}>
            <TouchableOpacity 
              style={[styles.quickBetBtn, { borderColor: COLORS.neonMoon }]}
              onPress={() => handleQuickBet(item.id, 'moon')}
            >
              <Text style={[styles.quickBetText, { color: COLORS.neonMoon }]}>+0.1 MOON 🚀</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickBetBtn, { borderColor: COLORS.jeetRed }]}
              onPress={() => handleQuickBet(item.id, 'jeet')}
            >
              <Text style={[styles.quickBetText, { color: COLORS.jeetRed }]}>+0.1 JEET 💀</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      {/* Header Info */}
      <View style={styles.topSection}>
        <TextInput
          style={styles.searchBar}
          placeholder="SEARCH CONTRACT OR CASHTAG..."
          placeholderTextColor="rgba(163, 150, 130, 0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Column Sub Tabs Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'ending' ? styles.activeSubTab : null]}
          onPress={() => setActiveSubTab('ending')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'ending' ? styles.activeSubTabText : null]}>
            ENDING SOON ⏳
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'newest' ? styles.activeSubTab : null]}
          onPress={() => setActiveSubTab('newest')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'newest' ? styles.activeSubTabText : null]}>
            NEWEST 🚀
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'expired' ? styles.activeSubTab : null]}
          onPress={() => setActiveSubTab('expired')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'expired' ? styles.activeSubTabText : null]}>
            RESOLVED 💀
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rooms List */}
      {!roomsLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.neonMoon} />
          <Text style={styles.loadingText}>SCANNING ENEMY RADARS...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredRooms()}
          renderItem={renderRoomCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.neonMoon}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>NO ACTIVE TRENCHES FOUND ON THIS RADAR.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    backgroundColor: '#0a0b0f',
    borderWidth: 1.5,
    borderColor: COLORS.sandbag,
    borderRadius: 8,
    padding: 12,
    color: COLORS.white,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#0a0b0f',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeSubTab: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.neonMoon,
  },
  subTabText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    letterSpacing: 1,
  },
  activeSubTabText: {
    color: COLORS.neonMoon,
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenIcon: {
    fontSize: 24,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
  },
  tokenSymbol: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  timerBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timerText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  activeTimer: {
    color: COLORS.gold,
  },
  ratioBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  ratioBarPart: {
    height: '100%',
  },
  poolStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  rightStat: {
    alignItems: 'flex-end',
  },
  rightAlign: {
    textAlign: 'right',
  },
  actionPanel: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92, 82, 68, 0.2)',
    paddingTop: 12,
  },
  quickBetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  quickBetText: {
    fontSize: 11,
    fontWeight: '900',
  },
  outcomePanel: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92, 82, 68, 0.2)',
    paddingTop: 12,
  },
  outcomeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  outcomeValue: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    marginTop: 15,
    letterSpacing: 1.5,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    textAlign: 'center',
    lineHeight: 16,
  },
});
