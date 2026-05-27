/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { soundSynth } from "./SoundSynth";
import { 
  Volume2, VolumeX, ArrowRight, HelpCircle, 
  Sparkles, SkipForward, Play, ShieldAlert, Zap, Skull
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface IntroScreenProps {
  onSkip: (isCheatCodesUnlocked: boolean) => void;
}

export default function IntroScreen({ onSkip }: IntroScreenProps) {
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
      "PEPE: *bought the top again. Liquidity disappeared. Dev vanished. Wife's boyfriend is texting about rent.*",
      "JEET SKELETON: *Sell you fool! It's going to absolute zero! We're all gonna make it—to the breadline!*",
      "PEPE: *sobbing* I just wanted to retire at 23..."
    ],
    2: [
      "CHAD BULL: Pathetic. You're still buying shitcoins? That's like bringing a spoon to a gunfight.",
      "PEPE & WOJAK: What is the alternative, genius?",
      "CHAD BULL: You don't buy the coin. You bet on its SOUL. Welcome to SHITMARKET.LOL"
    ],
    3: [
      "NARRATOR: Introducing ShitMarket—the PvP prediction arena where you stake SOL on whether a meme coin pumps... or dumps.",
      "NARRATOR: If you're right, you eat the losers' lunch. If you're wrong... well...",
      "JEET SKELETON: CALLED THE DUMP! GET REKT, NERD! HAHAHA!",
      "PEPE: Worth it. No rug. No gas war. Just pure, unadulterated gambling."
    ],
    4: [
      "CHAD BULL: No rugs. Just bets. 2% platform fee. Now get in the trench, anon.",
      "ANON: Is there leverage?",
      "PEPE: *whispers* We also have parlays.",
      "JEET SKELETON: And jeet alerts. I live for those."
    ],
    5: [
      "TERMINAL: System locked. Konami Code activates God Mode/Unlimited Airdrops...",
      "PEPE: ↑ ↑ ↓ ↓ ← → ← → B A. You're welcome.",
      "AUDIO OUTPUT: *SQUEAKY WET FART SOUND*"
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
        soundSynth.speakRentDue(); // Complaint about landlord boyfriend & rent!
      } else if (currentDialogIdx === 1) {
        soundSynth.speakSellIt(); // Wojak Skeleton squeaking screaming "Sell it!"
      } else if (currentDialogIdx === 2) {
        soundSynth.speakBruh(); // Deep "Bruhhh" lament
      }
    }
    // Scene 2 Voices (Chad Bull enters)
    else if (currentScene === 2) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNaw(); // Chad Bull laughing off shitcoins: "Aw Naw!"
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat(); // Sarcastic shocked: "What?!"
      } else if (currentDialogIdx === 2) {
        soundSynth.speakNoRug(); // Deep authoritative "No Rug" affirmation
      }
    }
    // Scene 3 Voices
    else if (currentScene === 3) {
      if (currentDialogIdx === 0) {
        soundSynth.speakBruh();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat();
      } else if (currentDialogIdx === 2) {
        soundSynth.speakGetRekt(); // Skeletal laughter and "Get Rekt, Nerd!"
      } else if (currentDialogIdx === 3) {
        soundSynth.speakNoRug(); // Pepe celebrating gamble life
      }
    }
    // Scene 4 Voices
    else if (currentScene === 4) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNoRug(); // Authoritative voice
      } else if (currentDialogIdx === 1) {
        soundSynth.speakWhat(); // "What?!"
      } else if (currentDialogIdx === 2) {
        soundSynth.speakBruh();  // "Bruh" parlays
      } else if (currentDialogIdx === 3) {
        soundSynth.speakGetRekt(); // Jeet alarms
      }
    }
    // Scene 5 Cheat code
    else if (currentScene === 5) {
      if (currentDialogIdx === 0) {
        soundSynth.speakNaw();
      } else if (currentDialogIdx === 1) {
        soundSynth.speakRentDue();
      } else if (currentDialogIdx === 2) {
        soundSynth.playLaserFart(); // Wet flapping fart sound!
      }
    }
  }, [currentScene, currentDialogIdx]);

  // Handle muting
  const toggleMute = () => {
    const nextMuted = soundSynth.toggleMute();
    setIsMuted(nextMuted);
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
    return true;
  };

  const nextScene = () => {
    if (currentScene < 5) {
      setCurrentScene(prev => prev + 1);
      setCurrentDialogIdx(0);
    } else {
      onSkip(konamiSuccess);
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
        // Stamp resolution
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

    // Check code sequence so far: U U D D L R L R B A
    const sequence = ["U", "U", "D", "D", "L", "R", "L", "R", "B", "A"];
    
    // Ensure we match index
    const matchesSoFar = updated.every((v, i) => v === sequence[i]);

    if (!matchesSoFar) {
      // wrong code, reset
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
    <div className="w-full h-full text-on-surface bg-[#0D0D0A] crt-effect p-4 rounded-lg flex flex-col justify-between border-4 border-mud-brown shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] overflow-hidden relative select-none">
      
      {/* Retro CRT Animated Scrolling Grid Background */}
      <div className="scrolling-grid-overlay" />
      
      {/* TOP HEADER STATUS */}
      <div className="flex justify-between items-center bg-mud-brown border-2 border-sandbag rounded p-2 mb-2 z-10">
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5 text-red-500 animate-pulse" />
          <span className="font-display text-lg tracking-wider text-yellow-500 uppercase">
            SOLANA DEGEN TRENCHES COMMS
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleMute}
            className="p-1 px-2.5 bg-black hover:bg-gray-950 text-yellow-400 rounded border border-sandbag flex items-center gap-1 font-mono text-xs transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-lime-400" />}
            {isMuted ? "Mut" : "Sound"}
          </button>
          <button 
            onClick={() => onSkip(false)}
            className="p-1 px-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 font-display uppercase tracking-widest text-xs rounded transition-colors flex items-center gap-1"
          >
            <SkipForward className="w-3.5 h-3.5" /> Skip Cinematic
          </button>
        </div>
      </div>

      {/* MID PANEL: DRAMATIC MEME CARD RACK */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 z-10">
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
              <div className="bg-mud-brown border-4 border-sandbag rounded-xl p-4 text-center group shadow-2xl relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-red-600 border border-red-400 text-white font-mono text-[9px] px-2 py-0.5 rounded animate-pulse">
                  -99.7% PORTFOLIO
                </div>
                <img 
                  src="https://lh3.googleusercontent.com/aida/ADBb0uiM5lK-nBf0c1q66ZpJCaCN6m70d0hnyn_pfEKI6lvdPRyqUR5TeO198DShzWGV2WUiO5Iq4KF5s0nik1kgSlNq49CPo6K-YmMmw38WsD7o2ZJtjzDBcMHC-YqItR2lFDCjFLhUEglEpolgEQxZRQn1WqfV8eAdbmNN8GnDg6Fw9kkFqsEJf5SSu-RGQniVREDwCxH_v4QxlAmNaNdvgBliFr-cGyd6tNyTLN40IvL1VsfJJacJkAInaNL8" 
                  alt="Pepe Soldier in Trench" 
                  className={`w-48 h-48 mx-auto rounded-lg object-contain border-4 border-red-950 shadow-xl ${tearsWiped < 5 ? 'animate-bounce' : ''}`}
                  referrerPolicy="no-referrer"
                />
                <h3 className="font-display text-2xl text-red-500 mt-2 uppercase">Pepe the Soldier</h3>
                <p className="font-mono text-[10px] text-gray-400 mt-1">Status: Liquidated at the Giga-top</p>

                {/* Progress Mini Game */}
                <div className="mt-3 bg-black/80 p-3 rounded-lg border border-red-600/40">
                  <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider mb-2">
                    🎯 TASK: Wipe Pepe's tears ({tearsWiped}/5 wipes)
                  </div>
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={handleWipeTears}
                      className="px-3 py-1 bg-[#5C3A21] border-b-4 border-[#3A2512] font-mono text-xs text-white uppercase rounded transition-transform active:translate-y-1"
                    >
                      🧻 Wipe Tears
                    </button>
                    <button 
                      onClick={handleCallDev}
                      className="px-3 py-1 bg-red-950 border border-red-600 font-mono text-xs text-red-200 uppercase rounded"
                    >
                      📞 CALL DEV
                    </button>
                  </div>
                  {tearsWiped >= 5 && <div className="text-lime-400 text-[10px] font-bold mt-2 font-mono">✅ PEPE CALMED (TEMPORARILY)</div>}
                </div>
              </div>

              {/* Wojak Skeleton */}
              <div className="bg-mud-brown border-4 border-red-800/60 rounded-xl p-4 text-center group shadow-2xl relative">
                <div className="absolute top-2 left-2 bg-yellow-500 text-black font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                  JEET OVERLORD
                </div>
                <img 
                  src="https://lh3.googleusercontent.com/aida/ADBb0uiXAgOUcvATpMdWdWSSGzskAA9Ti-p7kDczxYcx1gEGeDsIkRRUB90RWy3MW_wWjJqmbQU9L4SAZjTAw6JUkFjDuRMvlLcV69UbzZSkc-wzUoK_mMpfUFLF3v0yLSSbIrqKu_PTznvXsoHT4VIPA6Drzoa_ldB_itxkYf__JUcbDeMkRTx5B13IwYDKwR8cA7L4MY-plLcCoa58wdku0uY1rRdcGHrc7KkM8AdxB-5jE8etet3BaOGGWq2M" 
                  alt="Skeleton Wojak Jeet" 
                  className="w-48 h-48 mx-auto rounded-lg object-contain border-4 border-red-950 shadow-xl"
                  referrerPolicy="no-referrer"
                />
                <h3 className="font-display text-2xl text-red-500 mt-2 uppercase">Wojak Skeleton</h3>
                <p className="font-mono text-[10px] text-gray-400 mt-1">Status: Sitting on Breadline bags</p>

                {/* Funny debug text */}
                <div className="mt-3 bg-black/80 p-2 text-left rounded border border-gray-800 h-16 overflow-y-auto">
                  <div className="font-mono text-[10px] text-gray-500 uppercase leading-none mb-1">Jeet Terminal Logs</div>
                  <div className="font-mono text-[9px] text-red-500 text-center font-bold mt-2">
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
              className="w-full max-w-2xl bg-mud-brown border-4 border-lime-500 rounded-xl p-6 text-center shadow-2xl relative"
            >
              <div className="absolute top-4 right-4 bg-lime-500 text-black font-display text-xs px-3 py-1 font-bold animate-bounce tracking-widest rounded shadow-[0_0_15px_#39FF14]">
                1000x FORCE MULTIPLIER
              </div>

              <img 
                src="https://lh3.googleusercontent.com/aida/ADBb0ujUKSzhuelLHDrKisBhpyvzAiKseJyWQYG7OwAbj9EY6tm8nnkzjx2Z3IgPP31XNHamQYStty2xyHQpeS2WiMIioyPNxiyvA1zy72IBp2YXo-bVVVL2DSKb5Lct15HrCJO9S80H_Oth-cfvyZaK4uze9Fn1dHz9c9lfCgNgWLG8Ls1fPAZobgCf4L0cVit93HgOM4L-1T8wXPJChv1afv1XuPiulJyMZHt8WOLMEX179KYnqgZIi2tvMI_F" 
                alt="Chad Bull Soldier" 
                className={`w-52 h-52 mx-auto rounded-full object-contain border-8 border-lime-400 shadow-[0_0_30px_rgba(57,255,20,0.5)] ${chadPumps > 0 ? 'animate-bounce' : ''}`}
                style={{ transform: `scale(${1 + chadPumps * 0.05})` }}
                referrerPolicy="no-referrer"
              />

              <h2 className="font-display text-4xl text-lime-400 tracking-wider mt-4 uppercase">
                Giga-Chad Bull Descends!
              </h2>
              <p className="font-mono text-xs text-gray-300 max-w-md mx-auto mt-2">
                "You don't buy the coin. You bet on its soul. Leverage up, soldier! We strike the jeets at dawn."
              </p>

              {/* Parachute pumping mini game */}
              <div className="mt-4 bg-black/80 p-3 rounded border border-lime-700 max-w-md mx-auto">
                <div className="text-[10px] font-mono text-lime-400 uppercase font-bold tracking-widest mb-1">
                  🎯 TASK: Pump Chad's Parachute Candle ({chadPumps}/4 pumps)
                </div>
                <button 
                  onClick={handlePumpChad}
                  className="px-6 py-2 bg-lime-500 text-black font-display uppercase font-extrabold text-sm rounded shadow-[0_0_10px_#39FF14] transition-transform active:scale-95 mt-1"
                >
                  🚀 PUMP CROWD FORCE
                </button>
              </div>
            </motion.div>
          )}

          {/* SCENE 3 LAYOUT CC */}
          {currentScene === 3 && (
            <motion.div 
              key="scene3"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl bg-mud-brown border-4 border-sandbag rounded-xl p-5 shadow-2xl relative"
            >
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-sandbag pb-2 mb-2">
                <div>
                  <h2 className="font-display text-3xl text-yellow-500 uppercase tracking-widest">
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

              {/* Arena Map Illustration */}
              <div className="w-full max-w-xl mx-auto mb-4 bg-black/40 border-2 border-sandbag rounded-lg overflow-hidden relative shadow-inner">
                <img 
                  src="https://lh3.googleusercontent.com/aida/ADBb0uictU3g8L_pxV9V0_9hZ_6B9O5R-79-f6Y9pZ6vL2vX" 
                  alt="MOON vs JEET No Man's Land Battlefield"
                  className="w-full h-36 md:h-40 object-cover opacity-85 transition-opacity hover:opacity-100"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 border border-[#39FF14] text-[#39FF14] font-mono text-[8px] uppercase tracking-wider rounded">
                  map: pvp_trenches_countdown.tga
                </div>
              </div>

              {/* Arena Battle field */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 relative">
                
                {/* Moon side */}
                <div className={`p-4 rounded-xl border-2 transition-all text-center ${
                  scene3Choice === "MOON" ? "bg-lime-950/20 border-lime-400" : "bg-black/40 border-gray-800"
                }`}>
                  <h3 className="font-display text-xl text-lime-400 flex items-center justify-center gap-2 uppercase">
                    MOON SIDE (BULLS)
                  </h3>
                  <div className="text-gray-400 text-md font-mono my-3 font-bold">Pot: 4.88 SOL</div>
                  <button 
                    onClick={() => startPredictionBattle("MOON")}
                    disabled={scene3Ticking || scatFired}
                    className="w-full py-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-black font-display font-extrabold text-sm uppercase rounded transition-all"
                  >
                    🚀 BET MOON 0.05 SOL
                  </button>
                </div>

                {/* Jeet side */}
                <div className={`p-4 rounded-xl border-2 transition-all text-center ${
                  scene3Choice === "JEET" ? "bg-red-950/20 border-red-500" : "bg-black/40 border-gray-800"
                }`}>
                  <h3 className="font-display text-xl text-red-500 flex items-center justify-center gap-2 uppercase">
                    JEET SIDE (BEARS)
                  </h3>
                  <div className="text-gray-400 text-md font-mono my-3 font-bold">Pot: 14.50 SOL</div>
                  <button 
                    onClick={() => startPredictionBattle("JEET")}
                    disabled={scene3Ticking || scatFired}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-display font-extrabold text-sm uppercase rounded transition-all"
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
                      <h1 className="font-display text-5xl text-white font-extrabold tracking-widest uppercase">
                        JEET WINS Stamp!
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
                  <div className="text-[11px] font-mono text-yellow-400 italic">
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

          {/* SCENE 4 LAYOUT CC */}
          {currentScene === 4 && (
            <motion.div 
              key="scene4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl bg-mud-brown border-4 border-yellow-500 rounded-xl p-5 text-center shadow-2xl relative"
            >
              {/* Explosion effect container */}
              {scatConfetti && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
                  {/* Fecal fireworks mock dots */}
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

              <img 
                src="https://lh3.googleusercontent.com/aida/ADBb0uiW2SvDxYpVSv0cQNEYFR6BiAC2wOC4bGAST1WMLVPLCMMjn4Z_YOyIC2i79CvRMDsLZL-JjakgRQmp8dgDCdNhYZxvIh4NVFETD4f9WPiER0wgh-AUIpLbPnyesmkfLDO7gh4WjBCaaAAd8_uTtbS4WOq3yja01JLR3c63IbZ4vrn4VK455avJefnZcLeAXTWzyGAITpeobkU_7LdcFHnQqQtKxOGGoDxh8GBfYEaxFi32DnEDkPD_QDb7"
                alt="Shitmarket Logo Mascot"
                className="w-40 h-40 mx-auto rounded-lg object-contain border-4 border-yellow-500 shadow-2xl animate-pulse"
                referrerPolicy="no-referrer"
              />

              <h1 className="font-display text-4xl text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-yellow-400 to-red-600 mt-2 uppercase tracking-tighter">
                SHITMARKET.LOL
              </h1>
              <p className="font-mono text-xs text-gray-300 max-w-lg mx-auto mt-2 leading-relaxed">
                "Pick a side. Bet the trenches. The only rug here is the one you sleep on after losing it all to the Wojak skeleton."
              </p>

              {/* Progress clicker */}
              <div className="mt-4 max-w-md mx-auto">
                <button 
                  onClick={() => {
                    setScatConfetti(true);
                    soundSynth.playExplosion();
                  }}
                  className="px-6 py-2.5 bg-yellow-400 text-black font-display font-extrabold text-md rounded tracking-wider uppercase shadow-[0_4px_0_#9A7d00] transition-colors hover:bg-yellow-500"
                >
                  💩 BLAST POOH FIREWORKS!
                </button>
                {scatConfetti && (
                  <div className="font-mono text-lime-400 text-[10px] font-bold mt-2 animate-pulse">
                    🟢 Platform ready. 2% system fees locked. Parlay engine calibrated.
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
              <div className="mt-6 flex flex-col items-center gap-3">
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
                    className="w-12 h-12 bg-red-600 active:bg-red-400 border-2 border-red-500 rounded-full font-display font-extrabold text-white text-lg flex items-center justify-center shadow-lg"
                  >
                    B
                  </button>
                  <button 
                    onClick={() => handleKonamiTap("A")}
                    className="w-12 h-12 bg-red-600 active:bg-red-400 border-2 border-red-500 rounded-full font-display font-extrabold text-white text-lg flex items-center justify-center shadow-lg"
                  >
                    A
                  </button>
                </div>
              </div>

              <div className="mt-4 font-mono text-[10px] text-gray-400 italic">
                Secret Combination: Up Up Down Down Left Right Left Right B A
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* BOTTOM CONTROL SUBTITLE BOX */}
      <div className="bg-mud-brown border-2 border-sandbag rounded-xl p-4 flex flex-col md:flex-row justify-between items-center z-10 select-none gap-4">
        
        {/* Story progress visual indicator dots */}
        <div className="flex items-center gap-1.5 md:self-center">
          {[1, 2, 3, 4, 5].map((idx) => (
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
        <div className="flex-1 max-w-2xl bg-black/90 px-4 py-3 rounded-lg border border-sandbag text-left flex flex-col justify-between min-h-[70px]">
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
          className="px-6 py-3.5 bg-lime-500 hover:bg-lime-400 text-black font-display font-black text-lg tracking-wider uppercase rounded-md shadow-[0_4px_0_#107100] border border-lime-300 transition-all flex items-center gap-1.5 active:translate-y-1 active:shadow-none min-w-[130px]"
        >
          {currentDialogIdx === (sceneDialogs[currentScene]?.length || 1) - 1 ? (
            isSceneChallengeSatisfied() ? "Deploy 🚀" : "Solve Duty 🎯"
          ) : (
            <>Read Next <ArrowRight className="w-5 h-5 text-black animate-pulse" /></>
          )}
        </button>
      </div>

    </div>
  );
}
