import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
} from 'react-native';
import { COLORS, FONTS } from '../utils/theme';

const { width } = Dimensions.get('window');

interface IntroScreenProps {
  onComplete: () => void;
}

export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const [currentScene, setCurrentScene] = useState<number>(1);
  const [dialogText, setDialogText] = useState<string>("");
  const [dialogCharIndex, setDialogCharIndex] = useState<number>(0);

  // Challenge states
  const [tearsWiped, setTearsWiped] = useState<number>(0);
  const [devCallState, setDevCallState] = useState<string>("CALLING DEV...");
  const [chadPumps, setChadPumps] = useState<number>(0);
  const [scene3Choice, setScene3Choice] = useState<"MOON" | "JEET" | null>(null);
  const [scene3Ticking, setScene3Ticking] = useState<boolean>(false);
  const [scene3Timer, setScene3Timer] = useState<number>(3);
  const [scatConfetti, setScatConfetti] = useState<boolean>(false);
  const [scatFired, setScatFired] = useState<boolean>(false);
  const [konamiEntered, setKonamiEntered] = useState<string[]>([]);
  const [konamiSuccess, setKonamiSuccess] = useState<boolean>(false);

  // Animated bounce for Chad
  const chadScale = useRef(new Animated.Value(1)).current;

  // Dialog configuration
  const sceneDialogs: Record<number, string[]> = {
    1: [
      'PEPE: "bought the top again. Liquidity disappeared. Dev vanished. Wife\'s boyfriend is texting about rent."',
      'JEET SKELETON: "Sell you fool! It\'s going to absolute zero! We\'re all gonna make it—to the breadline!"',
      'PEPE: "*sobbing* I just wanted to retire at 23..."'
    ],
    2: [
      'GIGA CHAD: "Pathetic. You\'re still buying shitcoins? That\'s like bringing a spoon to a gunfight."',
      'PEPE & WOJAK: "What is the alternative, genius?"',
      'GIGA CHAD: "You don\'t buy the coin. You bet on its SOUL. Welcome to SHITMARKET.LOL"'
    ],
    3: [
      'NARRATOR: "Introducing ShitMarket—the PvP prediction arena where you stake SOL on whether a meme coin pumps... or dumps."',
      'NARRATOR: "If you\'re right, you eat the losers\' lunch. If you\'re wrong... well..."',
      'JEET SKELETON: "CALLED THE DUMP! GET REKT, NERD! HAHAHA!"',
      'PEPE: "Worth it. No rug. No gas war. Just pure, unadulterated gambling."'
    ],
    4: [
      'CHAD BULL: "No rugs. Just bets. 1.25% platform fee. Now get in the trench, anon."',
      'ANON: "Is there leverage?"',
      'PEPE: "*whispers* We also have parlays."',
      'JEET SKELETON: "And jeet alerts. I live for those."'
    ],
    5: [
      'TERMINAL: "System locked. Konami Code activates God Mode/Unlimited Airdrops..."',
      'PEPE: "↑ ↑ ↓ ↓ ← → ← → B A. You\'re welcome."',
      '[ SQUEAKY WET FART SOUND EFFECT ]'
    ],
    6: [
      'NARRATOR: "Congratulations, Trench Veteran! You have bypassed the local highs, evaded the rug-pulls, and unlocked the Degen Immortality Certificate."',
      'TERMINAL: "God Mode initialized. 1,000,000,000 artificial mock SOL has been credited to your wallet balance."',
      'CHAD BULL: "Now go forth, anon, bet the trenches, and show the jeets who owns the soul of the blockchain!"'
    ]
  };

  const [currentDialogIdx, setCurrentDialogIdx] = useState<number>(0);

  // Typewriter line initializer
  useEffect(() => {
    const dialogs = sceneDialogs[currentScene];
    if (dialogs && dialogs[currentDialogIdx]) {
      setDialogText("");
      setDialogCharIndex(0);
    }
  }, [currentScene, currentDialogIdx]);

  // Typewriter effect loop
  useEffect(() => {
    const dialogs = sceneDialogs[currentScene];
    if (!dialogs || !dialogs[currentDialogIdx]) return;

    const activeLine = dialogs[currentDialogIdx];
    if (dialogCharIndex < activeLine.length) {
      const t = setTimeout(() => {
        setDialogText(prev => prev + activeLine[dialogCharIndex]);
        setDialogCharIndex(prev => prev + 1);
      }, 15);
      return () => clearTimeout(t);
    }
  }, [dialogCharIndex, currentScene, currentDialogIdx]);

  const handleSkip = () => {
    onComplete();
  };

  const isSceneChallengeSatisfied = () => {
    if (currentScene === 1 && tearsWiped < 5) return false;
    if (currentScene === 2 && chadPumps < 4) return false;
    if (currentScene === 3 && !scatFired) return false;
    if (currentScene === 4 && !scatConfetti) return false;
    if (currentScene === 5 && !konamiSuccess) return false;
    return true;
  };

  const nextDialog = () => {
    const dialogs = sceneDialogs[currentScene];
    if (currentDialogIdx < dialogs.length - 1) {
      setCurrentDialogIdx(prev => prev + 1);
    } else {
      if (!isSceneChallengeSatisfied()) {
        return;
      }
      nextScene();
    }
  };

  const nextScene = () => {
    if (currentScene < 6) {
      setCurrentScene(prev => prev + 1);
      setCurrentDialogIdx(0);
    } else {
      onComplete();
    }
  };

  // Scene 1 handlers
  const handleWipeTears = () => {
    setTearsWiped(prev => prev + 1);
  };

  const handleCallDev = () => {
    setDevCallState("DEV IN DUBAI WITH COCKTAILS. USER RUGGED.");
  };

  // Scene 2 handlers
  const handlePumpChad = () => {
    setChadPumps(prev => prev + 1);
    
    // Animate scale bounce
    Animated.sequence([
      Animated.timing(chadScale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(chadScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Scene 3 handlers
  const startPredictionBattle = (stance: "MOON" | "JEET") => {
    if (scene3Ticking) return;
    setScene3Choice(stance);
    setScene3Ticking(true);

    let counter = 3;
    const interval = setInterval(() => {
      counter--;
      if (counter > 0) {
        setScene3Timer(counter);
      } else {
        clearInterval(interval);
        setScatFired(true);
        setScene3Ticking(false);
      }
    }, 1000);
  };

  // Scene 5 handlers
  const handleKonamiTap = (char: string) => {
    const updated = [...konamiEntered, char];
    const sequence = ["U", "U", "D", "D", "L", "R", "L", "R", "B", "A"];
    const matchesSoFar = updated.every((v, i) => v === sequence[i]);

    if (!matchesSoFar) {
      setKonamiEntered([char]);
      return;
    }

    setKonamiEntered(updated);

    if (updated.length === 10) {
      setKonamiSuccess(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* HEADER BAR */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>SOLANA DEGEN TRENCHES</Text>
          </View>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>SKIP ⏩</Text>
          </TouchableOpacity>
        </View>

        {/* MAIN DISPLAY AREA */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* SCENE 1 */}
          {currentScene === 1 && (
            <View style={styles.sceneContainer}>
              <View style={styles.despairRow}>
                {/* Pepe Soldier */}
                <View style={[styles.characterCard, { borderColor: COLORS.border }]}>
                  <Text style={styles.badgeRed}>-99.7% PORTFOLIO</Text>
                  <View style={styles.blendImages}>
                    <Image
                      source={require('../../assets/pepes/pepe-few-understand.png')}
                      style={styles.memeImage as any}
                      resizeMode="cover"
                    />
                    <Image
                      source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/pepe.png')}
                      style={styles.memeImage as any}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.characterName}>Pepe the Soldier</Text>
                  <Text style={styles.characterStatus}>Status: Liquidated at local high</Text>

                  <View style={[styles.interactiveBox, { borderColor: tearsWiped < 5 ? COLORS.gold : COLORS.neonMoon }]}>
                    <Text style={styles.taskTitle}>🎯 Wipe Pepe's tears ({tearsWiped}/5 wipes)</Text>
                    <View style={styles.buttonRow}>
                      <TouchableOpacity style={styles.actionBtn} onPress={handleWipeTears}>
                        <Text style={styles.actionBtnText}>🧻 Wipe Tears</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7f1d1d' }]} onPress={handleCallDev}>
                        <Text style={styles.actionBtnText}>📞 CALL DEV</Text>
                      </TouchableOpacity>
                    </View>
                    {tearsWiped >= 5 && <Text style={styles.successText}>✅ PEPE CALMED</Text>}
                  </View>
                </View>

                {/* Wojak Skeleton */}
                <View style={[styles.characterCard, { borderColor: COLORS.jeetRed }]}>
                  <Text style={styles.badgeGold}>JEET OVERLORD</Text>
                  <View style={styles.blendImages}>
                    <Image
                      source={require('../../assets/pepes/jeet-skeleton.png')}
                      style={styles.memeImage as any}
                      resizeMode="cover"
                    />
                    <Image
                      source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/trolling.png')}
                      style={styles.memeImage as any}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.characterName}>Wojak Skeleton</Text>
                  <Text style={styles.characterStatus}>Status: Sitting on Breadline bags</Text>

                  <View style={styles.logBox}>
                    <Text style={styles.logTitle}>Jeet Terminal Logs</Text>
                    <Text style={styles.logContent}>{devCallState}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* SCENE 2 */}
          {currentScene === 2 && (
            <View style={styles.sceneContainer}>
              <View style={[styles.characterCard, { borderColor: COLORS.neonMoon, padding: 20 }]}>
                <Text style={styles.badgeGold}>1000x FORCE MULTIPLIER</Text>
                
                <View style={styles.flexRowCenter}>
                  <Animated.View style={{ transform: [{ scale: chadScale }] }}>
                    <Image
                      source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/chadbull.png')}
                      style={styles.roundAvatar as any}
                    />
                  </Animated.View>
                  <Image
                    source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/skeletonwojak.png')}
                    style={styles.roundAvatar as any}
                  />
                </View>

                <Text style={[styles.characterName, { color: COLORS.neonMoon, fontSize: 24, textAlign: 'center' }]}>Giga-Chad Descends!</Text>
                <Text style={styles.sceneDesc}>
                  "You don't buy the coin. You bet on its soul. Leverage up, soldier! We strike the jeets at dawn."
                </Text>

                <View style={[styles.interactiveBox, { borderColor: chadPumps < 4 ? COLORS.gold : COLORS.neonMoon, marginTop: 15 }]}>
                  <Text style={styles.taskTitle}>🎯 Pump Chad's Parachute Candle ({chadPumps}/4 pumps)</Text>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.neonMoon }]} onPress={handlePumpChad}>
                    <Text style={[styles.actionBtnText, { color: '#000000', fontWeight: '900' }]}>PUMP CROWD FORCE</Text>
                  </TouchableOpacity>
                  {chadPumps >= 4 && <Text style={styles.successText}>✅ PARACHUTE INFLATED</Text>}
                </View>
              </View>
            </View>
          )}

          {/* SCENE 3 */}
          {currentScene === 3 && (
            <View style={styles.sceneContainer}>
              <View style={[styles.characterCard, { borderColor: COLORS.sandbag, padding: 15 }]}>
                <View style={styles.duelHeader}>
                  <View>
                    <Text style={styles.duelTitle}>PvP PREDICTION MATRICES</Text>
                    <Text style={styles.duelSubtitle}>Sample game mechanics simulation</Text>
                  </View>
                  {scene3Ticking ? (
                    <View style={styles.tickingBox}>
                      <Text style={styles.tickingText}>💣 BOMB 0:0{scene3Timer}</Text>
                    </View>
                  ) : (
                    <Text style={styles.idleText}>★ SIMULATION IDLE</Text>
                  )}
                </View>

                <View style={styles.mapContainer}>
                  <Image
                    source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/moonvsjeet.png')}
                    style={styles.battlefieldImage as any}
                    resizeMode="cover"
                  />
                </View>

                <View style={[styles.interactiveBox, { borderColor: !scatFired ? COLORS.gold : COLORS.neonMoon }]}>
                  {!scatFired && <Text style={styles.taskTitle}>🎯 PvP Prediction Duel Required to Proceed</Text>}

                  <View style={styles.flexRowCenter}>
                    <TouchableOpacity
                      disabled={scene3Ticking || scatFired}
                      style={[styles.betBtn, { backgroundColor: COLORS.neonMoon }]}
                      onPress={() => startPredictionBattle("MOON")}
                    >
                      <Text style={[styles.betBtnText, { color: '#000' }]}>BET MOON 🟢</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={scene3Ticking || scatFired}
                      style={[styles.betBtn, { backgroundColor: COLORS.jeetRed }]}
                      onPress={() => startPredictionBattle("JEET")}
                    >
                      <Text style={styles.betBtnText}>💀 BET JEET</Text>
                    </TouchableOpacity>
                  </View>

                  {scatFired && (
                    <View style={styles.stampOverlay}>
                      <Text style={styles.stampTitle}>JEET WINS!</Text>
                      <Text style={styles.stampDesc}>"Wojak Skeleton called the dump! Pepe is rekt!"</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.instructionPrompt}>
                  {!scatFired ? "💡 Click one of the buttons to trigger the PvP Prediction Countdown!" : "✅ BATTLE DETONATED! Pepe is rekt."}
                </Text>
              </View>
            </View>
          )}

          {/* SCENE 4 */}
          {currentScene === 4 && (
            <View style={styles.sceneContainer}>
              <View style={[styles.characterCard, { borderColor: COLORS.gold, padding: 15 }]}>
                {scatConfetti && (
                  <View style={styles.fireworksOverlay}>
                    <Text style={{ fontSize: 24 }}>💩 💵 💩 💵 💩 💵 💩 💵</Text>
                  </View>
                )}

                <Image
                  source={require('../../assets/pepes/screen 2.png')}
                  style={styles.treatyImage as any}
                  resizeMode="contain"
                />

                <Text style={styles.shitmarketTitle}>SHITMARKET.LOL</Text>
                <Text style={styles.sceneDesc}>
                  "Pick a side. Bet the trenches. The only rug here is the one you sleep on after losing it all to the Wojak skeleton."
                </Text>

                <View style={[styles.interactiveBox, { borderColor: !scatConfetti ? COLORS.gold : COLORS.neonMoon }]}>
                  <Text style={styles.taskTitle}>🎯 TASK: Launch Platform Celebration</Text>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.gold }]}
                    onPress={() => setScatConfetti(true)}
                  >
                    <Text style={[styles.actionBtnText, { color: '#000' }]}>💩 BLAST POOH FIREWORKS!</Text>
                  </TouchableOpacity>
                  {scatConfetti && (
                    <Text style={styles.successText}>🟢 Platform ready. 1.25% system fees locked.</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* SCENE 5 */}
          {currentScene === 5 && (
            <View style={styles.sceneContainer}>
              <View style={[styles.characterCard, { borderColor: '#7f1d1d', padding: 15 }]}>
                <Text style={[styles.taskTitle, { textAlign: 'center', color: COLORS.neonMoon }]}>
                  ⚡ TERMINAL CHEAT DECODER DETECTED
                </Text>

                <View style={styles.terminalBox}>
                  <Text style={styles.terminalText}>&gt; awaiting_konami_code_input:</Text>
                  <Text style={styles.codeText}>
                    {konamiEntered.length > 0 ? konamiEntered.join(" → ") : "[ PRESS GAMEPAD KEYS ]"}
                  </Text>
                  {konamiSuccess && (
                    <View style={styles.successBadge}>
                      <Text style={styles.successBadgeText}>🔓 GOD MODE DEGEN SIGNED! UNLIMITED MOCK SOL CREDITS.</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.interactiveBox, { borderColor: !konamiSuccess ? COLORS.gold : COLORS.neonMoon, marginTop: 15 }]}>
                  <View style={styles.gamepad}>
                    <TouchableOpacity style={styles.gamepadBtn} onPress={() => handleKonamiTap("U")}>
                      <Text style={styles.gamepadBtnText}>↑</Text>
                    </TouchableOpacity>
                    <View style={styles.gamepadRow}>
                      <TouchableOpacity style={styles.gamepadBtn} onPress={() => handleKonamiTap("L")}>
                        <Text style={styles.gamepadBtnText}>←</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.gamepadBtn} onPress={() => handleKonamiTap("R")}>
                        <Text style={styles.gamepadBtnText}>→</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.gamepadBtn} onPress={() => handleKonamiTap("D")}>
                      <Text style={styles.gamepadBtnText}>↓</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.flexRowCenter, { marginTop: 15, gap: 15 }]}>
                    <TouchableOpacity style={styles.redButton} onPress={() => handleKonamiTap("B")}>
                      <Text style={styles.redButtonText}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.redButton} onPress={() => handleKonamiTap("A")}>
                      <Text style={styles.redButtonText}>A</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.cheatHint}>
                  Secret: Up Up Down Down Left Right Left Right B A
                </Text>
              </View>
            </View>
          )}

          {/* SCENE 6 */}
          {currentScene === 6 && (
            <View style={styles.sceneContainer}>
              <View style={[styles.characterCard, { borderColor: COLORS.gold, borderStyle: 'dashed', padding: 20 }]}>
                <Text style={styles.badgeRed}>🛡️ 100% RUGPROOF SOLDIER</Text>
                
                <Text style={styles.certTitle}>📜 DEGEN IMMORTALITY CERTIFICATE</Text>
                <Text style={styles.certRecipient}>Granted to: Anon the Trench Survivor</Text>

                <View style={styles.flexRowCenter}>
                  <Image
                    source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/moonvsjeet.png')}
                    style={styles.certThumbnail as any}
                  />
                  <Image
                    source={require('../../assets/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/shitmarket.png')}
                    style={styles.certThumbnail as any}
                  />
                </View>

                <View style={styles.certContent}>
                  <Text style={styles.certContentTitle}>★ HOLY IMMUNITY PROTOCOLS ACTIVATED ★</Text>
                  <Text style={styles.certListItem}>• RUG IMMUNITY: Any developer attempting to transfer liquidity to Dubai is teleported to the breadline.</Text>
                  <Text style={styles.certListItem}>• ANTI-PANIC SLEEP FILTER: Prevents jeetting at 3:00 AM on 5% minor dips.</Text>
                  <Text style={styles.certListItem}>• FINANCIAL PROTECTION: Guaranteed protection from buying local high, selling local low.</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* BOTTOM DIALOG & CONTROLS */}
        <View style={styles.footerContainer}>
          {/* Progress dots */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4, 5, 6].map(idx => (
              <View
                key={idx}
                style={[
                  styles.progressDot,
                  idx === currentScene && styles.progressDotActive,
                  idx < currentScene && styles.progressDotPassed
                ]}
              />
            ))}
          </View>

          {/* Typewriter subtitle dialogue */}
          <View style={styles.dialogBox}>
            <Text style={styles.dialogText}>{dialogText || "Awaiting transmission..."}</Text>
            <Text style={styles.dialogCounter}>
              {currentDialogIdx + 1} of {sceneDialogs[currentScene]?.length || 1} Segments
            </Text>
          </View>

          {/* Next dialog/scene trigger button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor:
                  currentDialogIdx === (sceneDialogs[currentScene]?.length || 1) - 1 && !isSceneChallengeSatisfied()
                    ? COLORS.gold
                    : COLORS.neonMoon,
              },
            ]}
            onPress={nextDialog}
          >
            <Text style={styles.nextButtonText}>
              {currentDialogIdx === (sceneDialogs[currentScene]?.length || 1) - 1 ? (
                isSceneChallengeSatisfied() ? (currentScene === 6 ? "DEPLOY 💣" : "DEPLOY") : "SOLVE TASK ⚠️"
              ) : (
                "READ NEXT ⏩"
              )}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#071105',
  },
  mainContainer: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1612',
    borderWidth: 1.5,
    borderColor: COLORS.sandbag,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  skipButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  skipText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#fca5a5',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sceneContainer: {
    width: '100%',
    alignItems: 'center',
  },
  despairRow: {
    width: '100%',
    gap: 15,
  },
  characterCard: {
    width: '100%',
    backgroundColor: '#12141c',
    borderWidth: 3,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  badgeRed: {
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    color: '#fff',
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeGold: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    color: '#000',
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  blendImages: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.1)',
  },
  memeImage: {
    width: (width - 60) / 2,
    height: 100,
    borderRadius: 6,
  },
  characterName: {
    fontFamily: FONTS.sans,
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
  },
  characterStatus: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.grayText,
    marginTop: 2,
    marginBottom: 10,
  },
  interactiveBox: {
    width: '100%',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderWidth: 2,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  taskTitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#22d3ee',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    backgroundColor: '#5C3A21',
    borderWidth: 1,
    borderColor: COLORS.sandbag,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  successText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
    marginTop: 8,
  },
  logBox: {
    width: '100%',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    marginTop: 8,
  },
  logTitle: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  logContent: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#ef4444',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
  },
  flexRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginVertical: 10,
  },
  roundAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.neonMoon,
  },
  sceneDesc: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: 15,
    marginVertical: 10,
  },
  duelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 10,
  },
  duelTitle: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.gold,
  },
  duelSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.grayText,
  },
  tickingBox: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: COLORS.jeetRed,
    padding: 6,
    borderRadius: 4,
  },
  tickingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#fca5a5',
    fontWeight: 'bold',
  },
  idleText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.neonMoon,
    fontWeight: 'bold',
  },
  mapContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 15,
  },
  battlefieldImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  betBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  betBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  stampOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderWidth: 4,
    borderColor: COLORS.jeetRed,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    left: 20,
    right: 20,
    top: 15,
  },
  stampTitle: {
    fontFamily: FONTS.sans,
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  stampDesc: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.gold,
    textAlign: 'center',
    marginTop: 4,
  },
  instructionPrompt: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gold,
    textAlign: 'center',
    marginTop: 10,
  },
  fireworksOverlay: {
    position: 'absolute',
    top: 10,
    alignItems: 'center',
    width: '100%',
  },
  treatyImage: {
    width: '100%',
    height: 80,
    marginVertical: 10,
  },
  shitmarketTitle: {
    fontFamily: FONTS.sans,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.gold,
    textAlign: 'center',
  },
  terminalBox: {
    width: '100%',
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    borderRadius: 6,
    padding: 10,
    minHeight: 100,
  },
  terminalText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: '#475569',
  },
  codeText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 12,
  },
  successBadge: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.neonMoon,
    borderRadius: 4,
    padding: 6,
  },
  successBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.neonMoon,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  gamepad: {
    alignItems: 'center',
  },
  gamepadRow: {
    flexDirection: 'row',
    gap: 40,
    marginVertical: 4,
  },
  gamepadBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#1f2937',
    borderWidth: 1.5,
    borderColor: '#374151',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gamepadBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  redButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.jeetRed,
    borderWidth: 2,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cheatHint: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
  },
  certTitle: {
    fontFamily: FONTS.sans,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.gold,
    textAlign: 'center',
    marginTop: 8,
  },
  certRecipient: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.neonMoon,
    textAlign: 'center',
    marginVertical: 6,
  },
  certThumbnail: {
    width: 100,
    height: 70,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  certContent: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#d97706',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  certContentTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  certListItem: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#d1d5db',
    lineHeight: 15,
    marginBottom: 4,
  },
  footerContainer: {
    backgroundColor: '#1a1612',
    borderWidth: 1.5,
    borderColor: COLORS.sandbag,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#374151',
  },
  progressDotActive: {
    width: 16,
    backgroundColor: COLORS.neonMoon,
  },
  progressDotPassed: {
    backgroundColor: '#4d7c0f',
  },
  dialogBox: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: COLORS.sandbag,
    borderRadius: 6,
    padding: 8,
    minHeight: 50,
    justifyContent: 'space-between',
  },
  dialogText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.gold,
    lineHeight: 15,
  },
  dialogCounter: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: '#4b5563',
    textAlign: 'right',
    marginTop: 4,
  },
  nextButton: {
    marginTop: 8,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
});
