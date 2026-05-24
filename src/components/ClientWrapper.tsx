'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAppState, mapApiRoom, Bet } from '@/store/useAppState';
import { FloatingPepe } from './FloatingPepe';
import { Header } from './Header';
import { Footer } from './Footer';
import { WalletAdapterBridge } from './WalletAdapterBridge';
import { MemePopup, PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from './MemeAssets';
import { Volume2, VolumeX, Flame, Radiation, Sparkles, Home, List, Hammer, Layers, Trophy, User, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Global audio synthesizer using Web Audio API so we don't need external mp3 assets!
let globalAudioContext: any = null;

export const synthSound = (type: 'bet' | 'explosion' | 'whistle' | 'victory' | 'defeat' | 'degen') => {
  if (typeof window === 'undefined') return;
  
  try {
    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
      globalAudioContext.resume().catch(() => {});
    }

    const audioContext = globalAudioContext;
    const masterVolume = audioContext.createGain();
    masterVolume.gain.setValueAtTime(0.15, audioContext.currentTime); // keep it balanced
    masterVolume.connect(audioContext.destination);

    const now = audioContext.currentTime;

    switch (type) {
    case 'bet': {
      // Fast pitch sweep (coin chime)
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(masterVolume);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
    case 'whistle': {
      // Dropping frequency sweep (mortar incoming)
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.8);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.connect(gain);
      gain.connect(masterVolume);
      osc.start(now);
      osc.stop(now + 0.8);
      break;
    }
    case 'explosion': {
      // Noise buffer synthesis for explosion rumble
      const bufferSize = audioContext.sampleRate * 1.5;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = audioContext.createBufferSource();
      noiseNode.buffer = buffer;

      // Low pass filter to make it rumbly and muddy
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(10, now + 1.2);

      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(masterVolume);

      noiseNode.start(now);
      noiseNode.stop(now + 1.5);

      // Add a low sine sub bump too
      const subOsc = audioContext.createOscillator();
      const subGain = audioContext.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.linearRampToValueAtTime(30, now + 0.5);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      subOsc.connect(subGain);
      subGain.connect(masterVolume);
      subOsc.start(now);
      subOsc.stop(now + 0.6);
      break;
    }
    case 'victory': {
      // Gold chime fanfare
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(masterVolume);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
      break;
    }
    case 'defeat': {
      // Sad sliding pitch boom
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.6);
      
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterVolume);
      
      osc.start(now);
      osc.stop(now + 0.7);
      break;
    }
    case 'degen': {
      // Synthesized funny degen sound (sliding filter fart/laser effect)
      const osc = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(122, now);
      osc2.frequency.exponentialRampToValueAtTime(805, now + 0.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(masterVolume);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.6);
      osc2.stop(now + 0.6);
      break;
    }
    }
  } catch (err) {
    console.warn("synthSound failed:", err);
  }
};

