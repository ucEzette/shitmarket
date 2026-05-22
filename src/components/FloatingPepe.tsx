'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelPepe } from './PixelArt';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { MessageSquare, ShieldAlert, Sparkles, X } from 'lucide-react';

const PEPE_QUOTES = [
  'Few understand.',
  'Jeets gonna jeet, Chads gonna moon.',
  'This is 100% financial advice.',
  'Stake the ammo, soldier!',
  'Rugs are for living rooms, not prediction markets.',
  'Are you buying the top or charging the trench?',
  'I survived the great dev dump of 2024.',
  'HODL? No, we BET and settled in 5 mins!',
  'Pot fee is only 2%. Easiest PvP in crypto.',
  'If you get rekt, don\'t call your mom. Cry in the Jeet chat.'
];

export const FloatingPepe: React.FC = () => {
  const [quote, setQuote] = useState(PEPE_QUOTES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const [moraleBoost, setMoraleBoost] = useState<string | null>(null);

  // Rotate quotes randomly on hover or click
  const triggerNewQuote = () => {
    const randomIndex = Math.floor(Math.random() * PEPE_QUOTES.length);
    setQuote(PEPE_QUOTES[randomIndex]);
    setShowBubble(true);
  };

  useEffect(() => {
    // Show Pepe speech bubble on start for a brief moment
    const timer = setTimeout(() => {
      setShowBubble(true);
    }, 2000);

    // Hide speech bubble after 6 seconds
    const hideTimer = setTimeout(() => {
      setShowBubble(false);
    }, 8000);

    // Morale Boost interval: pop up a big Pepe announcement every 3 minutes (simulated here as random interval)
    const moraleInterval = setInterval(() => {
      if (Math.random() < 0.4) {
        const boosts = [
          'MORALE BOOST: Chad Bull Army has just captured Trench Sector 4!',
          'TRENCH NOTE: Liquidations are cascading in room $WIFEY, watch the timer!',
          'OFFICER PEPE DECREES: High-stakes battles yield high-stakes booty!',
          'DEGEN SIGNAL: Jeet Skeletons are retreating. PUMP THE MOON POOL!'
        ];
        setMoraleBoost(boosts[Math.floor(Math.random() * boosts.length)]);
      }
    }, 120000); // Check every 2 minutes

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
      clearInterval(moraleInterval);
    };
  }, []);

  return (
    <>
      {/* Floating Pepe in bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-none select-none">
        
        {/* Animated Speech Bubble */}
        <AnimatePresence>
          {showBubble && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ type: 'spring', damping: 15 }}
              className="pointer-events-auto max-w-[200px] mb-2 mr-2 bg-trench-mud border-2 border-trench-sandbag p-3 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.6)] relative"
            >
              {/* Triangular indicator pointing down to Pepe */}
              <div className="absolute bottom-[-10px] right-8 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-trench-sandbag" />
              <div className="absolute bottom-[-7px] right-[33px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[8px] border-t-trench-mud" />
              
              <p className="font-marker text-xs text-moon-gold leading-relaxed tracking-wider">
                "{quote}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pepe Figure itself */}
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          onMouseEnter={triggerNewQuote}
          onClick={triggerNewQuote}
          className="pointer-events-auto cursor-pointer relative group flex flex-col items-center"
        >
          {/* Neon green hover halo */}
          <div className="absolute inset-0 bg-neon-moon/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <img 
            alt="Pepe the Frog soldier wearing World War W1 style helmet" 
            className="w-16 h-auto drop-shadow-2xl relative z-10 transition-transform group-hover:scale-110 active:scale-95 duration-200"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsWwK2SBrXTIIfc5KtE3uOQu9s2PkWW374d3P4w4QP8LmCbPQF53N4A3x496zhiGG8vjZdzlt7yiEOSru3TjQeVjO2es12ENzozQqXA77KwjE9V1LouFOzgUSHjrVLRk2yC8hVezBQaDeRz-sN2YDZPhwW5klQMaqbjGAj9UQvWl7u818g_fnc7USO6aYlig9voLjL0EJDM1VCOF4Iodg4J66lmkfPiB7UoRG6tXI11XWkNlPOz_PIS4Er2-AqFro6ZPgQ3ZbJKB7W"
          />
          
          {/* Badge over Pepe */}
          <span className="absolute -top-1 -left-1 bg-neon-moon text-black font-staatliches text-[8px] px-1 rounded-sm border border-black z-20 group-hover:rotate-6 transition-transform font-bold">
            HQ MORALE
          </span>
        </motion.div>
      </div>

      {/* Morale Boost Tactical Announcement Notification (Side-floating instead of screen blocking) */}
      <AnimatePresence>
        {moraleBoost && (
          <div className="fixed top-20 right-4 z-50 w-full max-w-sm pointer-events-none p-2">
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
              className="pointer-events-auto bg-trench-mud border-4 border-trench-sandbag p-4 rounded-lg shadow-glow-moon relative scanlines"
            >
              <button
                onClick={() => setMoraleBoost(null)}
                className="absolute top-2.5 right-2.5 text-trench-gasmask hover:text-white"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3.5 mb-3 border-b border-trench-sandbag/40 pb-2">
                <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={42} glowColor="moon" animated className="rounded" />
                <div>
                  <h3 className="font-staatliches text-lg text-neon-moon tracking-wider leading-none glow-moon uppercase">
                    OFFICER PEPE DIALED IN!
                  </h3>
                  <span className="font-mono text-[8px] text-trench-gasmask font-bold uppercase mt-0.5 block">
                    TACTICAL HQ BROADCAST
                  </span>
                </div>
              </div>

              <div className="bg-trench-black border-2 border-trench-sandbag p-3 rounded mb-3 shadow-inner">
                <p className="font-mono text-[11px] text-white font-bold leading-normal uppercase">
                  "{moraleBoost}"
                </p>
              </div>

              <button
                onClick={() => setMoraleBoost(null)}
                className="w-full py-2 bg-neon-moon hover:bg-green-500 font-staatliches text-sm text-black rounded font-bold shadow-[0_0_10px_#39FF14] transition-all uppercase tracking-widest active:translate-y-0.5"
              >
                CHARGE THE FRONT!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
