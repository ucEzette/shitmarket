'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ========== PEPE ASSET MAP ==========
export const PEPE_ASSETS = {
  fewUnderstand: '/pepes/pepe-few-understand.png',
  moonJuice: '/pepes/moon-juice-trench.png',
  chadBull: '/pepes/chad-bull-general.png',
  cryptoBunker: '/pepes/crypto-bunker.png',
  apeGeneral: '/pepes/ape-general.png',
  battlefield: '/pepes/meme-trench-battlefield.png',
  neonWojak: '/pepes/neon-wojak.png',
  diamondHands: '/pepes/diamond-hands-ape.png',
  jeetSkeleton: '/pepes/jeet-skeleton.png',
  logoMain: '/pepes/logo-main.png',
  logoAlt: '/pepes/screen 2.png',
  logoHeader: '/pepes/logo-header.png',
} as const;

export const ALL_PEPES = Object.values(PEPE_ASSETS);

// ─── Media card images for the share card canvas ───────────────────────────
// Moon: bullish / diamond-hands imagery
export const MOON_PEPES = [
  '/pepes/mediacards/moon/ape-general.png',
  '/pepes/mediacards/moon/chad-bull-general.png',
  '/pepes/mediacards/moon/chadbull.png',
  '/pepes/mediacards/moon/diamond-hands-ape.png',
  '/pepes/mediacards/moon/meme-trench-battlefield.png',
  '/pepes/mediacards/moon/moonvsjeet.png',
  '/pepes/mediacards/moon/screen%20copy.png',
  '/pepes/mediacards/moon/screen%20copy%202.png',
  '/pepes/mediacards/moon/screen%20copy%204.png',
  '/pepes/mediacards/moon/screen%20copy%2012.png',
  '/pepes/mediacards/moon/screen%20copy%2013.png',
  '/pepes/mediacards/moon/screen%20copy%2014.png',
  '/pepes/mediacards/moon/screen%20copy%2015.png',
  '/pepes/mediacards/moon/screen.png',
  '/pepes/mediacards/moon/moon-juice-trench.png_202606070042.jpeg',
  '/pepes/mediacards/moon/Create_a_looping_animated_GIF_202606070035%20(1).jpeg',
];

// Jeet: bearish / skeleton / rugpull imagery
export const JEET_PEPES = [
  '/pepes/mediacards/jeet/pepe.png',
  '/pepes/mediacards/jeet/skeletonwojak.png',
  '/pepes/mediacards/jeet/screen%206.png',
  '/pepes/mediacards/jeet/screen%20copy%203.png',
  '/pepes/mediacards/jeet/screen%20copy%205.png',
  '/pepes/mediacards/jeet/screen%20copy%206.png',
  '/pepes/mediacards/jeet/screen%20copy%207.png',
  '/pepes/mediacards/jeet/screen%20copy%208.png',
  '/pepes/mediacards/jeet/screen%20copy%209.png',
  '/pepes/mediacards/jeet/screen%20copy%2010.png',
  '/pepes/mediacards/jeet/screen%20copy%2011.png',
  '/pepes/mediacards/jeet/jeet-skeleton.png_202606070041.jpeg',
];
export const SCENE_PEPES = [PEPE_ASSETS.moonJuice, PEPE_ASSETS.cryptoBunker, PEPE_ASSETS.battlefield];