export const ClientWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tickTimers, fullDegenMode, setFullDegenMode, rooms, user, isPaused } = useAppState();
  
  // Real-time synchronization store actions
  const addRoom = useAppState((s) => s.addRoom);
  const updateRoomPools = useAppState((s) => s.updateRoomPools);
  const settleRoom = useAppState((s) => s.settleRoom);
  const markBetClaimed = useAppState((s) => s.markBetClaimed);
  const addUserBet = useAppState((s) => s.addUserBet);
  const fetchBalance = useAppState((s) => s.fetchBalance);
  const addMessage = useAppState((s) => s.addMessage);
  const fetchRooms = useAppState((s) => s.fetchRooms);
  const fetchLeaderboard = useAppState((s) => s.fetchLeaderboard);

  const pathname = usePathname();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [showDegenBanner, setShowDegenBanner] = useState(false);
  const prevSettledCount = useRef<number>(0);

  // Connection and synchronization state references
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRoomsRef = useRef<Set<string>>(new Set());
  const userRef = useRef(user);
  const audioEnabledRef = useRef(audioEnabled);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get('ref');
      if (ref) {
        localStorage.setItem('ref', ref);
        console.log('Successfully captured referral code from URL:', ref);
      }
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const navItems = [
    { label: 'HQ LANDING', href: '/', icon: Home },
    { label: 'WAR TABLE', href: '/rooms', icon: List },
    { label: 'DEPLOY MISSION', href: '/create-room', icon: Hammer },
    { label: 'PARLAYS', href: '/parlays', icon: Layers },
    { label: 'LEADERBOARD', href: '/leaderboard', icon: Trophy },
    { label: 'TRENCH PASS', href: '/profile', icon: User },
  ];

  // Play background tactical rumble loop if audioEnabled
  useEffect(() => {
    if (!audioEnabled || typeof window === 'undefined') return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Very quiet low background drum heartbeat
    const beatGain = audioContext.createGain();
    beatGain.gain.setValueAtTime(0.02, audioContext.currentTime);
    beatGain.connect(audioContext.destination);

    const interval = setInterval(() => {
      const now = audioContext.currentTime;
      // Kick boom
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(20, now + 0.3);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(beatGain);
      osc.start(now);
      osc.stop(now + 0.3);
    }, 2000); // every 2 seconds

    return () => {
      clearInterval(interval);
      audioContext.close();
    };
  }, [audioEnabled]);

  // Monitor settled rooms for victory/defeat sound cues and confetti!
  useEffect(() => {
    const settledRooms = rooms.filter(r => r.status === 'settled');
    if (settledRooms.length > prevSettledCount.current) {
      // A room has settled! Trigger an explosion
      if (audioEnabled) {
        synthSound('explosion');
      }

      // Check if user won or lost
      const lastSettled = settledRooms[settledRooms.length - 1];
      const user = useAppState.getState().user;
      
      if (user && user.wallet) {
        const userBets = user.bets.filter(b => b.roomId === lastSettled.id);
        if (userBets.length > 0) {
          const hasWon = userBets.some(b => b.side === lastSettled.winner);
          if (hasWon) {
            // Gold Confetti!
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#FFD700', '#39FF14', '#ffffff']
            });
            if (audioEnabled) {
              setTimeout(() => synthSound('victory'), 300);
            }
          } else {
            // Apply a screen shake via state or class, and play sad horn
            if (audioEnabled) {
              setTimeout(() => synthSound('defeat'), 300);
            }
          }
        }
      }
    }
    prevSettledCount.current = settledRooms.length;
  }, [rooms, audioEnabled]);

  // Timer Tick Loop & On-Chain Polling
  useEffect(() => {
    const interval = setInterval(() => {
      tickTimers();
    }, 2500); // tick pools and countdown timers every 2.5s

    // Hydrate data directly from the blockchain every 5 seconds 
    // to bypass Indexer delays or outages.
    const onChainPoller = setInterval(() => {
      fetchRooms().catch(console.error);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(onChainPoller);
    };
  }, [tickTimers, fetchRooms]);

  // Tactical Web3 WebSocket Integration
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fetch initial live state from REST API
    fetchRooms().catch(console.error);
    fetchLeaderboard().catch(console.error);

    let socket: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      // Connect to the indexer WS server on port 3002
      socket = new WebSocket('ws://localhost:3002');
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('Tactical WebSocket link established with COMMAND HQ on port 3002.');
        socket.send(JSON.stringify({ type: 'subscribe_global' }));
        
        // Resubscribe to all existing active rooms
        subscribedRoomsRef.current.clear();
        rooms.forEach((r) => {
          socket.send(JSON.stringify({ type: 'subscribe', room: r.id }));
          subscribedRoomsRef.current.add(r.id);
        });
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'new_room') {
            console.log('WS Event [New Room Deployed]:', msg);
            const newRoomObj = mapApiRoom(msg);
            addRoom(newRoomObj);
            
            // Subscribe to this room's updates immediately
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'subscribe', room: newRoomObj.id }));
              subscribedRoomsRef.current.add(newRoomObj.id);
            }
            
            addMessage({
              roomId: newRoomObj.id,
              side: 'all',
              user: 'COMMAND HQ',
              message: `🚨 NEW DEGEN ARENA DEPLOYED: $${newRoomObj.token.symbol} is ready for action! 🚨`,
              timestamp: Date.now(),
            });
            
            if (audioEnabledRef.current) {
              synthSound('whistle');
            }
          }
          
          else if (msg.type === 'room_update') {
            const { roomPubkey, ...data } = msg;
            console.log('WS Event [Room State Change]:', roomPubkey, data);
            
            if (data.type === 'BetPlaced') {
              const moonAmount = Number(data.moonPool) / 1e9;
              const jeetAmount = Number(data.jeetPool) / 1e9;
              updateRoomPools(roomPubkey, moonAmount, jeetAmount);
              
              const formattedUser = `${data.user.slice(0, 6)}...${data.user.slice(-4)}`;
              const betSol = Number(data.amount) / 1e9;
              
              addMessage({
                roomId: roomPubkey,
                side: 'all', // Show in all tabs (Moon & Jeet)
                user: 'COMMAND HQ',
                message: `💥 BATTLE UPDATE: ${formattedUser} stacked ${betSol.toFixed(2)} SOL on ${data.side.toUpperCase()}! 💥`,
                timestamp: Date.now(),
              });
              
              if (audioEnabledRef.current) {
                synthSound('bet');
              }
              
              const currentUser = userRef.current;
              if (currentUser && currentUser.wallet === data.user) {
                fetchBalance();
                addUserBet({
                  id: Math.random().toString(),
                  roomId: roomPubkey,
                  user: data.user,
                  side: data.side,
                  amount: betSol,
                  claimed: false,
                  timestamp: Date.now(),
                });
              }
            }
            
            else if (data.type === 'RoomSettled') {
              settleRoom(roomPubkey, data.winner);
              
              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: 'KEEPER SYSTEM',
                message: `⚡ ARENA SETTLED! WINNER: ${data.winner.toUpperCase()} at TWAP ${Number(data.twapFinalPrice) / 1e8} USD ⚡`,
                timestamp: Date.now(),
              });
              
              if (audioEnabledRef.current) {
                synthSound('explosion');
              }
              
              const currentUser = userRef.current;
              if (currentUser && currentUser.wallet) {
                const userBet = currentUser.bets.find(b => b.roomId === roomPubkey);
                if (userBet) {
                  const won = userBet.side === data.winner;
                  if (won) {
                    confetti({
                      particleCount: 150,
                      spread: 80,
                      origin: { y: 0.6 },
                      colors: ['#FFD700', '#39FF14', '#ffffff']
                    });
                    if (audioEnabledRef.current) {
                      setTimeout(() => synthSound('victory'), 300);
                    }
                  } else {
                    if (audioEnabledRef.current) {
                      setTimeout(() => synthSound('defeat'), 300);
                    }
                  }
                }
              }
            }
            
            else if (data.type === 'WinningsClaimed') {
              markBetClaimed(roomPubkey, data.user);
              
              const formattedUser = `${data.user.slice(0, 6)}...${data.user.slice(-4)}`;
              const claimedSol = Number(data.amount) / 1e9;
              
              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: formattedUser,
                message: `💎 SECURED WAR BOOTY OF ${claimedSol.toFixed(2)} SOL! LFG! 💎`,
                timestamp: Date.now(),
              });
              
              const currentUser = userRef.current;
              if (currentUser && currentUser.wallet === data.user) {
                fetchBalance();
              }
            }
          }
        } catch (err) {
          console.error('Failed to process WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.warn('Tactical WebSocket link severed. Retrying connection in 3 seconds...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Subscribe to newly loaded rooms dynamically when rooms array updates
  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    rooms.forEach((r) => {
      if (!subscribedRoomsRef.current.has(r.id)) {
        socket.send(JSON.stringify({ type: 'subscribe', room: r.id }));
        subscribedRoomsRef.current.add(r.id);
        console.log(`Subscribed to room updates dynamically: ${r.id}`);
      }
    });
  }, [rooms]);

  // Konami Code sequence: Up Up Down Down Left Right Left Right B A
  useEffect(() => {
    const konamiSequence = [
      'arrowup',
      'arrowup',
      'arrowdown',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'arrowleft',
      'arrowright',
      'b',
      'a'
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const newProgress = [...konamiProgress, key];

      // Check if current progress matches sequence so far
      const isMatch = newProgress.every((k, i) => k === konamiSequence[i]);

      if (isMatch) {
        if (newProgress.length === konamiSequence.length) {
          // Fully matched!
          setFullDegenMode(!fullDegenMode);
          setKonamiProgress([]);
          setShowDegenBanner(true);
          
          // Play funny synthetic fart/laser alert!
          synthSound('degen');

          // Trigger double massive chaotic rainbow confetti!
          confetti({
            particleCount: 200,
            spread: 120,
            angle: 60,
            origin: { x: 0 },
            colors: ['#FF073A', '#39FF14', '#FFD700', '#00FFFF', '#FF00FF']
          });
          confetti({
            particleCount: 200,
            spread: 120,
            angle: 120,
            origin: { x: 1 },
            colors: ['#FF073A', '#39FF14', '#FFD700', '#00FFFF', '#FF00FF']
          });

          setTimeout(() => setShowDegenBanner(false), 5000);
        } else {
          setKonamiProgress(newProgress);
        }
      } else {
        // Reset progress on typo (unless the key is ArrowUp, starting a new sequence)
        setKonamiProgress(key === 'arrowup' ? ['arrowup'] : []);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiProgress, fullDegenMode, setFullDegenMode]);

  return (
    <div className={`min-h-screen flex flex-col relative ${fullDegenMode ? 'full-degen-rainbow scanlines' : ''}`}>
      
      {/* Wallet Adapter Bridge - syncs Solana wallet to Zustand state */}
      <WalletAdapterBridge />
      
      {/* Dynamic Soundboard Action Controller (Top-Right Floating Overlay) */}
      <div className="fixed top-24 right-4 z-40">
        <button
          onClick={() => {
            setAudioEnabled(!audioEnabled);
            if (!audioEnabled) synthSound('bet'); // quick test beep
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-staatliches text-xs uppercase tracking-wider border-2 transition-all shadow-md ${
            audioEnabled
              ? 'bg-neon-moon/20 border-neon-moon text-neon-moon hover:bg-neon-moon/30 shadow-glow-moon'
              : 'bg-trench-mud border-trench-sandbag text-trench-gasmask hover:text-white'
          }`}
          title="Battlefield Ambient Audio"
        >
          {audioEnabled ? (
            <>
              <Volume2 size={12} className="animate-bounce" />
              <span>SOUNDS ACTIVE</span>
            </>
          ) : (
            <>
              <VolumeX size={12} />
              <span>SOUNDS MUTED</span>
            </>
          )}
        </button>
      </div>

      {/* Easter Egg Overlay Notification Banner */}
      {showDegenBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none bg-black/40">
          <div className="bg-yellow-500 text-black border-4 border-black p-8 rounded shadow-[0_0_50px_#FFD700] rotate-3 text-center scale-110 animate-bounce">
            <h2 className="font-staatliches text-5xl tracking-widest leading-none flex items-center justify-center gap-2">
              <Radiation className="animate-spin" size={36} />
              FULL DEGEN MODE ACTIVATED
              <Radiation className="animate-spin" size={36} />
            </h2>
            <p className="font-marker text-lg mt-2 text-red-950 uppercase tracking-widest">
              CAUTION: MAX SLIPPAGE AND MAXIMUM CHAOS DEPLOYED!
            </p>
          </div>
        </div>
      )}

      {/* Main Header */}
      <Header />

      {isPaused && (
        <div className="w-full bg-red-900 text-white font-staatliches text-2xl tracking-widest uppercase py-3 text-center border-b-4 border-black flex items-center justify-center gap-4 z-40 shadow-[0_0_20px_rgba(255,0,0,0.5)]">
          <Radiation className="animate-spin text-yellow-500" size={24} />
          PLATFORM CIRCUIT BREAKER ACTIVATED: ALL OPERATIONS PAUSED
          <Radiation className="animate-spin text-yellow-500" size={24} />
        </div>
      )}

      <div className="flex-1 flex min-h-0 w-full relative">
        {/* Sidebar Nav (Desktop) */}
        <aside className="hidden lg:flex flex-col w-64 bg-trench-mud border-r-4 border-trench-sandbag shadow-[inset_-4px_0_8px_rgba(0,0,0,0.5)] shrink-0 pt-4 relative scanlines justify-between pb-8 z-30">
          <div>
            <div className="p-6 border-b-2 border-trench-sandbag mb-4 bg-trench-black/20">
              <div className="flex items-center gap-3 mb-2">
                <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={40} glowColor="gold" className="rounded-full" />
                <div>
                  <h3 className="font-staatliches text-2xl text-neon-moon tracking-wider leading-none uppercase">
                    TRENCH HQ
                  </h3>
                  <p className="font-mono text-[10px] text-trench-gasmask mt-0.5 uppercase font-bold">
                    {user && user.wallet 
                      ? `COMMANDER #${user.wallet.substring(2, 6).toUpperCase()}` 
                      : 'GUEST RECRUIT'}
                  </p>
                </div>
              </div>
            </div>
            
            <nav className="flex flex-col gap-1.5 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 font-staatliches text-base tracking-wider uppercase rounded transition-all ${
                      isActive
                        ? 'bg-trench-black text-neon-moon border-l-4 border-neon-moon shadow-[0_0_10px_rgba(57,255,20,0.15)] font-bold'
                        : 'text-trench-gasmask hover:text-white hover:bg-trench-black/40'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-neon-moon font-bold' : 'text-trench-gasmask'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Quick Mission Deployer Widget at the bottom */}
          <div className="px-4 mt-auto">
            {user && user.wallet ? (
              <div className="bg-trench-black p-3.5 border-2 border-trench-sandbag rounded mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <PepePortrait src={PEPE_ASSETS.diamondHands} size={32} glowColor="gold" className="rounded" />
                  <div>
                    <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase block">AMMUNITION</span>
                    <span className="font-staatliches text-lg text-moon-gold glow-gold tracking-wider leading-none uppercase">
                      {user.balance.toFixed(2)} SOL
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-trench-black/60 p-3.5 border-2 border-dashed border-trench-sandbag rounded mb-4 text-center">
                <PepePortrait src={PEPE_ASSETS.neonWojak} size={40} className="rounded-full mx-auto mb-2" />
                <p className="font-mono text-[9px] text-trench-gasmask uppercase font-bold leading-normal">
                  STASH OFFLINE. ENLIST VIA WALLET CONNECTION!
                </p>
              </div>
            )}

            {/* Rotating degen quote */}
            <div className="mb-4">
              <DegenQuoteBanner interval={12000} />
            </div>
            
            {isPaused ? (
              <button disabled className="w-full py-2.5 font-staatliches text-lg uppercase tracking-wider text-black bg-gray-500 rounded border-b-4 border-gray-800 font-bold opacity-50 cursor-not-allowed">
                SYSTEM PAUSED
              </button>
            ) : (
              <Link href="/create-room" className="block w-full">
                <button className="w-full py-2.5 font-staatliches text-lg uppercase tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-0.5 transition-all font-bold">
                  DEPLOY NEW MISSION
                </button>
              </Link>
            )}
          </div>
        </aside>

        {/* Main Page Content shifted on desktop */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <Footer />
        </main>
      </div>

      {/* Mobile Bottom Bar Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 py-1.5 bg-trench-mud border-t-4 border-trench-sandbag z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.6)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 transition-all rounded ${
                isActive 
                  ? 'bg-trench-black text-neon-moon border border-trench-sandbag scale-95' 
                  : 'text-trench-gasmask hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-neon-moon' : 'text-trench-gasmask'} />
              <span className="font-staatliches text-[9px] tracking-wider mt-0.5 uppercase">
                {item.label.split(' ')[0]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Tactical Pepe */}
      <FloatingPepe />

      {/* Random Degen Meme Popups */}
      <MemePopup triggerInterval={20000} />
    </div>
  );
};
