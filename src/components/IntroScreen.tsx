'use client';

import React, { useState, useEffect, useRef } from 'react';

const statusMessages = [
  "FORAGING FOR LIQUIDITY...",
  "BRIBING THE PEPE GENERALS...",
  "DUSTING OFF THE AMMO CRATES...",
  "CALIBRATING MOON TRAJECTORY...",
  "EVADING THE RUG-PULLS...",
  "HEATING UP THE NEON CIGAR...",
  "DEPLOYING SANDBAGS...",
  "FINALIZING DEGEN PROTOCOL..."
];

const quotes = [
  "JEETS GONNA JEET.",
  "TO THE MOON!",
  "STAY IN THE TRENCH.",
  "WAGMI ANONS.",
  "BUY THE DIP.",
  "DIAMOND HANDS ONLY."
];

export function IntroScreen({ onComplete }: { onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState(statusMessages[0]);
  const [quote, setQuote] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [pepeLeftUp, setPepeLeftUp] = useState(false);
  const [pepeRightUp, setPepeRightUp] = useState(false);
  const [signVisible, setSignVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Background dust spawning before start
    const spawnDust = () => {
      if (!containerRef.current) return;
      const texts = ['JEET', 'MOON', 'HODL', 'LFG'];
      const dust = document.createElement('div');
      dust.className = 'intro-jeet-dust';
      dust.innerText = texts[Math.floor(Math.random() * texts.length)];
      dust.style.left = Math.random() * 100 + 'vw';
      dust.style.top = Math.random() * 100 + 'vh';
      containerRef.current.appendChild(dust);

      let x = 0;
      let y = 0;
      const speedX = (Math.random() - 0.5) * 2;
      const speedY = (Math.random() - 0.5) * 2;
      
      const anim = setInterval(() => {
        x += speedX;
        y += speedY;
        dust.style.transform = `translate(${x}px, ${y}px)`;
        if (Math.abs(x) > 200) {
          clearInterval(anim);
          dust.remove();
        }
      }, 50);
    };

    const dustInterval = setInterval(spawnDust, 2000);
    for(let i=0; i<20; i++) spawnDust();

    return () => clearInterval(dustInterval);
  }, []);

  const spawnCoins = () => {
    if (!containerRef.current) return;
    for(let i=0; i<10; i++) {
      const coin = document.createElement('div');
      coin.className = 'intro-coin';
      coin.innerHTML = '🪙';
      coin.style.left = (50 + (Math.random() * 20 - 10)) + '%';
      coin.style.top = '50%';
      containerRef.current.appendChild(coin);
      
      const angle = Math.random() * Math.PI * 2;
      const velocity = 5 + Math.random() * 10;
      let x = 0, y = 0, vy = -velocity, vx = Math.cos(angle) * (Math.random() * 5);
      
      const anim = setInterval(() => {
        x += vx; y += vy; vy += 0.5;
        coin.style.transform = `translate(${x}px, ${y}px) rotate(${y*2}deg)`;
        if (y > window.innerHeight) { clearInterval(anim); coin.remove(); }
      }, 16);
    }
  };

  const handleStart = () => {
    if (started) return;
    setStarted(true);

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const playAmbient = () => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(40, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      setInterval(() => {
        if (audioCtx.state === 'closed') return;
        const ping = audioCtx.createOscillator();
        const pingGain = audioCtx.createGain();
        ping.frequency.setValueAtTime(880 + Math.random() * 400, audioCtx.currentTime);
        pingGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
        pingGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
        ping.connect(pingGain);
        pingGain.connect(audioCtx.destination);
        ping.start();
        ping.stop(audioCtx.currentTime + 1);
      }, 3000);
    };
    playAmbient();

    let currProgress = 0;
    const interval = setInterval(() => {
      currProgress += Math.random() * 1.5;
      if (currProgress > 100) {
        currProgress = 100;
        clearInterval(interval);
        setStatusMsg("FRONT LINE REACHED.");
        setTimeout(() => {
          if (audioCtxRef.current) {
            audioCtxRef.current.close();
          }
          onComplete();
        }, 1000);
      }
      setProgress(currProgress);

      if (Math.random() < 0.05) triggerMortar();
      if (Math.random() < 0.03) popPepe();
      if (Math.random() < 0.01) slideSign();

      if (Math.floor(currProgress) % 15 === 0 && currProgress < 100) {
        setStatusMsg(statusMessages[Math.floor(currProgress/15) % statusMessages.length]);
      }

      if (Math.random() < 0.03) triggerQuote();
    }, 100);

    const spawnDebris = () => {
      if (!containerRef.current) return;
      
      // Spawn 2-3 flying jeet skeletons shooting from bottom-center
      const skelCount = 2 + Math.floor(Math.random() * 2);
      for(let i=0; i<skelCount; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'intro-jeet-skeleton-fly';
        skeleton.style.left = (40 + Math.random() * 20) + '%';
        skeleton.style.bottom = '10%';
        containerRef.current.appendChild(skeleton);
        
        const velocity = 8 + Math.random() * 12;
        let x = 0, y = 0;
        let vy = -velocity;
        let vx = (Math.random() - 0.5) * 16;
        let rot = 0;
        const rotSpeed = (Math.random() - 0.5) * 10;
        
        const anim = setInterval(() => {
          x += vx;
          y += vy;
          vy += 0.5; // gravity
          rot += rotSpeed;
          skeleton.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
          if (y > window.innerHeight) {
            clearInterval(anim);
            skeleton.remove();
          }
        }, 16);
      }
      
      // Spawn 1 moon juice bottle launching up
      const juice = document.createElement('div');
      juice.className = 'intro-moon-juice';
      juice.style.left = (45 + Math.random() * 10) + '%';
      juice.style.bottom = '10%';
      containerRef.current.appendChild(juice);
      
      const velocity = 10 + Math.random() * 8;
      let x = 0, y = 0;
      let vy = -velocity;
      let vx = (Math.random() - 0.5) * 8;
      let rot = 0;
      const rotSpeed = (Math.random() - 0.5) * 5;
      
      const anim = setInterval(() => {
        x += vx;
        y += vy;
        vy += 0.4; // gravity
        rot += rotSpeed;
        juice.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
        if (y > window.innerHeight) {
          clearInterval(anim);
          juice.remove();
        }
      }, 16);
    };

    const triggerMortar = () => {
      setShake(true);
      setFlash(true);
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        const thump = audioCtxRef.current.createOscillator();
        const thumpGain = audioCtxRef.current.createGain();
        thump.frequency.setValueAtTime(100, audioCtxRef.current.currentTime);
        thump.frequency.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.5);
        thumpGain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.5);
        thump.connect(thumpGain);
        thumpGain.connect(audioCtxRef.current.destination);
        thump.start();
        thump.stop(audioCtxRef.current.currentTime + 0.5);
      }

      setTimeout(() => {
        setShake(false);
        setFlash(false);
      }, 400);

      spawnCoins();
      spawnDebris();
    };

    const triggerQuote = () => {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
      setShowQuote(true);
      setTimeout(() => { 
        setShowQuote(false);
      }, 1500);
    };

    const popPepe = () => {
      if (Math.random() > 0.5) {
        setPepeLeftUp(true);
        setTimeout(() => setPepeLeftUp(false), 1200);
      } else {
        setPepeRightUp(true);
        setTimeout(() => setPepeRightUp(false), 1200);
      }
    };

    const slideSign = () => {
      setSignVisible(true);
      setTimeout(() => setSignVisible(false), 3000);
    };
  };

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[9999] bg-[#0c1609] text-white flex items-center justify-center font-mono overflow-hidden select-none ${shake ? 'intro-shake' : ''}`} onClick={handleStart}>
      {/* Premium Battlefield Assets */}
      <div className="intro-battlefield-bg"></div>
      <div className="intro-decor-juice-left"></div>
      <div className="intro-decor-juice-right"></div>
      
      <div className="intro-overlay"></div>
      <div className={`intro-scanlines ${showQuote ? 'intro-glitch-active' : ''}`}></div>
      <div className="intro-flash" style={{ opacity: flash ? 0.4 : 0 }}></div>
      <img alt="Neon Wojak" className="intro-ghost-wojak" style={{ opacity: flash ? 0.22 : 0 }} src="/pepes/neon-wojak.png"/>
      
      {/* Side Popups - Degen Generals */}
      <img alt="Ape General" className="intro-pepe-sprite" src="/pepes/ape-general.png" style={{ left: '5%', bottom: pepeLeftUp ? '-10px' : '-180px', width: '130px' }}/>
      <img alt="Chad Bull General" className="intro-pepe-sprite" src="/pepes/chad-bull-general.png" style={{ right: '5%', bottom: pepeRightUp ? '-10px' : '-180px', width: '130px' }}/>
      
      <div className="intro-few-understand-sign" style={{ left: signVisible ? '5%' : '-400px' }}>FEW UNDERSTAND</div>
      
      <div className="flex flex-col items-center relative z-[60]">
        {!started ? (
          <div className="cursor-pointer group flex flex-col items-center">
            <div className="intro-radioactive-btn text-4xl md:text-6xl font-black mb-4 text-white font-staatliches tracking-wider">CLICK TO DEPLOY</div>
            <div className="text-gray-500 opacity-50 font-bold">INITIALIZING TRENCH COMMS...</div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="intro-mascot-container">
              <img alt="Diamond Hands Ape" className="intro-mascot" src="/pepes/diamond-hands-ape.png"/>
              <div className="intro-quote" style={{ opacity: showQuote ? 1 : 0 }}>{quote}</div>
            </div>
            <div className="intro-loading-text">{statusMsg}</div>
            <div className="intro-loading-track">
              <div className="intro-loading-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="mt-8 flex gap-4">
              <div className="px-3 py-1 border border-[#323c2d] text-[10px] text-gray-500">VERSION: DEGEN_BETA_V1</div>
              <div className="px-3 py-1 border border-[#323c2d] text-[10px] text-gray-500">LATENCY: 420ms</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
