import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletContext } from './WalletProvider';
import { useAppState } from '../store/useAppState';
import { COLORS, FONTS } from '../utils/theme';
import { connection } from '../utils/solanaClient';
import { useNavigation } from '@react-navigation/native';

export default function Header() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { activeWalletAddress, balance, disconnect } = useWalletContext();
  const { settings, updateSettings, user } = useAppState();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [estimatedFees, setEstimatedFees] = useState<{ low: number; medium: number; high: number; turbo: number } | null>(null);
  const [congestionStatus, setCongestionStatus] = useState<'LOW' | 'NORMAL' | 'CONGESTED' | 'CRITICAL'>('NORMAL');
  const [fetchingFees, setFetchingFees] = useState(false);

  const [customFeeVal, setCustomFeeVal] = useState(settings.customPriorityFee.toString());
  const [customSlipVal, setCustomSlipVal] = useState(settings.slippage.toString());
  const [isCustomSlip, setIsCustomSlip] = useState(![0.5, 1.0, 3.0].includes(settings.slippage));

  // Sync priority fees from RPC when settings modal is opened
  useEffect(() => {
    if (!isConfigOpen) return;
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
        console.warn("Failed to fetch live priority fees in header:", err);
      } finally {
        if (active) setFetchingFees(false);
      }
    };
    fetchFees();
    return () => { active = false; };
  }, [isConfigOpen]);

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
    setCustomFeeVal(val);
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) {
      updateSettings({ customPriorityFee: num });
    }
  };

  const handleCustomSlipChangeText = (val: string) => {
    setCustomSlipVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      updateSettings({ slippage: num });
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Retire to Reserve?",
      "Are you sure you want to disconnect your crypto helmet?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "DISCONNECT 🚪", onPress: async () => await disconnect() }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        {/* Branding & Logo */}
        <View style={styles.branding}>
          <Image
            source={require('../../assets/pepes/logo-main.png')}
            style={styles.logo as any}
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoTextWhite}>SHIT</Text>
            <Text style={styles.logoTextGreen}>MARKET</Text>
            <Text style={styles.logoTextRed}>.</Text>
          </View>
        </View>

        {/* Right side connection info */}
        {activeWalletAddress && (
          <View style={styles.actionsContainer}>
            {/* AMMO SOL Balance Badge */}
            <View style={styles.ammoBadge}>
              <Text style={styles.ammoEmoji}>🪙</Text>
              <Text style={styles.ammoText}>
                AMMO: <Text style={styles.ammoAmount}>{balance.toFixed(2)} SOL</Text>
              </Text>
            </View>

            {/* Briefing manual trigger */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Rules')}
            >
              <Text style={styles.actionIcon}>📖</Text>
            </TouchableOpacity>

            {/* Tactical controls Settings trigger */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setIsConfigOpen(true)}
            >
              <Text style={styles.actionIcon}>⚙️</Text>
            </TouchableOpacity>

            {/* Disconnect reserves */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.logoutBtn]}
              onPress={handleDisconnect}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* TACTICAL CONTROLS CONFIG MODAL */}
      <Modal
        visible={isConfigOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfigOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>TACTICAL CONTROLS</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsConfigOpen(false)}
              >
                <Text style={styles.closeIcon}>❌</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Solana Network Congestion Widget */}
              <View style={styles.settingsSection}>
                <View style={styles.congestionRow}>
                  <Text style={styles.sectionLabel}>SOLANA CONGESTION:</Text>
                  <View style={[
                    styles.congestionBadge,
                    congestionStatus === 'LOW' ? styles.congestionLow :
                    congestionStatus === 'NORMAL' ? styles.congestionNormal :
                    congestionStatus === 'CONGESTED' ? styles.congestionWarn :
                    styles.congestionCritical
                  ]}>
                    <Text style={[
                      styles.congestionBadgeText,
                      congestionStatus === 'LOW' ? { color: '#4ade80' } :
                      congestionStatus === 'NORMAL' ? { color: '#60a5fa' } :
                      congestionStatus === 'CONGESTED' ? { color: '#fbbf24' } :
                      { color: '#f87171' }
                    ]}>
                      {congestionStatus} {fetchingFees && '🔄'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Amuunition Speed presets */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionLabel}>AMMO SPEED (PRIORITY FEE PRESETS)</Text>
                <View style={styles.presetsGrid}>
                  {['low', 'medium', 'high', 'turbo', 'custom'].map((preset) => {
                    const isActive = settings.priorityFeeType === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetBtn,
                          isActive ? styles.presetActive : null
                        ]}
                        onPress={() => handlePrioritySelect(preset)}
                      >
                        <Text style={[styles.presetBtnText, isActive ? styles.presetActiveText : null]}>
                          {getPriorityLabel(preset)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {settings.priorityFeeType === 'custom' && (
                  <View style={styles.customFeeRow}>
                    <Text style={styles.customFieldLabel}>MICRO-LAMPORTS:</Text>
                    <TextInput
                      style={styles.customFieldInput}
                      keyboardType="numeric"
                      value={customFeeVal}
                      onChangeText={handleCustomFeeChangeText}
                    />
                  </View>
                )}
              </View>

              {/* Slippage tolerance presets */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionLabel}>TARGET VARIANCE (SLIPPAGE LIMIT)</Text>
                <View style={styles.presetsGrid}>
                  {[0.5, 1.0, 3.0, 'custom'].map((preset) => {
                    const isActive = preset === 'custom' ? isCustomSlip : (!isCustomSlip && settings.slippage === preset);
                    return (
                      <TouchableOpacity
                        key={String(preset)}
                        style={[
                          styles.presetBtn,
                          isActive ? styles.presetActive : null
                        ]}
                        onPress={() => handleSlippageSelect(preset)}
                      >
                        <Text style={[styles.presetBtnText, isActive ? styles.presetActiveText : null]}>
                          {typeof preset === 'number' ? `${preset}%` : 'CUSTOM'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isCustomSlip && (
                  <View style={styles.customFeeRow}>
                    <Text style={styles.customFieldLabel}>MAX SLIPPAGE %:</Text>
                    <TextInput
                      style={styles.customFieldInput}
                      keyboardType="numeric"
                      value={customSlipVal}
                      onChangeText={handleCustomSlipChangeText}
                    />
                  </View>
                )}

                {/* Slippage alerts */}
                {getSlippageWarning(settings.slippage) && (
                  <View style={[
                    styles.warningBox,
                    getSlippageWarning(settings.slippage)?.type === 'danger' ? styles.warningDanger : styles.warningWarn
                  ]}>
                    <Text style={[
                      styles.warningText,
                      getSlippageWarning(settings.slippage)?.type === 'danger' ? { color: '#f87171' } : { color: COLORS.gold }
                    ]}>
                      {getSlippageWarning(settings.slippage)?.text}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Text style={styles.footerNote}>
                TACTICAL CONFIG PERSISTS LOCALLY ON THIS MOBILE HELMET CONSOLE.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.trenchBlack,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    height: 24,
    width: 24,
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextWhite: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  logoTextGreen: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 0.5,
  },
  logoTextRed: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.jeetRed,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ammoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mud,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ammoEmoji: {
    fontSize: 10,
    marginRight: 4,
  },
  ammoText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  ammoAmount: {
    fontWeight: '900',
  },
  actionBtn: {
    height: 26,
    width: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  actionIcon: {
    fontSize: 13,
  },
  logoutBtn: {
    borderColor: 'rgba(255, 59, 48, 0.3)',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  logoutIcon: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.sandbag,
    borderWidth: 3,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.trenchBlack,
  },
  modalTitle: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 2,
  },
  closeIcon: {
    fontSize: 12,
  },
  modalScroll: {
    padding: 16,
    gap: 16,
  },
  settingsSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  congestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBgSolid,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
  congestionBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  congestionLow: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: '#4ade80',
  },
  congestionNormal: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: '#60a5fa',
  },
  congestionWarn: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: '#fbbf24',
  },
  congestionCritical: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: '#f87171',
    transform: [{ scale: 1.02 }],
  },
  congestionBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    flexGrow: 1,
    minWidth: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: COLORS.cardBgSolid,
  },
  presetActive: {
    borderColor: COLORS.neonMoon,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
  },
  presetBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  presetActiveText: {
    color: COLORS.neonMoon,
  },
  customFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardBgSolid,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  customFieldLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
  },
  customFieldInput: {
    flex: 1,
    backgroundColor: '#000',
    color: COLORS.neonMoon,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: FONTS.mono,
    fontSize: 9.5,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  warningDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  warningWarn: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  warningText: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 10,
    backgroundColor: COLORS.trenchBlack,
  },
  footerNote: {
    fontFamily: FONTS.mono,
    fontSize: 7,
    color: COLORS.gasmask,
    textAlign: 'center',
    lineHeight: 10,
    fontWeight: 'bold',
  },
});
