import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useAppState, Room, formatCashtag } from '../store/useAppState';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

interface ParlayLeg {
  roomId: string;
  tokenSymbol: string;
  tokenIcon: string;
  side: 'moon' | 'jeet';
  odds: number;
}

export default function ParlaysScreen() {
  const { rooms, roomsLoaded, user } = useAppState();
  const activeRooms = rooms.filter((r) => r.status === 'active');

  const getLiveOdds = (room: Room, side: 'moon' | 'jeet'): number => {
    const moon = room.moonPool || 0.1;
    const jeet = room.jeetPool || 0.1;
    const total = moon + jeet;
    const odds = side === 'moon' ? total / moon : total / jeet;
    return Math.max(1.01, Number(odds.toFixed(2)));
  };

  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  const [stakeAmount, setStakeAmount] = useState('0.5');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedSide, setSelectedSide] = useState<'moon' | 'jeet'>('moon');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [dispatchedTicket, setDispatchedTicket] = useState<any>(null);

  // Pre-populate with first 2-3 active rooms if empty
  useEffect(() => {
    if (roomsLoaded && activeRooms.length > 0 && legs.length === 0) {
      const initial = activeRooms.slice(0, 3).map((r, idx) => {
        const side: 'moon' | 'jeet' = idx % 2 === 0 ? 'moon' : 'jeet';
        return {
          roomId: r.id,
          tokenSymbol: r.token.symbol,
          tokenIcon: r.token.icon || '💰',
          side,
          odds: getLiveOdds(r, side),
        };
      });
      setLegs(initial);
    }
  }, [roomsLoaded, rooms]);

  // Sync odds when rooms pools change
  useEffect(() => {
    if (legs.length > 0) {
      const updated = legs.map((leg) => {
        const matched = rooms.find((r) => r.id === leg.roomId);
        if (matched) {
          return {
            ...leg,
            odds: getLiveOdds(matched, leg.side),
          };
        }
        return leg;
      });
      const changed = updated.some((ul, idx) => ul.odds !== legs[idx]?.odds);
      if (changed) {
        setLegs(updated);
      }
    }
  }, [rooms]);

  const calculateMultiplier = () => {
    return legs.reduce((acc, leg) => acc * leg.odds, 1);
  };

  const calculatePayout = () => {
    const stake = parseFloat(stakeAmount) || 0;
    return calculateMultiplier() * stake;
  };

  const handleAddLeg = () => {
    if (!selectedRoomId) return;
    const targetRoom = activeRooms.find((r) => r.id === selectedRoomId);
    if (!targetRoom) return;

    // Check if room already added
    if (legs.some((l) => l.roomId === selectedRoomId)) {
      Alert.alert("Already Added", "This arena target is already en-route in your slip.");
      return;
    }

    const odds = getLiveOdds(targetRoom, selectedSide);
    const newLeg: ParlayLeg = {
      roomId: targetRoom.id,
      tokenSymbol: targetRoom.token.symbol,
      tokenIcon: targetRoom.token.icon || '💰',
      side: selectedSide,
      odds,
    };

    setLegs([...legs, newLeg]);
    setSelectedRoomId('');
  };

  const handleRemoveLeg = (roomId: string) => {
    setLegs(legs.filter((l) => l.roomId !== roomId));
  };

  const handleToggleSide = (roomId: string) => {
    const updated = legs.map((l) => {
      if (l.roomId === roomId) {
        const nextSide: 'moon' | 'jeet' = l.side === 'moon' ? 'jeet' : 'moon';
        const room = rooms.find((r) => r.id === roomId);
        const odds = room ? getLiveOdds(room, nextSide) : l.odds;
        return { ...l, side: nextSide, odds };
      }
      return l;
    });
    setLegs(updated);
  };

  const handleDispatchTicket = () => {
    if (legs.length === 0) return;
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake <= 0) {
      Alert.alert("Stake Error", "Please enter a valid stake amount.");
      return;
    }

    const simSig = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setDispatchedTicket({
      sig: `sim_tx_${simSig}`,
      legsCount: legs.length,
      multiplier: calculateMultiplier(),
      stake,
      payout: calculatePayout(),
      legsSummary: legs.map((l) => `${formatCashtag(l.tokenSymbol)} (${l.side.toUpperCase()}) x${l.odds.toFixed(2)}`).join(' • '),
    });
    setShowSuccessModal(true);
  };

  const handleDismissTicket = () => {
    setShowSuccessModal(false);
    setDispatchedTicket(null);
    setLegs([]);
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Banner Alert (Simulation Warnings) */}
        <View style={styles.bannerAlert}>
          <Text style={styles.bannerAlertEmoji}>⚠️</Text>
          <Text style={styles.bannerAlertText}>
            SIMULATED TRAINING DECK: ATOMIC PARLAYS RUN IN MOCK ENVIRONMENT. MULTI-LEG PVP PREDICTIONS DO NOT EXECUTE ON-CHAIN TRANSACTIONS ON SOLANA MAINNET.
          </Text>
        </View>

        {/* Hazard Zone details */}
        <View style={[COMMON_STYLES.premiumCard, styles.headerCard]}>
          <Text style={styles.headerTitle}>PvP PARLAY TICKETS</Text>
          <Text style={styles.headerSubtitle}>ASSEMBLE MULTIPLE TARGET ARENAS TO MULTIPLY PAYOUT</Text>
          <View style={styles.hazardBox}>
            <Text style={styles.hazardTitle}>⚠️ HIGH LEVERAGE HAZARD ZONE</Text>
            <Text style={styles.hazardText}>
              If a single prediction settles against your side, the entire ammunition stake is forfeit to the PvP pool. All legs must hit!
            </Text>
          </View>
        </View>

        {/* Add Leg Form */}
        <View style={[COMMON_STYLES.premiumCard, styles.formCard]}>
          <Text style={styles.sectionHeading}>ADD ARENA TARGET</Text>
          
          <Text style={styles.inputLabel}>CHOOSE ACTIVE ARENA:</Text>
          <View style={styles.pickerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.activeRoomsRow}>
                {activeRooms
                  .filter((ar) => !legs.some((l) => l.roomId === ar.id))
                  .map((ar) => {
                    const isSelected = selectedRoomId === ar.id;
                    return (
                      <TouchableOpacity
                        key={ar.id}
                        style={[
                          styles.roomChip,
                          isSelected ? { borderColor: COLORS.neonMoon, backgroundColor: 'rgba(57, 255, 20, 0.1)' } : null
                        ]}
                        onPress={() => setSelectedRoomId(ar.id)}
                      >
                        <Text style={styles.roomChipIcon}>💰</Text>
                        <Text style={[styles.roomChipText, isSelected ? { color: COLORS.neonMoon } : null]}>
                          {formatCashtag(ar.token.symbol)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                {activeRooms.filter((ar) => !legs.some((l) => l.roomId === ar.id)).length === 0 && (
                  <Text style={styles.emptyText}>NO ADDITIONAL TARGETS DETECTED ON RADAR.</Text>
                )}
              </View>
            </ScrollView>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>SIDE SELECTION:</Text>
              <View style={styles.sideButtons}>
                <TouchableOpacity
                  style={[styles.sideBtn, selectedSide === 'moon' ? { backgroundColor: COLORS.neonMoon } : null]}
                  onPress={() => setSelectedSide('moon')}
                >
                  <Text style={[styles.sideBtnText, selectedSide === 'moon' ? { color: '#000' } : null]}>MOON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, selectedSide === 'jeet' ? { backgroundColor: COLORS.jeetRed } : null]}
                  onPress={() => setSelectedSide('jeet')}
                >
                  <Text style={[styles.sideBtnText, selectedSide === 'jeet' ? { color: '#fff' } : null]}>JEET</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.addLegBtn,
                selectedRoomId ? { backgroundColor: COLORS.gold } : { backgroundColor: COLORS.gray, opacity: 0.5 }
              ]}
              onPress={handleAddLeg}
              disabled={!selectedRoomId}
            >
              <Text style={styles.addLegText}>ADD LEG</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stacked Legs List */}
        <View style={styles.legsContainer}>
          <Text style={styles.sectionHeading}>SLIP MATRIX LEGS ({legs.length})</Text>
          {legs.length === 0 ? (
            <View style={[COMMON_STYLES.premiumCard, styles.emptyCard]}>
              <Text style={styles.emptyText}>🚨 NO ACTIVE TARGET LEGS STACKED. CHOOSE A POSITION ABOVE! 🚨</Text>
            </View>
          ) : (
            legs.map((leg) => (
              <View key={leg.roomId} style={[COMMON_STYLES.premiumCard, styles.legCard]}>
                <View style={styles.legMeta}>
                  <Text style={styles.legIcon}>💰</Text>
                  <View>
                    <Text style={styles.legName}>{formatCashtag(leg.tokenSymbol)}</Text>
                    <Text style={styles.legRoomId}>SECTOR: {leg.roomId.slice(0, 10).toUpperCase()}...</Text>
                  </View>
                </View>

                <View style={styles.legActions}>
                  <TouchableOpacity
                    style={[
                      styles.toggleSideBtn,
                      leg.side === 'moon' ? { borderColor: COLORS.neonMoon, backgroundColor: 'rgba(57, 255, 20, 0.05)' } : { borderColor: COLORS.jeetRed, backgroundColor: 'rgba(255, 59, 48, 0.05)' }
                    ]}
                    onPress={() => handleToggleSide(leg.roomId)}
                  >
                    <Text style={[
                      styles.toggleSideText,
                      leg.side === 'moon' ? { color: COLORS.neonMoon } : { color: COLORS.jeetRed }
                    ]}>
                      {leg.side.toUpperCase()} 🔄
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.legOddsText}>x{leg.odds.toFixed(2)}</Text>

                  <TouchableOpacity
                    style={styles.removeLegBtn}
                    onPress={() => handleRemoveLeg(leg.roomId)}
                  >
                    <Text style={styles.removeLegText}>❌</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Slip Aggregator Console */}
        <View style={[COMMON_STYLES.premiumCard, styles.aggregateCard]}>
          <Text style={styles.sectionHeading}>TACTICAL SLIP SLATE</Text>
          
          <View style={styles.aggRow}>
            <Text style={styles.aggLabel}>AGGREGATED MULTIPLIER:</Text>
            <Text style={styles.multiplierVal}>x{calculateMultiplier().toFixed(2)}</Text>
          </View>

          <Text style={styles.inputLabel}>AMMO STAKE DEPLOYED (SOL):</Text>
          <View style={styles.stakeRow}>
            <TextInput
              style={styles.stakeInput}
              keyboardType="numeric"
              value={stakeAmount}
              onChangeText={setStakeAmount}
              placeholder="0.00"
              placeholderTextColor="rgba(163, 150, 130, 0.4)"
            />
            <View style={styles.quickStakes}>
              {['0.1', '0.5', '1.0', '2.5'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.quickStakeBtn, stakeAmount === val ? { backgroundColor: COLORS.gold, borderColor: COLORS.gold } : null]}
                  onPress={() => setStakeAmount(val)}
                >
                  <Text style={[styles.quickStakeText, stakeAmount === val ? { color: '#000' } : null]}>{val} SOL</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.payoutCard}>
            <Text style={styles.payoutLabel}>POTENTIAL PvP PAYOUT (SOL):</Text>
            <Text style={styles.payoutVal}>{calculatePayout().toFixed(3)} SOL</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.dispatchBtn,
              legs.length > 0 
                ? { backgroundColor: COLORS.neonMoon, borderColor: '#2ecc71' } 
                : { backgroundColor: COLORS.gray, borderColor: COLORS.border, opacity: 0.5 }
            ]}
            onPress={handleDispatchTicket}
            disabled={legs.length === 0}
          >
            <Text style={styles.dispatchBtnText}>DISPATCH CONQUER TICKET ⚔️</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal Overlay */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDismissTicket}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalAvatar}>🐂</Text>
              <View>
                <Text style={styles.modalTitle}>TICKET DISPATCHED</Text>
                <Text style={styles.modalSubtitle}>STATUS: SECURED IN ARENA STATE</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalLabel}>TRANSACTION SIGNATURE:</Text>
              <Text style={styles.modalSig} selectable={true}>
                {dispatchedTicket?.sig}
              </Text>

              <View style={styles.modalMetricsGrid}>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>TOTAL LEGS</Text>
                  <Text style={styles.modalMetricVal}>{dispatchedTicket?.legsCount} TARGETS</Text>
                </View>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>SOL STAKE</Text>
                  <Text style={styles.modalMetricVal}>{dispatchedTicket?.stake} SOL</Text>
                </View>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>COMBINED ODDS</Text>
                  <Text style={styles.modalMetricVal}>x{dispatchedTicket?.multiplier.toFixed(2)}</Text>
                </View>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>EST. PAYOUT</Text>
                  <Text style={[styles.modalMetricVal, { color: COLORS.neonMoon }]}>
                    {dispatchedTicket?.payout.toFixed(3)} SOL
                  </Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>COMBAT CORPS MATRIX:</Text>
              <Text style={styles.modalMatrixSummary}>
                {dispatchedTicket?.legsSummary}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={handleDismissTicket}
            >
              <Text style={styles.modalDismissBtnText}>DISMISS COMMAND TICKET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  bannerAlert: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  bannerAlertEmoji: {
    fontSize: 18,
  },
  bannerAlertText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gold,
    flex: 1,
    lineHeight: 11,
  },
  headerCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  hazardBox: {
    marginTop: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.03)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 6,
    padding: 10,
  },
  hazardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  hazardText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 4,
    lineHeight: 11,
  },
  formCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
  },
  activeRoomsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.trenchBlack,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
  },
  roomChipIcon: {
    fontSize: 14,
  },
  roomChipText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  sideButtons: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.trenchBlack,
  },
  sideBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  addLegBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLegText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  legsContainer: {
    gap: 12,
  },
  emptyCard: {
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  legCard: {
    backgroundColor: COLORS.cardBgSolid,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  legMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legIcon: {
    fontSize: 20,
  },
  legName: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
  legRoomId: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 2,
  },
  legActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleSideBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleSideText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  legOddsText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.gold,
    width: 36,
    textAlign: 'right',
  },
  removeLegBtn: {
    padding: 4,
  },
  removeLegText: {
    fontSize: 12,
  },
  aggregateCard: {
    backgroundColor: COLORS.cardBgSolid,
    padding: 16,
  },
  aggRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  aggLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  multiplierVal: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  stakeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stakeInput: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
    color: COLORS.neonMoon,
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  quickStakes: {
    flexDirection: 'row',
    gap: 4,
  },
  quickStakeBtn: {
    backgroundColor: COLORS.trenchBlack,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  quickStakeText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  payoutCard: {
    backgroundColor: COLORS.trenchBlack,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginVertical: 14,
  },
  payoutLabel: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  payoutVal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 1,
    marginTop: 2,
    textShadowColor: COLORS.neonMoon,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  dispatchBtn: {
    borderRadius: 6,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dispatchBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.trenchBlack,
    borderColor: COLORS.neonMoon,
    borderWidth: 2,
    borderRadius: 8,
    width: '100%',
    maxHeight: '80%',
    padding: 18,
    shadowColor: COLORS.neonMoon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.neonMoon,
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalAvatar: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 1.5,
  },
  modalSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginTop: 2,
  },
  modalScroll: {
    gap: 12,
  },
  modalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  modalSig: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
    borderRadius: 4,
    padding: 8,
  },
  modalMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    marginVertical: 4,
  },
  modalMetric: {
    width: '47%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  modalMetricLabel: {
    fontFamily: FONTS.mono,
    fontSize: 6.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  modalMetricVal: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  modalMatrixSummary: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.white,
    fontStyle: 'italic',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalDismissBtn: {
    backgroundColor: COLORS.neonMoon,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  modalDismissBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
});
