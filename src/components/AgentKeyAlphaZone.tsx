'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, TrendingUp, Activity, Zap, RefreshCw, Key, MessageSquare } from 'lucide-react';

interface TrendingCashtag {
  symbol: string;
  name: string;
  sentiment: string;
  volume: string;
  change: string;
  color: string;
  thumb?: string;
}

interface HypeTopic {
  topic: string;
  score: number;
  trend: string;
}

export function AgentKeyAlphaZone() {
  const [isScanning, setIsScanning] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [trendingCashtags, setTrendingCashtags] = useState<TrendingCashtag[]>([]);
  const [hypeTopics, setHypeTopics] = useState<HypeTopic[]>([]);
  const [intelligenceReport, setIntelligenceReport] = useState<string>('');

  const fetchAlphaData = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/agentkey');
      const data = await response.json();
      if (data) {
        setTrendingCashtags(data.trendingCashtags || []);
        setHypeTopics(data.hypeTopics || []);
        setIntelligenceReport(data.intelligenceReport || '');
      }
    } catch (error) {
      console.error('Error fetching AgentKey Alpha data:', error);
    } finally {
      setIsScanning(false);
      setDataLoaded(true);
    }
  };

  // Scan on mount and poll every 30s
  useEffect(() => {
    fetchAlphaData();
    const interval = setInterval(fetchAlphaData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel p-6 rounded-2xl relative shadow-2xl overflow-hidden border border-white/10 mt-8">
      {/* Decorative scanning line animation */}
      {isScanning && (
        <motion.div
          className="absolute left-0 right-0 h-[2px] bg-neon-moon/50 shadow-[0_0_10px_#00ff00] z-20"
          initial={{ top: '0%' }}
          animate={{ top: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Header section */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 bg-neon-moon/20 rounded-full blur animate-pulse" />
            <div className="bg-black border border-neon-moon/50 p-2 rounded-lg relative z-10">
              <Key size={20} className="text-neon-moon" />
            </div>
          </div>
          <div>
            <h3 className="font-staatliches text-2xl tracking-wider text-white flex flex-wrap items-baseline gap-2">
              <span>ALPHA ZONE</span>
              <span className="font-mono text-[10px] text-trench-gasmask font-bold tracking-wider uppercase">
                powered by agentkey
              </span>
              {isScanning && <RefreshCw size={12} className="animate-spin text-neon-moon self-center" />}
            </h3>
            <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest flex items-center gap-1.5">
              <Activity size={10} className="text-neon-moon" /> LIVE SIGNAL INTERCEPT
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <button
            onClick={fetchAlphaData}
            disabled={isScanning}
            className="flex items-center gap-1.5 text-[10px] font-mono text-neon-moon border border-neon-moon/30 bg-neon-moon/5 px-2.5 py-1.5 rounded hover:bg-neon-moon/15 hover:border-neon-moon/50 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={10} className={isScanning ? 'animate-spin' : ''} />
            SCAN FRONT LINES
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        
        {/* Left Col: Twitter Trending Cashtags */}
        <div>
          <h4 className="font-mono text-xs font-bold text-white mb-3 uppercase flex items-center gap-2">
            <MessageSquare size={14} className="text-[#1DA1F2]" /> Trending Cashtags (X)
          </h4>
          
          <div className="space-y-2 font-mono">
            <AnimatePresence mode="popLayout">
              {dataLoaded ? trendingCashtags.map((item, idx) => (
                <motion.div 
                  key={item.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg hover:border-white/20 transition-colors group cursor-crosshair"
                >
                  <div className="flex items-center gap-2.5">
                    {item.thumb ? (
                      <img 
                        src={item.thumb} 
                        alt={item.name} 
                        className="w-5 h-5 rounded-full object-cover border border-white/10 group-hover:scale-110 transition-transform" 
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">
                        $
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs ${item.color}`}>{item.symbol}</span>
                      <span className="text-[9px] text-white/30 truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-white/50">Vol: {item.volume}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={`text-[9px] font-bold ${item.color} hidden sm:inline`}>{item.sentiment}</span>
                    <span className={`text-xs font-bold ${item.change.startsWith('+') ? 'text-neon-moon' : 'text-jeet-red'}`}>
                      {item.change}
                    </span>
                  </div>
                </motion.div>
              )) : (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-11 bg-white/5 animate-pulse rounded-lg border border-white/5" />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Col: Hype Topics */}
        <div>
          <h4 className="font-mono text-xs font-bold text-white mb-3 uppercase flex items-center gap-2">
            <TrendingUp size={14} className="text-moon-gold" /> Hype Radar (Narratives)
          </h4>
          
          <div className="space-y-2 font-mono">
            <AnimatePresence mode="popLayout">
              {dataLoaded ? hypeTopics.map((item, idx) => (
                <motion.div 
                  key={item.topic}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg hover:border-white/20 transition-colors"
                >
                  <span className="text-xs text-white/80 font-bold">{item.topic}</span>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className={`h-full ${item.score > 80 ? 'bg-neon-moon' : item.score > 50 ? 'bg-moon-gold' : 'bg-jeet-red'}`} 
                        style={{ width: `${item.score}%` }} 
                      />
                    </div>
                    <span className="text-[10px] text-white/50 w-8 text-right font-bold">{item.score}%</span>
                  </div>
                </motion.div>
              )) : (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-white/5 animate-pulse rounded-lg border border-white/5" />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 p-3 bg-neon-moon/5 border border-neon-moon/20 rounded-lg">
            <p className="font-mono text-[10px] text-neon-moon uppercase leading-relaxed font-bold flex items-start gap-1.5">
              <Zap size={12} className="text-neon-moon flex-shrink-0 mt-0.5" />
              <span>
                INTELLIGENCE REPORT:
                <span className="text-white ml-1 normal-case font-medium">{intelligenceReport || 'Analytic logs scanning active signal bands...'}</span>
              </span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
