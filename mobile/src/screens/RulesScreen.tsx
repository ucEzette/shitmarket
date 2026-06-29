import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

export default function RulesScreen({ navigation }: any) {
  const rules = [
    {
      title: '1. PREDICTIVE ARENAS (ROOMS)',
      emoji: '⚔️',
      color: COLORS.neonMoon,
      desc: 'Commanders construct prediction arenas by scanning and pasting any active Solana token contract address. Each room represents a localized PvP battlefield.'
    },
    {
      title: '2. INITIAL SEEDING (REQUIRED)',
      emoji: '🔥',
      color: COLORS.jeetRed,
      desc: 'Zero seeding is strictly rejected. Every arena deployment requires an initial stake (minimum 0.01 SOL) to secure either the Moon or Jeet trenches. Back your sector!'
    },
    {
      title: '3. SELECT ARMY & DEPLOY WAGERS',
      emoji: '🛡️',
      color: COLORS.gold,
      desc: 'Wagers are executed P2P. Bet on the token price pumping (Moon Army) or dumping (Jeet Squadron) within customized countdown limits. You never hold the actual tokens, only predictive war bonds.'
    },
    {
      title: '4. THE TWAP SETTLEMENT BOMB',
      emoji: '💣',
      color: COLORS.white,
      desc: 'Once the countdown detonates, the arena locks. Winnings are settled automatically via decentralized keepers utilizing spot price EMA/TWAP smoothing to verify the victor.'
    },
    {
      title: '5. FEE STRUCTURE & TAXATION',
      emoji: '🪙',
      color: COLORS.neonMoon,
      desc: 'A flat 1.25% platform fee is captured from the total room pot upon settlement. Inviter commanders automatically receive a 0.1% referral rebate routed directly to their wallets on every recruit bet.'
    }
  ];

  const handleSupportEmail = () => {
    Linking.openURL('mailto:contact@shitmarket.lol').catch(() => {});
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>◀ RETREAT TO HOME BASE</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>⚔️ OPERATIONS PROTOCOLS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Core blueprint manual container */}
        <View style={[COMMON_STYLES.premiumCard, styles.manualCard]}>
          <View style={styles.manualHeader}>
            <Text style={styles.generalEmoji}>🦧</Text>
            <Text style={styles.manualTitle}>TRENCH WAR MANUAL</Text>
            <Text style={styles.manualSub}>OFFICIAL PvP ARENA OPERATIONAL RULES</Text>
          </View>

          {/* Rules items list */}
          <View style={styles.rulesList}>
            {rules.map((rule, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.ruleRow, 
                  { borderColor: 'rgba(92, 82, 68, 0.25)', borderLeftColor: rule.color, borderLeftWidth: 4 }
                ]}
              >
                <View style={styles.ruleIconContainer}>
                  <Text style={styles.ruleEmoji}>{rule.emoji}</Text>
                </View>
                <View style={styles.ruleTextContainer}>
                  <Text style={[styles.ruleTitleText, { color: COLORS.white }]}>{rule.title}</Text>
                  <Text style={styles.ruleDescText}>{rule.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Compliance & Risk Warnings */}
          <View style={styles.warningContainer}>
            <View style={styles.warningIconContainer}>
              <Text style={styles.warningIcon}>⚠️</Text>
            </View>
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>EXTREME VOLATILITY WARNING</Text>
              <Text style={styles.warningDesc}>
                ShitMarket prediction trenches operate under extreme high-risk P2P conditions. Maximum leverage is in effect. Wagers cannot be rescinded or un-signed once locked in on-chain. Deploy only Ammo SOL you are prepared to lose. HQ accepts no liability for rekt accounts.
              </Text>
            </View>
          </View>

          {/* Radio coupler */}
          <View style={styles.radioContainer}>
            <Text style={styles.radioTitle}>HQ MESS & RADIO FREQUENCY</Text>
            <Text style={styles.radioSub} onPress={handleSupportEmail}>
              COURIER TRANSMISSIONS DIRECTED TO:{'\n'}
              <Text style={styles.radioLink}>contact@shitmarket.lol 📋</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.trenchBlack,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
  },
  navTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 0.5,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  manualCard: {
    backgroundColor: 'rgba(26, 22, 18, 0.35)',
    padding: 18,
  },
  manualHeader: {
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 16,
    marginBottom: 20,
  },
  generalEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  manualTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
  },
  manualSub: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  rulesList: {
    gap: 14,
  },
  ruleRow: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  ruleIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.trenchBlack,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleEmoji: {
    fontSize: 18,
  },
  ruleTextContainer: {
    flex: 1,
  },
  ruleTitleText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ruleDescText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginTop: 4,
    lineHeight: 12,
  },
  warningContainer: {
    marginTop: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.jeetRed,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  warningIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIcon: {
    fontSize: 20,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.jeetRed,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  warningDesc: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    lineHeight: 11,
  },
  radioContainer: {
    marginTop: 24,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    alignItems: 'center',
  },
  radioTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  radioSub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
  },
  radioLink: {
    color: COLORS.neonMoon,
    textDecorationLine: 'underline',
  },
});
