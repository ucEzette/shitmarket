import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useWalletContext } from '../components/WalletProvider';
import { COLORS, FONTS, COMMON_STYLES } from '../utils/theme';

export default function LoginScreen() {
  const {
    loginWithOAuth,
    sendEmailCode,
    loginWithEmailCode,
    connectExternal,
    importPrivateKeyOrMnemonic,
    createAdditionalWallet,
    oauthState,
    emailState,
    embeddedWalletStatus,
  } = useWalletContext();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setLoading(true);
    try {
      await loginWithOAuth(provider);
    } catch (e: any) {
      Alert.alert("Authentication Failed", e?.message || `Failed to sign in with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert("Validation Error", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const success = await sendEmailCode(email.trim());
      if (success) {
        setOtpSent(true);
        Alert.alert("Code Transmitted", `Verification code sent to ${email}`);
      } else {
        Alert.alert("Transmission Failure", "Could not send verification code.");
      }
    } catch (e: any) {
      Alert.alert("Transmission Failure", e?.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert("Validation Error", "Please enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmailCode(otpCode.trim(), email.trim());
      Alert.alert("Login Successful", "Enlisted into the degen trenches!");
    } catch (e: any) {
      Alert.alert("Verification Failed", e?.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleExternalLogin = async () => {
    setLoading(true);
    try {
      await connectExternal();
    } catch (e: any) {
      Alert.alert("Link Failed", e?.message || "Failed to link external wallet.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportKey = async () => {
    if (!privateKey.trim()) {
      Alert.alert("Validation Error", "Please paste your Solana private key first.");
      return;
    }
    setLoading(true);
    try {
      await importPrivateKeyOrMnemonic(privateKey.trim());
      Alert.alert("Helmet Enlisted", "Hot wallet imported successfully!");
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message || "Invalid private key. Make sure it is in base58 format.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      await createAdditionalWallet();
      Alert.alert("Helmet Generated", "A secure private key has been generated and saved to your device's SecureStore!");
    } catch (e: any) {
      Alert.alert("Generation Failed", "Could not generate hot key.");
    } finally {
      setLoading(false);
    }
  };

  // Determine current detailed loading logs
  let statusText = "TRANSMITTING DATA...";
  if (oauthState?.status === 'loading') {
    statusText = "AUTHORIZING OAUTH SESSION...";
  } else if (emailState?.status === 'sending-code') {
    statusText = "TRANSMITTING OTP CODE...";
  } else if (emailState?.status === 'submitting-code') {
    statusText = "VERIFYING CHALLENGE SIGNATURE...";
  } else if (embeddedWalletStatus === 'creating') {
    statusText = "GENERATING SECURE SOLANA WALLET...";
  }

  const isProcessLoading = loading || 
    oauthState?.status === 'loading' || 
    emailState?.status === 'sending-code' || 
    emailState?.status === 'submitting-code' || 
    embeddedWalletStatus === 'creating';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={COMMON_STYLES.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
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
          <Text style={styles.subtitle}>TACTICAL MOBILE BASE</Text>
        </View>

        <View style={styles.cardContainer}>
          <View style={[COMMON_STYLES.premiumCard, styles.card]}>
            <Text style={styles.cardHeader}>ENLIST YOUR CRYPTO HELMET</Text>
            <Text style={styles.cardInfo}>
              Join the PVP prediction trenches. Mirror credentials from the web or setup a localized hot wallet.
            </Text>

            {isProcessLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.neonMoon} />
                <Text style={styles.loadingText}>{statusText}</Text>
              </View>
            ) : (
              <View style={styles.buttonGroup}>
                {/* Email Login Flow */}
                <View style={styles.emailContainer}>
                  <Text style={styles.inputLabel}>SIGN IN VIA EMAIL:</Text>
                  {!otpSent ? (
                    <View style={styles.emailInputRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="solider@shitmarket.lol"
                        placeholderTextColor="rgba(163, 150, 130, 0.4)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity style={styles.sendCodeButton} onPress={handleSendEmailCode}>
                        <Text style={styles.sendCodeButtonText}>SEND CODE</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.otpContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="ENTER 6-DIGIT OTP CODE"
                        placeholderTextColor="rgba(163, 150, 130, 0.4)"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.actionButton, { flex: 1, marginRight: 8 }]} onPress={handleVerifyOtp}>
                          <Text style={styles.actionButtonText}>VERIFY CODE 🔑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryButton, { paddingVertical: 10 }]} onPress={() => setOtpSent(false)}>
                          <Text style={styles.secondaryButtonText}>BACK</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
                  <View style={styles.line} />
                </View>

                {/* Social Login Buttons */}
                <View style={styles.socialRow}>
                  <TouchableOpacity style={[styles.socialButton, { marginRight: 8 }]} onPress={() => handleOAuthLogin('google')}>
                    <Text style={styles.socialButtonText}>GOOGLE 🔴</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialButton} onPress={() => handleOAuthLogin('apple')}>
                    <Text style={styles.socialButtonText}>APPLE 🍏</Text>
                  </TouchableOpacity>
                </View>

                {/* External Wallet Deep Link */}
                <TouchableOpacity style={styles.secondaryButton} onPress={handleExternalLogin}>
                  <Text style={styles.secondaryButtonText}>LINK EXTERNAL WALLET (PHANTOM) 📱</Text>
                </TouchableOpacity>

                {/* Hot Wallet Toggle */}
                <TouchableOpacity 
                  style={styles.textButton} 
                  onPress={() => setShowImport(!showImport)}
                >
                  <Text style={styles.textButtonText}>
                    {showImport ? "HIDE ADVANCED KEYS" : "IMPORT/CREATE HOT WALLET 🛠️"}
                  </Text>
                </TouchableOpacity>

                {showImport && (
                  <View style={styles.importPanel}>
                    <Text style={styles.inputLabel}>PASTE RAW PRIVATE KEY (BASE58):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 4zXy... or [120, 23, 44...]"
                      placeholderTextColor="rgba(163, 150, 130, 0.4)"
                      value={privateKey}
                      onChangeText={setPrivateKey}
                      autoCapitalize="none"
                      secureTextEntry
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.actionButton} onPress={handleImportKey}>
                      <Text style={styles.actionButtonText}>IMPORT HOT HELMET 💣</Text>
                    </TouchableOpacity>

                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.line} />
                    </View>

                    <TouchableOpacity style={[styles.actionButton, styles.createBtn]} onPress={handleCreateWallet}>
                      <Text style={styles.actionButtonText}>GENERATE NEW HOT HELMET ⛏️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            NOTICE: STACK SOL TO VOTE MOON OR JEET. SECURE YOUR CRYPTO SPOILS.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.bg,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    height: 72,
    width: 72,
    marginBottom: 10,
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logoTextWhite: {
    fontFamily: FONTS.sans,
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  logoTextGreen: {
    fontFamily: FONTS.sans,
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.neonMoon,
    letterSpacing: 0.5,
  },
  logoTextRed: {
    fontFamily: FONTS.sans,
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.jeetRed,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    letterSpacing: 2,
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  cardContainer: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderColor: COLORS.neonMoon,
    borderWidth: 2,
    backgroundColor: COLORS.cardBgSolid,
    shadowColor: COLORS.neonMoon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  cardHeader: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  cardInfo: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.grayText,
    lineHeight: 18,
    marginBottom: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.neonMoon,
    marginTop: 15,
    letterSpacing: 2,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 12,
  },
  emailContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendCodeButton: {
    backgroundColor: COLORS.neonMoon,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendCodeButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  otpContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialButton: {
    flex: 1,
    backgroundColor: COLORS.cardBgSolid,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  socialButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: COLORS.cardBgSolid,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 5,
  },
  textButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  importPanel: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92, 82, 68, 0.25)',
    paddingTop: 15,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gasmask,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    color: COLORS.neonMoon,
    fontSize: 12,
    fontFamily: FONTS.mono,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: COLORS.neonMoon,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2ecc71',
  },
  actionButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
  },
  createBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(92, 82, 68, 0.25)',
  },
  dividerText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gasmask,
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.border,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: 'bold',
  },
});
