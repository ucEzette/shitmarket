'use client';

import React from 'react';

interface Coin {
  id: number;
  symbol: string;
  image: string;
  size: number;
  top: string;
  left: string;
  speedClass: string;
  opacity: number;
  blur?: string;
}

const COIN_TYPES = [
  { symbol: 'PEPE', image: '/pepes/token-pepe.png' },
  { symbol: 'WIF', image: '/pepes/token-wif.png' },
  { symbol: 'WOJAK', image: '/pepes/token-wojak.png' },
  { symbol: 'PUMP', image: '/pepes/token-pump.png' },
  { symbol: 'TROLL', image: '/pepes/token-troll.png' },
];

export const FloatingCoins: React.FC = () => {
  const [coins, setCoins] = React.useState<Coin[]>([]);

  React.useEffect(() => {
    // Generate coins dynamically on client side to avoid hydration mismatch
    const generated: Coin[] = Array.from({ length: 18 }).map((_, i) => {
      const type = COIN_TYPES[i % COIN_TYPES.length];
      const size = Math.floor(Math.random() * 24) + 24; // 24px to 48px
      const isSlow = i % 3 === 0;
      const isMedium = i % 3 === 1;
      const speedClass = isSlow ? 'animate-coin-slow' : isMedium ? 'animate-coin-medium' : 'animate-coin-fast';
      const opacity = Math.random() * 0.35 + 0.2; // 0.20 to 0.55 opacity for clean visibility
      const blur = i % 4 === 0 ? 'blur-[1px]' : i % 5 === 0 ? 'blur-[2px]' : ''; // depth of field blur

      return {
        id: i,
        symbol: type.symbol,
        image: type.image,
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
          className={`absolute rounded-full overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)] select-none ${coin.speedClass} ${coin.blur}`}
          style={{
            width: coin.size,
            height: coin.size,
            top: coin.top,
            left: coin.left,
            opacity: coin.opacity,
            transformOrigin: 'center',
          }}
        >
          <img
            src={coin.image}
            alt={coin.symbol}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
};

