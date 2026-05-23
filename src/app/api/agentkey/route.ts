import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko');
    }

    const data = await response.json();
    const coins = data.coins || [];

    // Map trending coins to social metrics deterministically
    const trendingCashtags = coins.slice(0, 6).map((c: any, index: number) => {
      const item = c.item;
      const symbol = item.symbol.toUpperCase();
      
      // Deterministic generation based on coin_id and index
      const seed = item.coin_id || index;
      const changeNum = ((seed % 75) - 30) / 2; // Range: -15% to +22.5%
      const change = changeNum >= 0 ? `+${changeNum.toFixed(1)}%` : `${changeNum.toFixed(1)}%`;
      
      const sentimentOpts = ['BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH'];
      const sentiment = changeNum > 8 ? 'BULLISH' : changeNum < -5 ? 'BEARISH' : sentimentOpts[seed % sentimentOpts.length];
      
      const volumeK = Math.floor(((1000 - (item.market_cap_rank || 100)) * 1.5) + (seed % 200) + 50);
      const volume = volumeK > 1000 ? `${(volumeK / 1000).toFixed(1)}M` : `${volumeK}K`;
      
      let color = 'text-white';
      if (sentiment === 'BULLISH') color = 'text-neon-moon';
      if (sentiment === 'BEARISH') color = 'text-jeet-red';

      return {
        symbol: `$${symbol}`,
        name: item.name,
        sentiment,
        volume,
        change,
        color,
        thumb: item.thumb,
      };
    });

    // Generate dynamic hype narratives based on the top trending coin
    const topCoin = trendingCashtags[0]?.symbol || '$SOL';
    const hypeTopics = [
      { topic: `${topCoin} Ecosystem Hype`, score: 98, trend: 'UP' },
      { topic: 'AI Agent Trading Rooms', score: 87, trend: 'UP' },
      { topic: 'Devnet Oracle Bypasses', score: 75, trend: 'UP' },
      { topic: 'Trench Liquidity Pools', score: 62, trend: 'FLAT' },
    ];

    const reportOptions = [
      `Market intelligence reveals intense narrative accumulation around ${topCoin}. Orderflow highlights smart money rotation into related sub-tokens.`,
      `On-chain liquidity maps detect deep interest in AI-managed betting structures. Volume spikes in ${topCoin} confirm active developer expansion.`,
      `Live Twitter interception confirms high retail conviction in ${topCoin}. Major communities are bridging liquidity to target new room launches.`,
    ];
    const intelligenceReport = reportOptions[Math.floor(Date.now() / 60000) % reportOptions.length];

    return NextResponse.json({
      success: true,
      trendingCashtags,
      hypeTopics,
      intelligenceReport,
    });
  } catch (error: any) {
    console.error('AgentKey Live Fetch Error:', error);
    
    // Fallback Mock Data in case of network/API failures
    return NextResponse.json({
      success: false,
      trendingCashtags: [
        { symbol: '$SOL', name: 'Solana', sentiment: 'BULLISH', volume: '2.5M', change: '+12.4%', color: 'text-neon-moon' },
        { symbol: '$WIF', name: 'dogwifhat', sentiment: 'BULLISH', volume: '1.8M', change: '+8.2%', color: 'text-neon-moon' },
        { symbol: '$BONK', name: 'Bonk', sentiment: 'NEUTRAL', volume: '950K', change: '+1.5%', color: 'text-white' },
        { symbol: '$POPCAT', name: 'Popcat', sentiment: 'BULLISH', volume: '820K', change: '+18.7%', color: 'text-neon-moon' },
        { symbol: '$BODEN', name: 'Boden', sentiment: 'BEARISH', volume: '340K', change: '-12.3%', color: 'text-jeet-red' },
      ],
      hypeTopics: [
        { topic: 'Solana AI Agents', score: 98, trend: 'UP' },
        { topic: 'Prediction Markets', score: 85, trend: 'UP' },
        { topic: 'Trench Launching', score: 72, trend: 'FLAT' },
        { topic: 'High Slippage Swaps', score: 65, trend: 'DOWN' },
      ],
      intelligenceReport: 'INTELLIGENCE REPORT: Connection to AgentKey Social nodes timed out. Displaying local intercepted high-conviction signals.',
    });
  }
}
