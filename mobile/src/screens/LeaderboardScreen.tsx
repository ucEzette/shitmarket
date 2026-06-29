import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAppState } from '../store/useAppState';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

const { width } = Dimensions.get('window');

// Helper: derive ELO from win rate and rank index (matches web)
function deriveElo(winRate: number, totalBets: number): number {
  const rateBonus = Math.max(0, (winRate - 50)) * 4;
  const volumeBonus = Math.min(totalBets * 5, 200);
  return 1200 + Math.round(rateBonus + volumeBonus);
}

// Helper: convert ELO to class rating (matches web)
function eloToClass(elo: number): { class: string; color: string; label: string } {
  if (elo >= 1800) return { class: 'S', color: '#f59e0b', label: 'LEGENDARY' };
  if (elo >= 1600) return { class: 'A', color: '#c084fc', label: 'ELITE' };
  if (elo >= 1400) return { class: 'B', color: '#60a5fa', label: 'VETERAN' };
  if (elo >= 1200) return { class: 'C', color: '#4ade80', label: 'REGULAR' };
  return { class: 'D', color: '#f87171', label: 'ROOKIE' };
}

// Map emojis for portraits corresponding to ranks
const MOON_PORTRAITS = ['🚀', '🐂', '💎', '📈', '🛸', '🦁', '👑', '🔥'];
const JEET_PORTRAITS = ['💀', '🐻', '🤡', '📉', '🪂', '🐍', '🌪️', '🥀'];

