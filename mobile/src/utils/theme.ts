import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
  bg: '#07080d',
  cardBg: 'rgba(25, 20, 16, 0.55)',
  cardBgSolid: '#12141c',
  mud: '#1a1612',
  trenchBlack: '#0a0b0f',
  sandbag: '#5c5244',
  gasmask: '#a39682',
  neonMoon: '#39ff14',
  jeetRed: '#ff3b30',
  gold: '#fbbf24',
  white: '#ffffff',
  gray: '#1f2937',
  grayText: '#8f9cae',
  darkGray: '#111319',
  border: 'rgba(92, 82, 68, 0.4)',
  glowMoon: 'rgba(57, 255, 20, 0.15)',
  glowJeet: 'rgba(255, 59, 48, 0.15)',
};

export const FONTS = {
  mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  sans: SystemFont(),
  bold: SystemFontBold(),
};

function SystemFont() {
  return Platform.OS === 'ios' ? 'System' : 'sans-serif';
}

function SystemFontBold() {
  return Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed';
}

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  premiumCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  neonTextMoon: {
    color: COLORS.neonMoon,
    textShadowColor: COLORS.neonMoon,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  neonTextJeet: {
    color: COLORS.jeetRed,
    textShadowColor: COLORS.jeetRed,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  scanlines: {
    // Replicated scanline effect or styling overlay
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
    fontFamily: FONTS.sans,
  },
  subHeader: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.gasmask,
    letterSpacing: 1.5,
  }
});
