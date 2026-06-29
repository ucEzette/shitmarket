import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppState, Room, ChatMessage, formatCashtag } from '../store/useAppState';
import { useWalletContext } from '../components/WalletProvider';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

export default function RoomScreen({ route, navigation }: any) {
  const { roomId } = route.params;
  const { rooms, chatMessages, fetchRoomChats, sendRoomChat, placeBet, user } = useAppState();
  const { activeWalletAddress } = useWalletContext();

  const [activeChatTab, setActiveChatTab] = useState<'moon' | 'jeet'>('moon');
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [timeText, setTimeText] = useState('00:00:00');

  // Bet placement state
  const [betSide, setBetSide] = useState<'moon' | 'jeet' | null>(null);
  const [betAmount, setBetAmount] = useState('0.1');
  const [placing, setPlacing] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const room = rooms.find((r) => r.id === roomId);

  // Sync chats for this room
  useEffect(() => {
    fetchRoomChats(roomId).catch(console.error);
  }, [roomId]);

  // Tick countdown timer
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = room.expiry - now;
      if (delta <= 0) {
        setTimeText(room.status === 'settled' ? 'RESOLVED' : 'PENDING SETTLEMENT...');
      } else {
        const hrs = Math.floor(delta / 3600000);
        const mins = Math.floor((delta % 3600000) / 60000);
        const secs = Math.floor((delta % 60000) / 1000);
        const pad = (val: number) => String(val).padStart(2, '0');
        setTimeText(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [room]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    if (!activeWalletAddress) {
      Alert.alert("Enlist Wallet", "Please connect your wallet helmet first.");
      return;
    }

    setSendingChat(true);
    try {
      await sendRoomChat(roomId, activeChatTab, activeWalletAddress, chatInput.trim());
      setChatInput('');
      
      // Sync fresh messages from API
      await fetchRoomChats(roomId);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      console.warn(e);
    } finally {
      setSendingChat(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!betSide) return;
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Error", "Please enter a valid SOL amount.");
      return;
    }
    if (!user || user.balance < amt) {
      Alert.alert("Insufficient Ammo", "Insufficient SOL in active wallet.");
      return;
    }

    setPlacing(true);
    try {
      await placeBet(roomId, betSide, amt);
      Alert.alert("Strike Successful! 💣", `Placed ${amt} SOL on ${betSide.toUpperCase()}.`);
      setBetSide(null);
    } catch (e: any) {
      Alert.alert("Deployment Failed", e?.message || "Transaction aborted on-chain.");
    } finally {
      setPlacing(false);
    }
  };

  // Filter messages for current room and active tab + globally broadcast alerts
  const filteredChats = chatMessages.filter(
    (c) => c.roomId === roomId && (c.side === activeChatTab || c.side === 'all')
  );

  if (!room) {
    return (
      <SafeAreaView style={[COMMON_STYLES.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.neonMoon} />
        <Text style={styles.loadingText}>RESOLVING ROOM ON BATTLEFIELD MAPPING...</Text>
      </SafeAreaView>
    );
  }

  // Dexscreener Embed HTML/URL wrapper
  const dexscreenerUrl = room.token.pairAddress && room.token.chainId
    ? `https://dexscreener.com/${room.token.chainId}/${room.token.pairAddress}?embed=1&theme=dark&trades=0`
    : null;

  const totalPool = room.moonPool + room.jeetPool;
  const moonPct = totalPool > 0 ? (room.moonPool / totalPool) * 100 : 50;
  const jeetPct = totalPool > 0 ? (room.jeetPool / totalPool) * 100 : 50;

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          {/* 1. Header Information Panel */}
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.title}>{room.token.name} (${room.token.symbol})</Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeText}>{timeText}</Text>
              </View>
            </View>
            <Text style={styles.contractAddr} numberOfLines={1}>{room.token.address}</Text>
          </View>

          {/* 2. Dexscreener live chart embed */}
          {dexscreenerUrl ? (
            <View style={styles.chartContainer}>
              <WebView
                source={{ uri: dexscreenerUrl }}
                style={styles.webView}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.chartLoading}>
                    <ActivityIndicator size="small" color={COLORS.neonMoon} />
                  </View>
                )}
              />
            </View>
          ) : (
            <View style={styles.noChart}>
              <Text style={styles.noChartText}>NO TRADING PAIR EMBED DETECTED FOR CHARTING</Text>
            </View>
          )}

          {/* 3. Pool Ratio meters */}
          <View style={[COMMON_STYLES.premiumCard, styles.combatPanel]}>
            <Text style={styles.combatTitle}>COMBAT ALLIANCE SHIELD RATIO</Text>
            <View style={styles.ratioBarContainer}>
              <View style={[styles.ratioBar, { flex: moonPct, backgroundColor: COLORS.neonMoon }]} />
              <View style={[styles.ratioBar, { flex: jeetPct, backgroundColor: COLORS.jeetRed }]} />
            </View>
            <View style={styles.combatStatsRow}>
              <View>
                <Text style={[styles.factionLabel, { color: COLORS.neonMoon }]}>MOON POOL</Text>
                <Text style={styles.factionVal}>{room.moonPool.toFixed(2)} SOL</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.factionLabel, { color: COLORS.jeetRed }]}>JEET POOL</Text>
                <Text style={styles.factionVal}>{room.jeetPool.toFixed(2)} SOL</Text>
              </View>
            </View>
          </View>

          {/* 4. Betting Panel Sheet / Action togglers */}
          <View style={styles.betGroup}>
            {!betSide ? (
              <View style={styles.mainBuyBtns}>
                <TouchableOpacity
                  style={[styles.buyBtn, { backgroundColor: COLORS.neonMoon }]}
                  onPress={() => setBetSide('moon')}
                >
                  <Text style={styles.buyBtnText}>BUY MOON 🚀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buyBtn, { backgroundColor: COLORS.jeetRed }]}
                  onPress={() => setBetSide('jeet')}
                >
                  <Text style={[styles.buyBtnText, { color: '#fff' }]}>BUY JEET 💀</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[COMMON_STYLES.premiumCard, styles.stakeSheet]}>
                <Text style={styles.stakeSheetTitle}>
                  STAKING AMMO FOR {betSide.toUpperCase()} ALLIANCE
                </Text>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={betAmount}
                    onChangeText={setBetAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                  />
                  <Text style={styles.solLabel}>SOL</Text>
                </View>

                <View style={styles.presetsGrid}>
                  {['0.1', '0.5', '1.0', '2.0'].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.presetBtn, betAmount === val ? styles.activePreset : null]}
                      onPress={() => setBetAmount(val)}
                    >
                      <Text style={[styles.presetText, betAmount === val ? styles.activePresetText : null]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.sheetButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setBetSide(null)}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: betSide === 'moon' ? COLORS.neonMoon : COLORS.jeetRed }]}
                    onPress={handlePlaceBet}
                    disabled={placing}
                  >
                    {placing ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={[styles.confirmBtnText, betSide === 'jeet' ? { color: '#fff' } : null]}>
                        STRIKE AMMO 💣
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 5. Chat Panels */}
          <View style={styles.chatSection}>
            <View style={styles.chatTabs}>
              <TouchableOpacity
                style={[styles.chatTab, activeChatTab === 'moon' ? styles.activeChatTab : null]}
                onPress={() => setActiveChatTab('moon')}
              >
                <Text style={[styles.chatTabText, activeChatTab === 'moon' ? styles.activeChatTabText : null]}>
                  MOON SQUAD 🚀
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chatTab, activeChatTab === 'jeet' ? styles.activeChatTab : null]}
                onPress={() => setActiveChatTab('jeet')}
              >
                <Text style={[styles.chatTabText, activeChatTab === 'jeet' ? styles.activeChatTabText : null]}>
                  JEET SNIPERS 💀
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chat List */}
            <View style={styles.chatBox}>
              <FlatList
                ref={flatListRef}
                data={filteredChats}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.chatMsg}>
                    <Text style={styles.chatUser}>{item.user.slice(0, 6)}...{item.user.slice(-4)}:</Text>
                    <Text style={styles.chatVal}>{item.message}</Text>
                  </View>
                )}
                contentContainerStyle={styles.chatListContent}
                nestedScrollEnabled
                ListEmptyComponent={
                  <Text style={styles.emptyChat}>NO VOICE SIGNAL RECORDED IN CHANNELS...</Text>
                }
              />
            </View>

            {/* Chat Input */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={`SEND TACTICAL ENCRYPTED FEED TO ${activeChatTab.toUpperCase()}...`}
                placeholderTextColor="rgba(163, 150, 130, 0.4)"
                value={chatInput}
                onChangeText={setChatInput}
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.chatSendBtn}
                onPress={handleSendChat}
                disabled={sendingChat}
              >
                {sendingChat ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.chatSendText}>SEND</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    marginTop: 15,
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
  },
  timeBadge: {
    backgroundColor: '#0a0b0f',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  timeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  contractAddr: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    marginTop: 4,
    fontWeight: 'bold',
  },
  chartContainer: {
    height: 250,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  chartLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  noChart: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#000',
  },
  noChartText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  combatPanel: {
    margin: 16,
    backgroundColor: COLORS.cardBgSolid,
  },
  combatTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 1,
    marginBottom: 10,
  },
  ratioBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ratioBar: {
    height: '100%',
  },
  combatStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
  },
  factionVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  betGroup: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mainBuyBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  buyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  buyBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  stakeSheet: {
    backgroundColor: COLORS.cardBgSolid,
  },
  stakeSheetTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    height: 44,
    color: COLORS.neonMoon,
    fontFamily: FONTS.mono,
    fontSize: 18,
    fontWeight: 'bold',
  },
  solLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: COLORS.sandbag,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activePreset: {
    borderColor: COLORS.neonMoon,
  },
  presetText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  activePresetText: {
    color: COLORS.neonMoon,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.sandbag,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  chatSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  chatTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 82, 68, 0.2)',
  },
  chatTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeChatTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.neonMoon,
  },
  chatTabText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  activeChatTabText: {
    color: COLORS.neonMoon,
  },
  chatBox: {
    height: 180,
    backgroundColor: '#050608',
  },
  chatListContent: {
    padding: 12,
  },
  chatMsg: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  chatUser: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  chatVal: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.white,
    flex: 1,
  },
  emptyChat: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: 'rgba(163, 150, 130, 0.25)',
    textAlign: 'center',
    marginTop: 60,
    fontWeight: 'bold',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#0a0b0f',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    color: COLORS.neonMoon,
    fontSize: 10,
    fontFamily: FONTS.mono,
  },
  chatSendBtn: {
    backgroundColor: COLORS.neonMoon,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
});
