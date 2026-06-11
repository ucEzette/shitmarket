'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAppState, mapApiRoom, Bet, formatCashtag } from '@/store/useAppState';
import { FloatingPepe } from './FloatingPepe';
import { Header } from './Header';
import { Footer } from './Footer';
import { WalletAdapterBridge } from './WalletAdapterBridge';
import { MemePopup, PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from './MemeAssets';
import { ShareCardModal } from './ShareCardModal';
import { ComplianceModal } from './ComplianceModal';
import { Volume2, VolumeX, Flame, Radiation, Sparkles, Home, List, Hammer, Layers, Trophy, User, Coins, Briefcase, Info, X, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Global audio synthesizer using Web Audio API so we don't need external mp3 assets!
let globalAudioContext: any = null;

export const synthSound = (type: 'bet' | 'explosion' | 'whistle' | 'victory' | 'defeat' | 'degen') => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/') return;
  
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
  const { tickTimers, fullDegenMode, setFullDegenMode, rooms, user, isPaused, toasts, removeToast } = useAppState();
  
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
  const isRoomPage = pathname?.startsWith('/room/');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [showDegenBanner, setShowDegenBanner] = useState(false);
  const prevSettledCount = useRef<number>(0);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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
    if (typeof window !== 'undefined') {
      (window as any).playDAppSound = (type: any) => {
        if (audioEnabled) {
          synthSound(type);
        }
      };
      (window as any).isAudioEnabled = audioEnabled;
      window.dispatchEvent(new CustomEvent('audio-state-changed'));
    }
    return () => {
      if (typeof window !== 'undefined') {
        try {
          delete (window as any).playDAppSound;
          delete (window as any).isAudioEnabled;
        } catch {}
      }
    };
  }, [audioEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleToggle = () => {
        setAudioEnabled((prev) => !prev);
      };
      window.addEventListener('toggle-audio', handleToggle);
      return () => {
        window.removeEventListener('toggle-audio', handleToggle);
      };
    }
  }, []);

  const navItems = [
    { label: 'WAR ROOM', href: '/rooms', icon: List },
    { label: 'PORTFOLIO', href: '/portfolio', icon: Briefcase },
    { label: 'DEPLOY', href: '/create-room', icon: Hammer },
    { label: 'PARLAYS', href: '/parlays', icon: Layers },
    { label: 'LEADERBOARD', href: '/leaderboard', icon: Trophy },
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
              colors: ['#FFD700', '#16A34A', '#ffffff']
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

    // Hydrate data directly from the blockchain every 15 seconds 
    // to bypass Indexer delays or outages without hitting Devnet rate limits.
    const onChainPoller = setInterval(() => {
      fetchRooms().catch(console.error);
    }, 15000);

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
      // Connect to the indexer WS server using environment variable or fallback to local
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('Tactical WebSocket link established with COMMAND HQ on port 3002.');
        socket.send(JSON.stringify({ type: 'subscribe_global' }));
        
        // Keep-alive heartbeat pings every 20 seconds to prevent idle timeout
        const keepAliveInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
        (socket as any).keepAliveInterval = keepAliveInterval;

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
          
          if (msg.type === 'new_room' || msg.type === 'RoomCreated') {
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
              message: `🚨 NEW DEGEN ARENA DEPLOYED: ${formatCashtag(newRoomObj.token.symbol)} is ready for action! 🚨`,
              timestamp: Date.now(),
            });
            
            if (audioEnabledRef.current) {
              synthSound('whistle');
            }
          }
          
          else if (
            msg.type === 'room_update' ||
            msg.type === 'BetPlaced' ||
            msg.type === 'RoomActivated' ||
            msg.type === 'RoomSettled' ||
            msg.type === 'WinningsClaimed' ||
            msg.type === 'NewChatMessage'
          ) {
            const roomPubkey = msg.roomPubkey || msg.room;
            const eventType = msg.type === 'room_update' ? msg.data?.type : msg.type;
            const data = msg.type === 'room_update' ? msg.data : msg;
            
            console.log('WS Event [Room State Change]:', roomPubkey, eventType, data);
            if (!roomPubkey) return;
            
            if (eventType === 'BetPlaced') {
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
            
            else if (eventType === 'NewChatMessage') {
              addMessage({
                roomId: roomPubkey,
                side: data.side,
                user: data.user,
                message: data.message,
                timestamp: data.timestamp,
              });
            }
            
            else if (eventType === 'RoomSettled') {
              settleRoom(roomPubkey, data.winner);
              
              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: 'KEEPER SYSTEM',
                message: `⚡ ARENA SETTLED! WINNER: ${data.winner.toUpperCase()} at TWAP ${Number(data.twapFinalPrice) / 1e12} USD ⚡`,
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
                      colors: ['#FFD700', '#16A34A', '#ffffff']
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
            
            else if (eventType === 'WinningsClaimed') {
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
        if ((socket as any).keepAliveInterval) {
          clearInterval((socket as any).keepAliveInterval);
        }
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
        if ((socket as any).keepAliveInterval) {
          clearInterval((socket as any).keepAliveInterval);
        }
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
            colors: ['#FF073A', '#16A34A', '#FFD700', '#00FFFF', '#FF00FF']
          });
          confetti({
            particleCount: 200,
            spread: 120,
            angle: 120,
            origin: { x: 1 },
            colors: ['#FF073A', '#16A34A', '#FFD700', '#00FFFF', '#FF00FF']
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

      {/* Compliance Risk & Exclusions Onboarding */}
      <ComplianceModal />
      


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

      {/* Devnet Warning Notice */}
      <div className="w-full bg-[#fcd34d] text-black font-mono text-[10px] sm:text-xs tracking-wider uppercase py-1.5 px-4 text-center border-b border-yellow-600 flex items-center justify-center gap-2 z-[110] relative font-bold shadow-[0_2px_8px_rgba(251,191,36,0.15)]">
        <span>⚠️ NOTICE: THE PLATFORM IS RUNNING ON SOLANA DEVNET. ALL STAKED SOL AND TOKENS ARE MOCK FAUCET ASSETS.</span>
      </div>

      {/* Main Header */}
      <Header isRoomPage={isRoomPage} onMenuToggle={() => setDrawerOpen(!drawerOpen)} />

      {isPaused && (
        <div className="w-full bg-red-900 text-white font-staatliches text-2xl tracking-widest uppercase py-3 text-center border-b-4 border-black flex items-center justify-center gap-4 z-40 shadow-[0_0_20px_rgba(255,0,0,0.5)]">
          <Radiation className="animate-spin text-yellow-500" size={24} />
          PLATFORM CIRCUIT BREAKER ACTIVATED: ALL OPERATIONS PAUSED
          <Radiation className="animate-spin text-yellow-500" size={24} />
        </div>
      )}

      <div className="flex-1 flex min-h-0 w-full relative">
        {/* Main Page Content */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0 transition-all duration-300 ease-in-out">
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

      {/* Shareable Wager Card Telemetry Modal */}
      <ShareCardModal />

      {/* Floating Toast Notification Tray */}
      <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let borderColor = 'border-trench-sandbag';
            let textColor = 'text-white';
            let glowColor = '';
            let Icon = null;

            if (toast.type === 'loading') {
              borderColor = 'border-moon-gold bg-trench-black/90';
              textColor = 'text-moon-gold';
              glowColor = 'shadow-[0_0_15px_rgba(218,165,32,0.25)]';
              Icon = <Loader2 size={16} className="animate-spin text-moon-gold shrink-0" />;
            } else if (toast.type === 'success') {
              borderColor = 'border-neon-moon bg-trench-black/90';
              textColor = 'text-neon-moon';
              glowColor = 'shadow-[0_0_15px_rgba(57,255,20,0.25)]';
              Icon = <Sparkles size={16} className="text-neon-moon shrink-0" />;
            } else if (toast.type === 'error') {
              borderColor = 'border-jeet-red bg-trench-black/90';
              textColor = 'text-jeet-red';
              glowColor = 'shadow-[0_0_15px_rgba(255,7,58,0.25)]';
              Icon = <Radiation size={16} className="text-jeet-red shrink-0 animate-pulse" />;
            } else {
              borderColor = 'border-trench-sandbag bg-trench-black/90';
              textColor = 'text-white';
              Icon = <Info size={16} className="text-trench-gasmask shrink-0" />;
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className={`pointer-events-auto p-4 border-2 rounded shadow-2xl relative overflow-hidden flex flex-col gap-1 scanlines ${borderColor} ${glowColor}`}
              >
                {/* Top Row: Icon + Title + Close Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {Icon}
                    <span className={`font-staatliches tracking-wide uppercase text-sm font-bold ${textColor}`}>
                      {toast.message}
                    </span>
                  </div>
                  {toast.type !== 'loading' && (
                    <button 
                      onClick={() => removeToast(toast.id)}
                      className="text-trench-gasmask hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Description */}
                {toast.description && (
                  <p className="font-mono text-[9px] text-trench-gasmask uppercase font-bold leading-relaxed pl-6">
                    {toast.description}
                  </p>
                )}

                {/* Transaction Link */}
                {toast.txSig && (
                  <div className="pl-6 mt-1 flex items-center">
                    <a
                      href={
                        (typeof window !== 'undefined' && window.location.hostname === 'localhost')
                          ? `https://explorer.solana.com/tx/${toast.txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
                          : `https://solscan.io/tx/${toast.txSig}?cluster=devnet`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[9px] text-[#00FFFF] hover:underline font-bold"
                    >
                      <span>VERIFY ON SOLSCAN</span>
                      <ExternalLink size={8} />
                    </a>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