export default function LeaderboardScreen() {
  const { leaderboard, fetchLeaderboard } = useAppState();
  const [activeTab, setActiveTab] = useState<'moon' | 'jeet'>('moon');
  const [seasonTimeLeft, setSeasonTimeLeft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Sync leaderboard on mount
  useEffect(() => {
    fetchLeaderboard().catch(console.error);
  }, []);

  // Ticking Season Clock
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const nextSunday = new Date();
      nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
      nextSunday.setHours(23, 59, 59, 999);

      const diff = nextSunday.getTime() - now.getTime();
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      const pad = (num: number) => String(num).padStart(2, '0');
      setSeasonTimeLeft(`${days}D ${pad(hours)}H ${pad(mins)}M ${pad(secs)}S`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLeaderboard();
    } catch (e) {
      console.warn("Leaderboard refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const activeLeaders = activeTab === 'moon' ? (leaderboard?.moon || []) : (leaderboard?.jeet || []);

  // Podium Soldiers
  const podium1st = activeLeaders[0] || { name: 'Recruit', profit: 0, winRate: 0, elo: 1200 };
  const podium2nd = activeLeaders[1] || { name: 'Recruit', profit: 0, winRate: 0, elo: 1200 };
  const podium3rd = activeLeaders[2] || { name: 'Recruit', profit: 0, winRate: 0, elo: 1200 };

  const renderRankItem = ({ item, index }: { item: any; index: number }) => {
    const elo = item.elo ?? deriveElo(item.winRate, index + 5);
    const classInfo = eloToClass(elo);
    const portrait = activeTab === 'moon' 
      ? MOON_PORTRAITS[index % MOON_PORTRAITS.length] 
      : JEET_PORTRAITS[index % JEET_PORTRAITS.length];

    return (
      <View style={[COMMON_STYLES.premiumCard, styles.rankCard]}>
        <View style={styles.rankCol}>
          <Text style={[
            styles.rankNumber,
            index === 0 ? { color: COLORS.gold } :
            index === 1 ? { color: '#ffffff' } :
            index === 2 ? { color: COLORS.gasmask } : { color: 'rgba(163, 150, 130, 0.4)' }
          ]}>
            #{index + 1}
          </Text>
        </View>

        <View style={styles.soldierCol}>
          <Text style={styles.soldierAvatar}>{portrait}</Text>
          <View>
            <Text style={styles.soldierName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.soldierClass, { color: classInfo.color }]}>
              {classInfo.label} [{classInfo.class}]
            </Text>
          </View>
        </View>

        <View style={styles.eloCol}>
          <Text style={[styles.eloText, { color: classInfo.color }]}>{elo}</Text>
          <Text style={styles.subText}>ELO</Text>
        </View>

        <View style={styles.profitCol}>
          <Text style={styles.profitText}>+{item.profit.toFixed(2)}</Text>
          <Text style={styles.subText}>SOL</Text>
        </View>

        <View style={styles.recordCol}>
          <Text style={styles.recordText}>{item.winRate}%</Text>
          <Text style={styles.subText}>ACC</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      {/* 1. SEASON TIMELINE HEADER BANNER */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerEmoji}>🦧</Text>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>SEASON 1 SECTOR CONQUEST</Text>
            <Text style={styles.bannerSub}>SUPREME COMMANDERS OF DEGEN FRONT LINES.</Text>
          </View>
        </View>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>RESET ARBITRAGE IN:</Text>
          <Text style={styles.countdownClock}>{seasonTimeLeft}</Text>
        </View>
      </View>

      {/* 2. THE TACTICAL TAB SELECTION */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'moon' ? styles.activeMoonTab : null]}
          onPress={() => setActiveTab('moon')}
        >
          <Text style={[styles.subTabText, activeTab === 'moon' ? styles.activeMoonTabText : null]}>
            🟢 MOON CALLERS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'jeet' ? styles.activeJeetTab : null]}
          onPress={() => setActiveTab('jeet')}
        >
          <Text style={[styles.subTabText, activeTab === 'jeet' ? styles.activeJeetTabText : null]}>
            🔴 JEET SNIPERS
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. PODIUM DECK */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neonMoon} />
        }
      >
        <View style={[COMMON_STYLES.premiumCard, styles.podiumCardDeck]}>
          <Text style={styles.podiumTitle}>⚔️ BATTLE COMMAND PODIUM ⚔️</Text>
          
          <View style={styles.podiumContainer}>
            {/* 2nd Place */}
            <View style={styles.podiumCol}>
              <View style={styles.podiumTrooper}>
                <Text style={styles.podiumTrooperName} numberOfLines={1}>{podium2nd.name}</Text>
                <Text style={styles.podiumTrooperProfit}>+{podium2nd.profit.toFixed(1)} SOL</Text>
                <View style={[styles.podiumTrooperBadge, { borderColor: '#c0c0c0' }]}>
                  <Text style={styles.podiumTrooperAvatar}>💎</Text>
                </View>
              </View>
              <View style={[styles.podiumStep, { height: 70, backgroundColor: COLORS.cardBgSolid }]}>
                <Text style={styles.podiumStepRank}>2ND</Text>
                <Text style={styles.podiumStepInfo}>WR: {podium2nd.winRate}%</Text>
              </View>
            </View>

            {/* 1st Place */}
            <View style={styles.podiumCol}>
              <View style={styles.podiumTrooper}>
                <Text style={[styles.podiumTrooperName, { color: COLORS.white }]} numberOfLines={1}>
                  {podium1st.name}
                </Text>
                <Text style={[styles.podiumTrooperProfit, { color: COLORS.neonMoon }]}>
                  +{podium1st.profit.toFixed(1)} SOL
                </Text>
                <View style={[styles.podiumTrooperBadge, { borderColor: COLORS.neonMoon, borderWidth: 2, transform: [{ scale: 1.1 }] }]}>
                  <Text style={styles.podiumTrooperAvatar}>🐂</Text>
                </View>
              </View>
              <View style={[styles.podiumStep, { height: 100, borderColor: COLORS.neonMoon, borderWidth: 1.5, backgroundColor: COLORS.cardBgSolid }]}>
                <Text style={[styles.podiumStepRank, { color: COLORS.neonMoon }]}>1ST</Text>
                <Text style={[styles.podiumStepInfo, { color: COLORS.neonMoon }]}>WR: {podium1st.winRate}%</Text>
              </View>
            </View>

            {/* 3rd Place */}
            <View style={styles.podiumCol}>
              <View style={styles.podiumTrooper}>
                <Text style={styles.podiumTrooperName} numberOfLines={1}>{podium3rd.name}</Text>
                <Text style={styles.podiumTrooperProfit}>+{podium3rd.profit.toFixed(1)} SOL</Text>
                <View style={[styles.podiumTrooperBadge, { borderColor: '#cd7f32' }]}>
                  <Text style={styles.podiumTrooperAvatar}>🐸</Text>
                </View>
              </View>
              <View style={[styles.podiumStep, { height: 50, backgroundColor: COLORS.cardBgSolid }]}>
                <Text style={styles.podiumStepRank}>3RD</Text>
                <Text style={styles.podiumStepInfo}>WR: {podium3rd.winRate}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. RANKINGS LIST */}
        <View style={styles.rankingsContainer}>
          <Text style={styles.sectionHeader}>⚔️ SECTOR RADAR COMMANDERS</Text>
          {activeLeaders.length === 0 ? (
            <Text style={styles.emptyText}>NO ACTIVE COGNITIVE INTEL IN SECTOR RADAR.</Text>
          ) : (
            activeLeaders.map((item, idx) => (
              <React.Fragment key={idx}>
                {renderRankItem({ item, index: idx })}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    backgroundColor: COLORS.trenchBlack,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    borderRadius: 12,
    margin: 16,
    padding: 14,
    gap: 12,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerEmoji: {
    fontSize: 28,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  bannerSub: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  countdownContainer: {
    backgroundColor: COLORS.cardBgSolid,
    borderWidth: 1,
    borderColor: 'rgba(92, 82, 68, 0.3)',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  countdownLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    letterSpacing: 0.5,
  },
  countdownClock: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.jeetRed,
    marginTop: 2,
    letterSpacing: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#0a0b0f',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 2,
    marginBottom: 10,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  activeMoonTab: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
  },
  activeJeetTab: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  subTabText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  activeMoonTabText: {
    color: COLORS.neonMoon,
  },
  activeJeetTabText: {
    color: COLORS.jeetRed,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  podiumCardDeck: {
    backgroundColor: 'rgba(26, 22, 18, 0.4)',
    alignItems: 'center',
    marginBottom: 20,
    padding: 14,
  },
  podiumTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumTrooper: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  podiumTrooperName: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    textAlign: 'center',
    width: '90%',
  },
  podiumTrooperProfit: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.gold,
    marginTop: 2,
  },
  podiumTrooperBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: COLORS.trenchBlack,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  podiumTrooperAvatar: {
    fontSize: 20,
  },
  podiumStep: {
    width: '100%',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    paddingHorizontal: 4,
  },
  podiumStepRank: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
  },
  podiumStepInfo: {
    fontFamily: FONTS.mono,
    fontSize: 6.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  rankingsContainer: {
    gap: 12,
  },
  rankCard: {
    backgroundColor: COLORS.cardBgSolid,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '900',
  },
  soldierCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 6,
  },
  soldierAvatar: {
    fontSize: 22,
  },
  soldierName: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
  },
  soldierClass: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    marginTop: 1,
  },
  eloCol: {
    width: 44,
    alignItems: 'flex-end',
  },
  eloText: {
    fontSize: 13,
    fontWeight: '900',
  },
  profitCol: {
    width: 60,
    alignItems: 'flex-end',
  },
  profitText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.gold,
  },
  recordCol: {
    width: 44,
    alignItems: 'flex-end',
  },
  recordText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
  subText: {
    fontFamily: FONTS.mono,
    fontSize: 6.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 1,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    textAlign: 'center',
    marginTop: 30,
    fontWeight: 'bold',
  },
});