// ========== DEGEN QUOTE LIBRARY ==========
export const DEGEN_QUOTES = [
  { text: "FEW UNDERSTAND.", author: "Trench General Pepe", mood: 'neutral' },
  { text: "WAGMI OR NAGMI, THERE IS NO IN BETWEEN.", author: "Chad Bull Commander", mood: 'moon' },
  { text: "JEETS GET THE ROPE. HODLERS GET THE GOLD.", author: "Diamond Hands Ape", mood: 'moon' },
  { text: "SER, THIS IS A CASINO.", author: "Anon Degen #4269", mood: 'neutral' },
  { text: "THE TRENCHES DON'T CARE ABOUT YOUR FEELINGS.", author: "Skeleton Reaper", mood: 'jeet' },
  { text: "IN DEGEN WE TRUST.", author: "Ape General Harambe", mood: 'moon' },
  { text: "RUGGED? SOUNDS LIKE SKILL ISSUE.", author: "Wojak The Sad", mood: 'jeet' },
  { text: "APE IN FIRST, ASK QUESTIONS NEVER.", author: "0xDegenChad", mood: 'moon' },
  { text: "EVERY EXIT IS SOMEONE ELSE'S ENTRY.", author: "Jeet Sniper Pro", mood: 'jeet' },
  { text: "NOT YOUR KEYS, NOT YOUR MOON.", author: "Commander HODL", mood: 'moon' },
  { text: "PRICE IS WHAT YOU PAY, VALUE IS WHAT YOU MEME.", author: "Warren Buffrog", mood: 'neutral' },
  { text: "THE CHART IS JUST A SUGGESTION.", author: "Ramen Deity", mood: 'jeet' },
  { text: "BEARS MAKE MONEY, BULLS MAKE MONEY, PIGS GET RUGGED.", author: "Trench Economist", mood: 'neutral' },
  { text: "WHEN IN DOUBT, ZOOM OUT. THEN APE IN.", author: "Giga Chad Premium", mood: 'moon' },
  { text: "THIS IS THE WAY.", author: "Mandalorian Degen", mood: 'moon' },
  { text: "MOON OR RAMEN, THERE IS NO MIDDLE CLASS.", author: "Anon Soldier", mood: 'neutral' },
  { text: "DEV DID RUG, BUT THE MEME LIVES ON.", author: "Ghost of Rugpullia", mood: 'jeet' },
  { text: "1 SOL = 1 SOL. EVERYTHING ELSE IS NOISE.", author: "Zen Degen", mood: 'neutral' },
  { text: "DEV IN DUBAI WITH COCKTAILS. USER RUGGED.", author: "Ghost Dev in Dubai", mood: 'jeet' },
  { text: "JEET REAPER IS SWEEPING; YOUR SLIPPAGE IS NOT HIGH ENOUGH.", author: "Slippage Sovereign", mood: 'jeet' },
  { text: "MY WIFE LEFT ME FOR A SOLANA VALIDATOR NODE.", author: "Staking Martyr Anon", mood: 'jeet' },
  { text: "APE IN WITH THE RENT MONEY, THE LANDLORD IS IN GIGA CHAD SQUAD ANYWAY.", author: "Evicted Degen", mood: 'moon' },
  { text: "I HAVEN'T SLEPT SINCE 2024. THE 5-MINUTE CANDLES GO FAST.", author: "Candle Whisperer", mood: 'neutral' },
  { text: "SQUEAKY WET FARTS SOUND HIGHER QUALITY THAN DEV'S PROMISES.", author: "Farting Telemetry Operator", mood: 'jeet' },
  { text: "GIGA CHAD NEVER SELLS. GIGA CHAD HODLS MOCK CREDITS TO THE GRAVE.", author: "Konami Controller", mood: 'moon' },
] as const;

export const getRandomQuote = () => DEGEN_QUOTES[Math.floor(Math.random() * DEGEN_QUOTES.length)];
export const getRandomPepe = () => ALL_PEPES[Math.floor(Math.random() * ALL_PEPES.length)];
export const getRandomMoonPepe = () => MOON_PEPES[Math.floor(Math.random() * MOON_PEPES.length)];
export const getRandomJeetPepe = () => JEET_PEPES[Math.floor(Math.random() * JEET_PEPES.length)];

// ========== MEME REACTION EMOJIS ==========
export const MEME_REACTIONS = ['🚀', '💀', '🐸', '🔥', '💎', '🦧', '📈', '📉', '🎯', '⚔️', '💣', '🏆'] as const;

// ========== COMPONENTS ==========

