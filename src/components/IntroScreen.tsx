'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { soundSynth } from "./SoundSynth";
import { 
  Volume2, VolumeX, ArrowRight, SkipForward, Zap, Skull
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from '@/store/useAppState';
import confetti from 'canvas-confetti';

interface IntroScreenProps {
  onComplete: () => void;
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  const { setFullDegenMode } = useAppState();
  
  const [currentScene, setCurrentScene] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Dialog typing indicators
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

  // Dialog configuration
  const sceneDialogs: Record<number, string[]> = {
    1: [
      'PEPE: "bought the top again. Liquidity disappeared. Dev vanished. Wife\'s boyfriend is texting about rent."',
      'JEET SKELETON: "Sell you fool! It\'s going to absolute zero! We\'re all gonna make it—to the breadline!"',
      'PEPE: "sobbing" I just wanted to retire at 23...'
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
      'PEPE: "whispers" We also have parlays.',
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

  // Re-start typewriter on dialog line changes
  useEffect(() => {
    const dialogs = sceneDialogs[currentScene];
    if (dialogs && dialogs[currentDialogIdx]) {
      setDialogText("");
      setDialogCharIndex(0);
    }
  }, [currentScene, currentDialogIdx]);

  // Typewriter effect ticker
  useEffect(() => {
    const dialogs = sceneDialogs[currentScene];
    if (!dialogs || !dialogs[currentDialogIdx]) return;

    const activeLine = dialogs[currentDialogIdx];
    if (dialogCharIndex < activeLine.length) {
      const t = setTimeout(() => {
        setDialogText(prev => prev + activeLine[dialogCharIndex]);
        setDialogCharIndex(prev => prev + 1);
      }, 25);
      return () => clearTimeout(t);
    }
  }, [dialogCharIndex, currentScene, currentDialogIdx]);

  // Trigger vocal phonetic or instrument sound upon specific dialog line mounting
  useEffect(() => {
    // Scene 1 Voices
    if (currentScene === 1) {
      if (currentDialogIdx === 0) {
        soundSynth.speakRentDue();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakSellIt();
      } else if (currentDialogIdx === 2) {
        soundSynth.speakBruh();
      }
    }
    // Scene 2 Voices (Chad Bull enters)
    else if (currentScene === 2) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNaw();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat();
      } else if (currentDialogIdx === 2) {
        soundSynth.speakNoRug();
      }
    }
    // Scene 3 Voices
    else if (currentScene === 3) {
      if (currentDialogIdx === 0) {
        soundSynth.speakBruh();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat();
      } else if (currentDialogIdx === 2) {
        soundSynth.speakGetRekt();
      } else if (currentDialogIdx === 3) {
        soundSynth.speakNoRug();
      }
    }
    // Scene 4 Voices
    else if (currentScene === 4) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNoRug();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat();
      } else if (currentDialogIdx === 2) {
        soundSynth.speakBruh();
      } else if (currentDialogIdx === 3) {
        soundSynth.speakGetRekt();
      }
    }
    // Scene 5 Cheat code
    else if (currentScene === 5) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNaw();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakRentDue();
      } else if (currentDialogIdx === 2) {
        soundSynth.playLaserFart();
      }
    }
    // Scene 6 Outro
    else if (currentScene === 6) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNoRug();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakSheeeesh();
      } else if (currentDialogIdx === 2) {
        soundSynth.playTrumpetVictory();
      }
    }
  }, [currentScene, currentDialogIdx]);

  // Handle muting
  const toggleMute = () => {
    const nextMuted = soundSynth.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleSkip = () => {
    if (konamiSuccess) {
      setFullDegenMode(true);
    }
    
    // Trigger beautiful golden coin rain confetti!
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      // Coins from top-left corner
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0 },
        colors: ['#FFD700', '#DFAC00', '#F3C300', '#FFEA70', '#E5A93B'],
        shapes: ['circle'],
        scalar: 1.8,
        gravity: 0.8,
        drift: 0.15
      });
      // Coins from top-right corner
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0 },
        colors: ['#FFD700', '#DFAC00', '#F3C300', '#FFEA70', '#E5A93B'],
        shapes: ['circle'],
        scalar: 1.8,
        gravity: 0.8,
        drift: -0.15
      });
      
      // Coins randomly from across the top sky
      confetti({
        particleCount: 3,
        angle: 90,
        spread: 100,
        origin: { x: Math.random(), y: -0.1 },
        colors: ['#FFD700', '#DFAC00', '#F3C300', '#FFEA70', '#E5A93B'],
        shapes: ['circle'],
        scalar: 2.0,
        gravity: 0.7,
        drift: Math.random() * 0.3 - 0.15
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    
    frame();
    onComplete();
  };

  const nextDialog = () => {
    const dialogs = sceneDialogs[currentScene];
    if (currentDialogIdx < dialogs.length - 1) {
      setCurrentDialogIdx(prev => prev + 1);
      soundSynth.playBonk();
    } else {
      // Check if scene challenges are complete before moving to next scene!
      if (!isSceneChallengeSatisfied()) {
        soundSynth.playSadKazoo();
        return;
      }
      nextScene();
    }
  };

  const isSceneChallengeSatisfied = () => {
    if (currentScene === 1 && tearsWiped < 5) return false;
    if (currentScene === 2 && chadPumps < 4) return false;
    if (currentScene === 3 && !scatFired) return false;
    if (currentScene === 4 && !scatConfetti) return false;
    if (currentScene === 5 && !konamiSuccess) return false;
    return true;
  };

  const nextScene = () => {
    if (currentScene < 6) {
      setCurrentScene(prev => prev + 1);
      setCurrentDialogIdx(0);
    } else {
      handleSkip();
    }
  };

  // Scene 1 Interactive Handlers
  const handleWipeTears = () => {
    setTearsWiped(prev => prev + 1);
    soundSynth.playCoinClink();
    if (tearsWiped + 1 >= 5) {
      soundSynth.playTrumpetVictory();
    }
  };

  const handleCallDev = () => {
    setDevCallState("DEV IN DUBAI WITH COCKTAILS. USER RUGGED.");
    soundSynth.playSadKazoo();
  };

  // Scene 2 Interactive Handlers
  const handlePumpChad = () => {
    setChadPumps(prev => prev + 1);
    soundSynth.playBonk();
    if (chadPumps + 1 === 4) {
      soundSynth.playExplosion();
    }
  };

  // Scene 3 Interactive Countdown
  const startPredictionBattle = (stance: "MOON" | "JEET") => {
    if (scene3Ticking) return;
    setScene3Choice(stance);
    setScene3Ticking(true);
    soundSynth.playWarDrums();

    let counter = 3;
    const interval = setInterval(() => {
      counter--;
      if (counter > 0) {
        setScene3Timer(counter);
        soundSynth.playBonk();
      } else {
        clearInterval(interval);
        soundSynth.playSlam();
        setScatFired(true);
        setScene3Ticking(false);
      }
    }, 1000);
  };

  // Konami keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentScene !== 5) return;
      
      const keyMap: Record<string, string> = {
        ArrowUp: "U",
        ArrowDown: "D",
        ArrowLeft: "L",
        ArrowRight: "R",
        KeyB: "B",
        KeyA: "A",
        b: "B",
        a: "A"
      };

      const mapped = keyMap[e.code] || keyMap[e.key];
      if (mapped) {
        handleKonamiTap(mapped);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentScene, konamiEntered, konamiSuccess]);

  const handleKonamiTap = (char: string) => {
    const updated = [...konamiEntered, char];
    soundSynth.playBonk();

    // Check code sequence: U U D D L R L R B A
    const sequence = ["U", "U", "D", "D", "L", "R", "L", "R", "B", "A"];
    const matchesSoFar = updated.every((v, i) => v === sequence[i]);

    if (!matchesSoFar) {
      setKonamiEntered([char]);
      return;
    }

    setKonamiEntered(updated);

    if (updated.length === 10) {
      setKonamiSuccess(true);
      soundSynth.playLaserFart();
      soundSynth.playTrumpetVictory();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#071105] flex items-center justify-center p-2 md:p-4 select-none font-mono">
      <div className="w-full h-full max-w-7xl max-h-[850px] text-white bg-trench-black crt-effect p-4 rounded-xl flex flex-col justify-between border-4 border-trench-sandbag shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] overflow-hidden relative select-none">
        
        {/* Retro CRT Animated Scrolling Grid Background */}
        <div className="scrolling-grid-overlay" />
        
        {/* TOP HEADER STATUS */}
        <div className="flex justify-between items-center bg-trench-mud border-2 border-trench-sandbag rounded p-2 mb-2 z-10">
          <div className="flex items-center gap-2">
            <Skull className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="font-staatliches text-lg sm:text-xl tracking-wider text-yellow-500 uppercase">
              SOLANA DEGEN TRENCHES COMMS
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMute}
              className="p-1 px-2.5 bg-black hover:bg-gray-950 text-yellow-400 rounded border border-trench-sandbag flex items-center gap-1 font-mono text-xs transition-colors"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-lime-400" />}
              {isMuted ? "Mut" : "Sound"}
            </button>
            <button 
              onClick={handleSkip}
              className="p-1 px-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 font-staatliches uppercase tracking-widest text-xs rounded transition-colors flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
          </div>
        </div>

        {/* MID PANEL: DRAMATIC MEME CARD RACK */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 z-10 overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {/* SCENE 1 LAYOUT CC */}
            {currentScene === 1 && (
              <motion.div 
                key="scene1"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center"
              >
                {/* Despair Soldier Pepe */}
                <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-4 text-center group shadow-2xl relative overflow-hidden">
                  <div className="absolute top-2 right-2 bg-red-600 border border-red-400 text-white font-mono text-[9px] px-2 py-0.5 rounded animate-pulse">
                    -99.7% PORTFOLIO
                  </div>
                  
                  {/* Two blended aesthetically matching Pepe images side-by-side */}
                  <div className="grid grid-cols-2 gap-2 mb-2 p-1 bg-black/40 border border-green-800/40 rounded-lg">
                    <img 
                      src="/pepes/pepe-few-understand.png" 
                      alt="Pepe Few Understand" 
                      className="w-full h-28 sm:h-36 object-cover rounded border border-green-700/50 shadow-md"
                    />
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/pepe.png" 
                      alt="Pepe Soldier in Trench" 
                      className={`w-full h-28 sm:h-36 object-cover rounded border border-red-900/50 shadow-md ${tearsWiped < 5 ? 'animate-bounce' : ''}`}
                    />
                  </div>

                  <h3 className="font-staatliches text-2xl text-red-500 mt-2 uppercase">Pepe the Soldier</h3>
                  <p className="font-mono text-[10px] text-gray-400 mt-1">Status: Liquidated at the Giga-top</p>

                  {/* Progress Mini Game */}
                  <div className={`mt-3 p-3 rounded-lg border-2 transition-all duration-300 ${
                    tearsWiped < 5 
                      ? 'border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)] bg-yellow-950/20' 
                      : 'border-lime-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] bg-lime-950/20'
                  }`}>
                    <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                      <span>🎯 TASK: Wipe Pepe's tears ({tearsWiped}/5 wipes)</span>
                      {tearsWiped < 5 && (
                        <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black text-[8px] animate-bounce">
                          CRITICAL ACTION
                        </span>
                      )}
                    </div>
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={handleWipeTears}
                        className="px-3 py-1 bg-[#5C3A21] border-b-4 border-[#3A2512] font-mono text-xs text-white uppercase rounded transition-transform active:translate-y-1 hover:bg-[#6c4427]"
                      >
                        🧻 Wipe Tears
                      </button>
                      <button 
                        onClick={handleCallDev}
                        className="px-3 py-1 bg-red-950 border border-red-600 font-mono text-xs text-red-200 uppercase rounded hover:bg-red-900"
                      >
                        📞 CALL DEV
                      </button>
                    </div>
                    {tearsWiped >= 5 && <div className="text-lime-400 text-[10px] font-bold mt-2 font-mono text-center">✅ PEPE CALMED (TEMPORARILY)</div>}
                  </div>
                </div>

                {/* Wojak Skeleton */}
                <div className="bg-trench-mud border-4 border-red-800/60 rounded-xl p-4 text-center group shadow-2xl relative">
                  <div className="absolute top-2 left-2 bg-yellow-500 text-black font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                    JEET OVERLORD
                  </div>

                  {/* Two blended aesthetically matching Skeleton images side-by-side */}
                  <div className="grid grid-cols-2 gap-2 mb-2 p-1 bg-black/40 border border-red-800/40 rounded-lg">
                    <img 
                      src="/pepes/jeet-skeleton.png" 
                      alt="Jeet Skeleton" 
                      className="w-full h-28 sm:h-36 object-cover rounded border border-red-700/50 shadow-md"
                    />
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/trolling.png" 
                      alt="Trolling Skeleton" 
                      className="w-full h-28 sm:h-36 object-cover rounded border border-red-900/50 shadow-md"
                    />
                  </div>

                  <h3 className="font-staatliches text-2xl text-red-500 mt-2 uppercase">Wojak Skeleton</h3>
                  <p className="font-mono text-[10px] text-gray-400 mt-1">Status: Sitting on Breadline bags</p>

                  {/* Funny debug text */}
                  <div className={`mt-3 p-2 text-left rounded h-20 transition-all duration-300 flex flex-col justify-between ${
                    devCallState !== "CALLING DEV..." 
                      ? "bg-red-950/90 border-4 border-red-500 animate-pulse shadow-[0_0_30px_#EF4444]" 
                      : "bg-black/80 border border-gray-800"
                  }`}>
                    <div className="font-mono text-[10px] text-gray-500 uppercase leading-none mb-1">Jeet Terminal Logs</div>
                    <div className={`font-mono text-center font-bold mt-1 ${
                      devCallState !== "CALLING DEV..." 
                        ? "text-yellow-400 uppercase tracking-widest text-shadow-[0_0_10px_#EF4444] text-xs font-black" 
                        : "text-red-500 text-[9px]"
                    }`}>
                      {devCallState}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCENE 2 LAYOUT CC */}
            {currentScene === 2 && (
              <motion.div 
                key="scene2"
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-trench-mud border-4 border-lime-500 rounded-xl p-6 text-center shadow-2xl relative"
              >
                <div className="absolute top-4 right-4 bg-lime-500 text-black font-staatliches text-xs px-3 py-1 font-bold animate-bounce tracking-widest rounded shadow-[0_0_15px_#39FF14]">
                  1000x FORCE MULTIPLIER
                </div>

                {/* Blended characters display side-by-side */}
                <div className="flex flex-row justify-center items-center gap-6 my-4">
                  {/* Giga Chad Image */}
                  <div className="flex flex-col items-center">
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/chadbull.png" 
                      alt="Giga Chad" 
                      className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full object-contain border-8 border-lime-400 shadow-[0_0_30px_rgba(57,255,20,0.5)] ${chadPumps > 0 ? 'animate-bounce' : ''}`}
                      style={{ transform: `scale(${1 + chadPumps * 0.05})` }}
                    />
                    <span className="font-staatliches text-sm text-lime-400 mt-2">GIGA CHAD</span>
                  </div>

                  {/* Skeleton Wojak Image */}
                  <div className="flex flex-col items-center">
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/skeletonwojak.png" 
                      alt="Skeleton Wojak" 
                      className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                    />
                    <span className="font-staatliches text-sm text-red-500 mt-2">JEET SKELETON</span>
                  </div>
                </div>

                <h2 className="font-staatliches text-3xl sm:text-4xl text-lime-400 tracking-wider mt-4 uppercase">
                  Giga-Chad Descends!
                </h2>
                <p className="font-mono text-xs text-gray-300 max-w-md mx-auto mt-2">
                  "You don't buy the coin. You bet on its soul. Leverage up, soldier! We strike the jeets at dawn."
                </p>

                {/* Parachute pumping mini game */}
                <div className={`mt-4 p-4 rounded-lg border-2 max-w-md mx-auto transition-all duration-300 ${
                  chadPumps < 4 
                    ? 'border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)] bg-yellow-950/20' 
                    : 'border-lime-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] bg-lime-950/20'
                }`}>
                  <div className="text-[10px] font-mono text-lime-400 uppercase font-bold tracking-widest mb-1 flex items-center justify-between">
                    <span>🎯 TASK: Pump Chad's Parachute Candle ({chadPumps}/4 pumps)</span>
                    {chadPumps < 4 && (
                      <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black text-[8px] animate-bounce">
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={handlePumpChad}
                    className="px-6 py-2 bg-lime-500 hover:bg-lime-400 text-black font-staatliches uppercase font-extrabold text-sm rounded shadow-[0_0_10px_#39FF14] transition-transform active:scale-95 mt-1"
                  >
                    PUMP CROWD FORCE
                  </button>
                </div>
              </motion.div>
            )}

            {/* SCENE 3 LAYOUT CC (Reverted back to previous images) */}
            {currentScene === 3 && (
              <motion.div 
                key="scene3"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-4xl bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 shadow-2xl relative"
              >
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-trench-sandbag pb-2 mb-2">
                  <div>
                    <h2 className="font-staatliches text-2xl sm:text-3xl text-yellow-500 uppercase tracking-widest">
                      PvP PREDICTION MATRICES
                    </h2>
                    <p className="font-mono text-[10px] text-gray-400">Sample game mechanics simulation</p>
                  </div>
                  
                  {/* Ticking Bomb */}
                  {scene3Ticking ? (
                    <div className="flex items-center gap-2 bg-red-950 p-2 rounded border border-red-500 animate-pulse">
                      <span className="font-mono text-red-500 font-bold">💣 BOMB DETONATING</span>
                      <span className="font-mono text-xl font-bold text-red-400">0:0{scene3Timer}</span>
                    </div>
                  ) : (
                    <span className="text-lime-400 font-mono text-xs font-bold bg-lime-950/60 px-2 py-1 rounded">
                      ★ SIMULATION IDLE
                    </span>
                  )}
                </div>

                {/* Arena Map Illustration (Reverted back to high-res dynamic image) */}
                <div className="w-full max-w-xl mx-auto mb-4 bg-black/40 border-2 border-trench-sandbag rounded-lg overflow-hidden relative shadow-inner">
                  <img 
                    src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/moonvsjeet.png" 
                    alt="MOON vs JEET No Man's Land Battlefield"
                    className="w-full h-28 sm:h-36 object-cover opacity-85 transition-opacity hover:opacity-100"
                  />
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 border border-[#39FF14] text-[#39FF14] font-mono text-[8px] uppercase tracking-wider rounded">
                    map: pvp_trenches_countdown.tga
                  </div>
                </div>

                {/* Arena Battle field */}
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 my-2 relative p-3 rounded-xl border-2 transition-all duration-300 ${
                  !scatFired 
                    ? 'border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)] bg-yellow-950/10' 
                    : 'border-lime-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] bg-lime-950/10'
                }`}>
                  {!scatFired && (
                    <div className="absolute -top-3 left-4 bg-yellow-500 text-black px-2 py-0.5 font-bold font-mono text-[9px] rounded uppercase animate-bounce z-30">
                      🚨 PvP Prediction Duel Required to Proceed
                    </div>
                  )}
                  
                  {/* Moon side */}
                  <div className={`p-4 rounded-xl border-2 transition-all text-center ${
                    scene3Choice === "MOON" ? "bg-lime-950/20 border-lime-400" : "bg-black/40 border-gray-800"
                  }`}>
                    <h3 className="font-staatliches text-xl text-lime-400 flex items-center justify-center gap-2 uppercase">
                      MOON SIDE (BULLS)
                    </h3>
                    <div className="text-gray-400 text-md font-mono my-3 font-bold">Pot: 4.88 SOL</div>
                    <button 
                      onClick={() => startPredictionBattle("MOON")}
                      disabled={scene3Ticking || scatFired}
                      className="w-full py-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-black font-staatliches font-extrabold text-sm uppercase rounded transition-all"
                    >
                      BET MOON 0.05 SOL
                    </button>
                  </div>

                  {/* Jeet side */}
                  <div className={`p-4 rounded-xl border-2 transition-all text-center ${
                    scene3Choice === "JEET" ? "bg-red-950/20 border-red-500" : "bg-black/40 border-gray-800"
                  }`}>
                    <h3 className="font-staatliches text-xl text-red-500 flex items-center justify-center gap-2 uppercase">
                      JEET SIDE (BEARS)
                    </h3>
                    <div className="text-gray-400 text-md font-mono my-3 font-bold">Pot: 14.50 SOL</div>
                    <button 
                      onClick={() => startPredictionBattle("JEET")}
                      disabled={scene3Ticking || scatFired}
                      className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-staatliches font-extrabold text-sm uppercase rounded transition-all"
                    >
                      💀 BET JEET 2.0 SOL
                    </button>
                  </div>

                  {/* Stamp overlay */}
                  {scatFired && (
                    <motion.div 
                      initial={{ scale: 3, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: -10 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/85 z-20 pointer-events-none rounded-xl"
                    >
                      <div className="border-[10px] border-red-600 bg-red-950 p-6 rounded text-center shadow-2xl max-w-sm">
                        <h1 className="font-staatliches text-4xl text-white font-extrabold tracking-widest uppercase">
                          JEET WINS!
                        </h1>
                        <p className="font-mono text-xs text-yellow-400 mt-2">
                          "Wojak Skeleton called the dump! Pepe is rekt!"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Progress directive check */}
                <div className="mt-4 text-center">
                  {!scatFired ? (
                    <div className="text-[11px] font-mono text-yellow-400 italic animate-pulse">
                      💡 Click one of the buttons to trigger the PvP Prediction Countdown!
                    </div>
                  ) : (
                    <div className="text-lime-400 text-xs font-bold font-mono">
                      ✅ BATTLE DETONATED! Pepe is rekt, but we have completed prediction analytics.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SCENE 4 LAYOUT CC (Reverted back to previous images) */}
            {currentScene === 4 && (
              <motion.div 
                key="scene4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-3xl bg-trench-mud border-4 border-yellow-500 rounded-xl p-3 md:p-4 text-center shadow-2xl relative"
              >
                {/* Explosion effect container */}
                {scatConfetti && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute w-2 h-2 text-xl animate-bounce"
                        style={{
                          top: `${Math.random() * 80}%`,
                          left: `${Math.random() * 90}%`,
                          color: Math.random() < 0.5 ? '#39FF14' : '#FFD700'
                        }}
                      >
                        {Math.random() < 0.5 ? '💩' : '💵'}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upgraded card image to pepes/screen 2.png */}
                <img 
                  src="/pepes/screen 2.png"
                  alt="Shitmarket Treaty Screen"
                  className="w-full max-w-[220px] max-h-24 mx-auto rounded-lg object-contain border-4 border-yellow-500 shadow-2xl animate-pulse my-1"
                />

                <h1 className="font-staatliches text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-yellow-400 to-red-600 mt-1 uppercase tracking-tighter">
                  SHITMARKET.LOL
                </h1>
                <p className="font-mono text-[10px] text-gray-300 max-w-lg mx-auto mt-1 leading-relaxed">
                  "Pick a side. Bet the trenches. The only rug here is the one you sleep on after losing it all to the Wojak skeleton."
                </p>

                {/* Progress clicker */}
                <div className={`mt-2 max-w-md mx-auto p-2.5 rounded-lg border-2 transition-all duration-300 ${
                  !scatConfetti 
                    ? 'border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)] bg-yellow-950/20' 
                    : 'border-lime-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] bg-lime-950/20'
                }`}>
                  <div className="text-[9px] font-mono text-yellow-400 uppercase font-bold tracking-widest mb-1 flex items-center justify-between">
                    <span>🎯 TASK: Launch Platform Celebration</span>
                    {!scatConfetti && (
                      <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black text-[8px] animate-bounce">
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setScatConfetti(true);
                      soundSynth.playExplosion();
                    }}
                    className="px-5 py-1.5 bg-yellow-400 text-black font-staatliches font-extrabold text-sm rounded tracking-wider uppercase shadow-[0_3px_0_#9A7d00] transition-colors hover:bg-yellow-500 active:translate-y-0.5"
                  >
                    💩 BLAST POOH FIREWORKS!
                  </button>
                  {scatConfetti && (
                    <div className="font-mono text-lime-400 text-[9px] font-bold mt-1.5 animate-pulse">
                      🟢 Platform ready. 1.25% system fees locked. Parlay engine calibrated.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SCENE 5 LAYOUT CC */}
            {currentScene === 5 && (
              <motion.div 
                key="scene5"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-2xl bg-[#0D0D0A] border-4 border-red-950 rounded-xl p-6 text-center shadow-2xl relative"
              >
                <div className="font-mono text-lime-400 text-sm mb-4 border-b border-gray-800 pb-2 flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                  <span>TERMINAL CHEAT DECODER DETECTED</span>
                </div>

                {/* Matrix rain background overlay */}
                <div className="p-3 bg-black border border-gray-800 rounded min-h-32 text-left font-mono text-xs text-lime-500 tracking-widest">
                  <span className="text-gray-500">&gt;</span> awaiting_konami_code_input:
                  <div className="text-center font-bold text-lg text-yellow-400 my-4 animate-pulse">
                    {konamiEntered.length > 0 ? konamiEntered.join(" → ") : "[ PRESS GAMEPAD KEYS BELOW ]"}
                  </div>
                  {konamiSuccess && (
                    <div className="text-lime-400 font-extrabold bg-lime-950/20 p-2 my-2 text-center rounded border border-lime-400 uppercase animate-bounce text-sm">
                      🔓 GOD DEGEN MODE SIGNED! UNLIMITED MOCK SOL CREDITS GRANTED.
                    </div>
                  )}
                </div>

                {/* Virtual Gamepad overlay */}
                <div className={`mt-6 p-4 rounded-xl border-2 transition-all duration-300 max-w-md mx-auto ${
                  !konamiSuccess 
                    ? 'border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)] bg-yellow-950/20' 
                    : 'border-lime-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] bg-lime-950/20'
                }`}>
                  {!konamiSuccess && (
                    <div className="bg-yellow-500 text-black font-bold font-mono text-[9px] px-2 py-0.5 rounded uppercase mb-3 animate-bounce inline-block">
                      🚨 God Mode Key Code Entry Required
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center">
                      <button 
                        onClick={() => handleKonamiTap("U")}
                        className="w-10 h-10 bg-gray-800 border-2 border-gray-700 active:bg-lime-400 transform active:scale-95 flex items-center justify-center text-white font-extrabold rounded text-md"
                      >
                        ↑
                      </button>
                      <div className="flex gap-10 mt-1">
                        <button 
                          onClick={() => handleKonamiTap("L")}
                          className="w-10 h-10 bg-gray-800 border-2 border-gray-700 active:bg-lime-400 transform active:scale-95 flex items-center justify-center text-white font-extrabold rounded text-md"
                        >
                          ←
                        </button>
                        <button 
                          onClick={() => handleKonamiTap("R")}
                          className="w-10 h-10 bg-gray-800 border-2 border-gray-700 active:bg-lime-400 transform active:scale-95 flex items-center justify-center text-white font-extrabold rounded text-md"
                        >
                          →
                        </button>
                      </div>
                      <button 
                        onClick={() => handleKonamiTap("D")}
                        className="w-10 h-10 bg-gray-800 border-2 border-gray-700 active:bg-lime-400 transform active:scale-95 flex items-center justify-center text-white font-extrabold rounded text-md mt-1"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="flex gap-4 mt-2">
                      <button 
                        onClick={() => handleKonamiTap("B")}
                        className="w-12 h-12 bg-red-600 active:bg-red-400 border-2 border-red-500 rounded-full font-staatliches font-extrabold text-white text-lg flex items-center justify-center shadow-lg animate-pulse"
                      >
                        B
                      </button>
                      <button 
                        onClick={() => handleKonamiTap("A")}
                        className="w-12 h-12 bg-red-600 active:bg-red-400 border-2 border-red-500 rounded-full font-staatliches font-extrabold text-white text-lg flex items-center justify-center shadow-lg animate-pulse"
                      >
                        A
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 font-mono text-[10px] text-gray-400 italic">
                  Secret Combination: Up Up Down Down Left Right Left Right B A
                </div>
              </motion.div>
            )}

            {/* SCENE 6 OUTRO: DEGEN IMMORTALITY CERTIFICATE (Infuses moonvsjeet.png and shitmarket.png locally) */}
            {currentScene === 6 && (
              <motion.div 
                key="scene6"
                initial={{ scale: 0.92, rotate: -2, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="w-full max-w-4xl bg-trench-mud border-8 border-double border-yellow-500 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(234,179,8,0.3)] relative overflow-hidden scanlines"
              >
                <div className="absolute top-3 right-3 bg-red-600 border-2 border-red-400 text-white font-staatliches text-xs px-3 py-1 rounded animate-bounce shadow-lg">
                  🛡️ 100% RUGPROOF SOLDIER
                </div>
                
                <h1 className="font-staatliches text-4xl sm:text-5xl text-yellow-500 tracking-wider mb-2 uppercase text-shadow-[0_2px_4px_black]">
                  📜 DEGEN IMMORTALITY CERTIFICATE
                </h1>
                
                <p className="font-mono text-xs text-lime-400 uppercase font-bold tracking-widest mb-4">
                  Granted to: Anon the Trench Survivor
                </p>

                {/* Infusing both local assets moonvsjeet.png and shitmarket.png side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-4 bg-black/60 p-3 rounded-xl border-2 border-trench-sandbag shadow-inner">
                  <div className="flex flex-col gap-1.5">
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/moonvsjeet.png" 
                      alt="Trench Combat Grid"
                      className="w-full h-28 sm:h-36 object-cover rounded-lg border border-lime-500/50 shadow-md hover:scale-102 transition-transform duration-200"
                    />
                    <span className="font-mono text-[9px] text-lime-400 font-bold uppercase">Fig 1. Real-time Trench Combat Matrix</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <img 
                      src="/crude_2d_animation_style_hand_drawn_meme_characters_mixed_with_pixel_art/shitmarket.png" 
                      alt="Holy Degen Peace Pact"
                      className="w-full h-28 sm:h-36 object-cover rounded-lg border border-yellow-500/50 shadow-md hover:scale-102 transition-transform duration-200"
                    />
                    <span className="font-mono text-[9px] text-yellow-400 font-bold uppercase">Fig 2. The Holy Degen Peace Treaty (1.25% Fees Locked)</span>
                  </div>
                </div>

                {/* Extremely funny checklist for meme traders */}
                <div className="bg-black/95 border-2 border-yellow-600/40 p-4 rounded-xl text-left max-w-2xl mx-auto font-mono text-[11px] sm:text-xs leading-relaxed text-yellow-500 relative">
                  <div className="absolute top-2 right-2 text-[8px] text-gray-500 font-bold">CERTIFICATE ID: #000000420</div>
                  <div className="font-bold border-b border-yellow-600/20 pb-1 mb-2 text-yellow-400 uppercase tracking-widest text-center">
                    ★ HOLY IMMUNITY PROTOCOLS ACTIVATED ★
                  </div>
                  <ul className="space-y-1.5 list-disc pl-4 text-gray-300">
                    <li><strong className="text-lime-400">RUG IMMUNITY:</strong> Enforced by Giga-Chad Bull. Any developer attempting to transfer liquidity to Dubai is immediately teleported to the breadline.</li>
                    <li><strong className="text-lime-400">ANTI-PANIC SLEEP FILTER:</strong> Prevents jeetting at 3:00 AM on 5% minor dips.</li>
                    <li><strong className="text-lime-400">FINANCIAL PROTECTION:</strong> Guaranteed protection from buying local high, selling local low, and listening to "influencer" calls on X.</li>
                    <li><strong className="text-yellow-400">PORTFOLIO BALANCES:</strong> 1,000,000,000 artificial mock SOL credited. Standard use: flexing on social media. (Value: $0.00, Ego value: priceless).</li>
                  </ul>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM CONTROL SUBTITLE BOX */}
        <div className="bg-trench-mud border-2 border-trench-sandbag rounded-xl p-4 flex flex-col md:flex-row justify-between items-center z-10 select-none gap-4">
          
          {/* Story progress visual indicator dots */}
          <div className="flex items-center gap-1.5 md:self-center">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div 
                key={idx} 
                className={`h-2.5 rounded-full transition-all ${
                  idx === currentScene 
                    ? "w-6 bg-lime-400 shadow-[0_0_8px_#39FF14]" 
                    : idx < currentScene 
                      ? "w-2.5 bg-lime-800" 
                      : "w-2.5 bg-gray-700"
                }`}
              ></div>
            ))}
          </div>

          {/* Dynamic dialogue subtitles with typewriter box */}
          <div className="flex-1 max-w-2xl bg-black/90 px-4 py-3 rounded-lg border border-trench-sandbag text-left flex flex-col justify-between min-h-[70px]">
            <div className="font-mono text-xs text-yellow-400 font-extrabold tracking-wider leading-relaxed">
              {dialogText || "Awaiting transmission..."}
            </div>
            <div className="text-[10px] font-mono text-gray-500 text-right mt-1.5 leading-none">
              {currentDialogIdx + 1} of {sceneDialogs[currentScene]?.length || 1} Dialogue Segment
            </div>
          </div>

          {/* Dynamic transition action command button */}
          <button 
            onClick={nextDialog}
            className={`px-6 py-3.5 font-staatliches font-black text-lg tracking-wider uppercase rounded-md border transition-all flex items-center gap-1.5 active:translate-y-1 active:shadow-none min-w-[140px] ${
              currentDialogIdx === (sceneDialogs[currentScene]?.length || 1) - 1 && !isSceneChallengeSatisfied()
                ? "bg-amber-500 hover:bg-amber-400 text-black border-amber-300 shadow-[0_4px_0_#9a6200] animate-pulse animate-bounce"
                : "bg-lime-500 hover:bg-lime-400 text-black border-lime-300 shadow-[0_4px_0_#107100]"
            }`}
          >
            {currentDialogIdx === (sceneDialogs[currentScene]?.length || 1) - 1 ? (
              isSceneChallengeSatisfied() ? (currentScene === 6 ? "Deploy" : "Deploy") : "Solve Task ⚠️"
            ) : (
              <span className="flex items-center gap-1">Read Next <ArrowRight className="w-5 h-5 text-black animate-pulse" /></span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
