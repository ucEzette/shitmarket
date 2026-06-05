'use client';

import React from 'react';

interface Coin {
  id: number;
  symbol: string;
  emoji?: string;
  className: string;
  size: number;
  top: string;
  left: string;
  speedClass: string;
  opacity: number;
  blur?: string;
}

const COIN_TYPES = [
  { symbol: 'SOL', color: 'from-purple-500 via-indigo-500 to-emerald-400', emoji: '◎' },
  { symbol: 'BTC', color: 'from-amber-400 to-amber-600', emoji: '₿' },
  { symbol: 'PEPE', color: 'from-green-400 to-emerald-600', emoji: '🐸' },
  { symbol: 'WOJAK', color: 'from-blue-400 to-indigo-600', emoji: '💀' },
  { symbol: 'DOGE', color: 'from-yellow-400 to-amber-500', emoji: '🐕' },
  { symbol: 'BONK', color: 'from-orange-400 to-red-500', emoji: '🦴' },
];

export const FloatingCoins: React.FC = () => {
  const [coins, setCoins] = React.useState<Coin[]>([]);

  React.useEffect(() => {
    // Generate coins dynamically on client side to avoid hydration mismatch
    const generated: Coin[] = Array.from({ length: 18 }).map((_, i) => {
      const type = COIN_TYPES[i % COIN_TYPES.length];
      const size = Math.floor(Math.random() * 20) + 24; // 24px to 44px
      const isSlow = i % 3 === 0;
      const isMedium = i % 3 === 1;
      const speedClass = isSlow ? 'animate-coin-slow' : isMedium ? 'animate-coin-medium' : 'animate-coin-fast';
      const opacity = Math.random() * 0.35 + 0.15; // 0.15 to 0.50 opacity for clean subtlety
      const blur = i % 4 === 0 ? 'blur-[1px]' : i % 5 === 0 ? 'blur-[2px]' : ''; // depth of field blur

      return {
        id: i,
        symbol: type.symbol,
        emoji: type.emoji,
        className: `bg-gradient-to-br ${type.color}`,
        size,
        top: `${Math.random() * 80 + 10}%`,
        left: `${Math.random() * 90 + 5}%`,
        speedClass,
        opacity,
        blur,
      };
    });
    setCoins(generated);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className={`absolute flex items-center justify-center rounded-full text-black font-extrabold shadow-lg select-none ${coin.className} ${coin.speedClass} ${coin.blur}`}
          style={{
            width: coin.size,
            height: coin.size,
            top: coin.top,
            left: coin.left,
            opacity: coin.opacity,
            fontSize: coin.size * 0.45,
            lineHeight: 1,
            transformOrigin: 'center',
          }}
        >
          <span className="drop-shadow-md">{coin.emoji}</span>
        </div>
      ))}
    </div>
  );
};