/** Pixel art image with glow border and hover effects */
export const PepePortrait: React.FC<{
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  glowColor?: 'moon' | 'jeet' | 'gold' | 'none';
  animated?: boolean;
  loading?: 'lazy' | 'eager';
}> = ({ src, alt = 'Trench Pepe', size, className = '', glowColor = 'none', animated = false, loading = 'lazy' }) => {
  const glowClasses = {
    moon: 'border-neon-moon shadow-glow-moon',
    jeet: 'border-jeet-red shadow-glow-jeet',
    gold: 'border-moon-gold shadow-glow-gold',
    none: 'border-trench-sandbag',
  };

  const hasWidth = className.includes('w-') || className.includes('max-w-');
  const finalSize = size || (hasWidth ? undefined : 80);

  return (
    <div
      className={`relative overflow-hidden border-2 ${glowClasses[glowColor]} ${animated ? 'hover:scale-110 transition-transform duration-300' : ''} ${className}`}
      style={finalSize ? { width: finalSize, height: finalSize } : undefined}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ imageRendering: 'auto' }}
        draggable={false}
        loading={loading}
        decoding={loading === 'eager' ? 'sync' : 'async'}
      />
      {/* Scanline overlay for pixel crunchiness */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none" />
    </div>
  );
};

/** Rotating degen quote banner with meme art */
export const DegenQuoteBanner: React.FC<{ interval?: number; className?: string }> = ({ interval = 8000, className = '' }) => {
  const [currentQuote, setCurrentQuote] = useState<typeof DEGEN_QUOTES[number]>(DEGEN_QUOTES[0]);
  const [currentPepe, setCurrentPepe] = useState<string>(ALL_PEPES[0]);

  useEffect(() => {
    // Set random quote and pepe on mount to avoid hydration mismatch
    setCurrentQuote(getRandomQuote());
    setCurrentPepe(getRandomPepe());

    const timer = setInterval(() => {
      setCurrentQuote(getRandomQuote());
      setCurrentPepe(getRandomPepe());
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  const moodColor = currentQuote.mood === 'moon' ? 'text-neon-moon' : currentQuote.mood === 'jeet' ? 'text-jeet-red' : 'text-moon-gold';

  return (
    <div className={`glass-panel rounded-xl p-4 flex items-center gap-4 shadow-lg ${className}`}>
      <PepePortrait src={currentPepe} size={56} glowColor={currentQuote.mood === 'moon' ? 'moon' : currentQuote.mood === 'jeet' ? 'jeet' : 'gold'} className="rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`font-marker text-sm ${moodColor} tracking-wider uppercase leading-tight`}>
          &ldquo;{currentQuote.text}&rdquo;
        </p>
        <p className="font-mono text-[9px] text-trench-gasmask mt-1 uppercase font-bold">
          — {currentQuote.author}
        </p>
      </div>
    </div>
  );
};

/** Random meme pop-up that floats in from a side, stays briefly, then leaves */
export const MemePopup: React.FC<{ triggerInterval?: number }> = ({ triggerInterval = 25000 }) => {
  const [popup, setPopup] = useState<{ quote: typeof DEGEN_QUOTES[number]; pepe: string; side: 'left' | 'right' } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      // Only pop up 40% of the time for surprise factor
      if (Math.random() < 0.4) {
        setPopup({
          quote: getRandomQuote(),
          pepe: getRandomPepe(),
          side: Math.random() > 0.5 ? 'left' : 'right',
        });

        // Auto-dismiss after 5 seconds
        setTimeout(() => setPopup(null), 5000);
      }
    }, triggerInterval);
    return () => clearInterval(timer);
  }, [triggerInterval]);

  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          initial={{ x: popup.side === 'left' ? -300 : 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: popup.side === 'left' ? -300 : 300, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className={`fixed bottom-24 lg:bottom-8 ${popup.side === 'left' ? 'left-4' : 'right-4'} z-40 max-w-xs`}
        >
          <div
            className="glass-panel border border-moon-gold rounded-2xl p-4 shadow-glow-gold cursor-pointer group"
            onClick={() => setPopup(null)}
          >
            <div className="flex items-center gap-3">
              <PepePortrait src={popup.pepe} size={48} glowColor="gold" className="rounded-lg shrink-0" />
              <div>
                <p className="font-marker text-xs text-moon-gold uppercase leading-tight">
                  &ldquo;{popup.quote.text}&rdquo;
                </p>
                <p className="font-mono text-[8px] text-trench-gasmask mt-1 uppercase font-bold">
                  — {popup.quote.author}
                </p>
              </div>
            </div>
            <div className="mt-1 text-center font-mono text-[7px] text-trench-gasmask/50 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
              CLICK TO DISMISS
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** War propaganda poster / meme art tile with caption */
export const WarPropaganda: React.FC<{
  src: string;
  caption: string;
  subcaption?: string;
  glowColor?: 'moon' | 'jeet' | 'gold';
  className?: string;
}> = ({ src, caption, subcaption, glowColor = 'moon', className = '' }) => {
  const borderColors = {
    moon: 'border-neon-moon/40 hover:border-neon-moon hover:shadow-glow-moon',
    jeet: 'border-jeet-red/40 hover:border-jeet-red hover:shadow-glow-jeet',
    gold: 'border-moon-gold/40 hover:border-moon-gold hover:shadow-glow-gold',
  };

  return (
    <div className={`glass-panel border-t border-white/10 rounded-2xl overflow-hidden transition-all duration-300 group shadow-lg hover:shadow-2xl ${className}`}>
      <div className="relative overflow-hidden">
        <img
          src={src}
          alt={caption}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-700"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1016] via-transparent to-transparent" />
      </div>
      <div className="p-4 relative z-10 bg-[#0F1016]/80 backdrop-blur-sm">
        <p className={`font-staatliches text-xl text-white tracking-wider uppercase leading-tight ${
          glowColor === 'moon' ? 'group-hover:text-neon-moon group-hover:shadow-glow-moon' : 
          glowColor === 'jeet' ? 'group-hover:text-jeet-red group-hover:shadow-glow-jeet' : 
          'group-hover:text-moon-gold group-hover:shadow-glow-gold'
        } transition-all duration-300`}>{caption}</p>
        {subcaption && (
          <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold mt-1.5">{subcaption}</p>
        )}
      </div>
    </div>
  );
};

/** Meme mascot row — a lineup of character portraits */
export const MascotRow: React.FC<{ className?: string }> = ({ className = '' }) => {
  const mascots = [
    { src: PEPE_ASSETS.chadBull, label: 'CHAD BULL', role: 'Moon General' },
    { src: PEPE_ASSETS.fewUnderstand, label: 'TRENCH PEPE', role: 'Mascot' },
    { src: PEPE_ASSETS.apeGeneral, label: 'APE GENERAL', role: 'War Commander' },
    { src: PEPE_ASSETS.diamondHands, label: 'DIAMOND APE', role: 'HODL Soldier' },
    { src: PEPE_ASSETS.jeetSkeleton, label: 'SKELETON', role: 'Jeet Reaper' },
    { src: PEPE_ASSETS.neonWojak, label: 'NEON WOJAK', role: 'Night Watch' },
  ];

  return (
    <div className={`flex gap-4 overflow-x-auto pb-2 scrollbar-hide ${className}`}>
      {mascots.map((m, i) => (
        <motion.div
          key={i}
          whileHover={{ y: -8, scale: 1.05 }}
          className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
        >
          <PepePortrait
            src={m.src}
            size={72}
            glowColor={i < 4 ? 'moon' : 'jeet'}
            animated
            className="rounded-full"
          />
          <span className="font-staatliches text-xs text-white tracking-wider uppercase whitespace-nowrap group-hover:text-neon-moon transition-colors">
            {m.label}
          </span>
          <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold -mt-1.5">
            {m.role}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

/** Achievement unlock toast with pixel pepe */
export const MemeToast: React.FC<{
  message: string;
  pepe?: string;
  type?: 'moon' | 'jeet' | 'gold';
  visible: boolean;
  onDismiss: () => void;
}> = ({ message, pepe, type = 'gold', visible, onDismiss }) => {
  const colors = {
    moon: 'border-neon-moon bg-neon-moon/10 text-neon-moon',
    jeet: 'border-jeet-red bg-jeet-red/10 text-jeet-red',
    gold: 'border-moon-gold bg-moon-gold/10 text-moon-gold',
  };

  useEffect(() => {
    if (visible) {
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 border-2 ${colors[type]} rounded-lg px-4 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-sm`}
        >
          {pepe && <PepePortrait src={pepe} size={36} className="rounded" />}
          <span className="font-staatliches text-base tracking-wider uppercase">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
