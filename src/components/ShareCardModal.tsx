'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/store/useAppState';
import { synthSound } from '@/components/ClientWrapper';
import { useRouter } from 'next/navigation';
import { DEGEN_QUOTES, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { Download, Copy, Check, X, Loader2, Sparkles } from 'lucide-react';

const formatExactExpiry = (expiryMs?: number) => {
  if (!expiryMs) return 'UNKNOWN';
  const date = new Date(expiryMs);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).toUpperCase();
};

// Quotes kept short (~100 chars) so the full tweet stays under 280 characters
const getFunnyQuote = (side: 'moon' | 'jeet', tokenSymbol: string, durationStr: string, roomId: string) => {
  const seed = roomId ? roomId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const t = tokenSymbol.startsWith('$') ? tokenSymbol.toUpperCase() : `$${tokenSymbol.toUpperCase()}`;

  const moonQuotes = [
    `Giga bullish on ${t} for ${durationStr}. Either it moons or I'm ngmi. Think you can fade this? Fight me. 🚀`,
    `Full port into ${t} for ${durationStr}. High conviction ape. If you think it's a rug, put your SOL where your mouth is. 💰`,
    `${t} going straight to Valhalla in ${durationStr}. If you think this chart goes to zero, come donate your SOL to my yacht fund. 🌙`,
    `Bullying ${t} bears for ${durationStr}. If you love fading clean pumps, hit the link and fight me. 🔫`
  ];

  const jeetQuotes = [
    `${t} dev is gone. Chart's cooked. Shorting this to zero in ${durationStr}. Think it pumps? Prove it. 💀`,
    `Jeeting ${t} to zero in ${durationStr}. Chart's a ski slope. Still believe in the CT? Fight my bet. 📉`,
    `Fading ${t} hard for ${durationStr}. It's a rug-in-progress. Think this pig flies? Come challenge me. 🐷`,
    `${t} bags are heavy. Jeeting out in ${durationStr}. Think they pump? Put your SOL on it and challenge me. 😂`
  ];

  const quotes = side === 'moon' ? moonQuotes : jeetQuotes;
  return quotes[seed % quotes.length];
};

// Shared price formatter used by both canvas and tweet text
const formatPriceForDisplay = (p: number): string => {
  if (p >= 1) return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
  const s = p.toFixed(20);
  const m = s.match(/^0\.(0*)/);
  const zeros = m ? m[1].length : 0; // operator-precedence-safe: zeros first, then +4
  return `$${p.toFixed(Math.min(zeros + 4, 12)).replace(/0+$/, '')}`;
};

export const ShareCardModal: React.FC = () => {
  const router = useRouter();
  const { shareCardData, setShareCardData, user } = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [memeImg, setMemeImg] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [copying, setCopying] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Capture referral link details
  const referralCode = user?.referralCode || (user?.wallet ? user.wallet.slice(0, 6) + '9999' : 'recruit');
  
  const formatDurationText = (mins: number) => {
    if (mins >= 1440) return `${Math.round(mins / 1440)} DAY${Math.round(mins / 1440) > 1 ? 'S' : ''}`;
    if (mins >= 60) return `${Math.round(mins / 60)} HOUR${Math.round(mins / 60) > 1 ? 'S' : ''}`;
    return `${mins} MINS`;
  };

  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/rooms?ref=${referralCode}` 
    : `https://shitmarket/rooms?ref=${referralCode}`;

  // Monitor document fonts loading to prevent canvas fallback rendering issues
  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }
  }, []);

  // Reset states and pick random assets when a new share card is triggered
  useEffect(() => {
    if (!shareCardData) return;

    setGenerating(true);
    setCopied(false);
    
    // Choose appropriate image asset based on the side
    const isMoon = shareCardData.side === 'moon';
    const presets = isMoon ? MOON_PEPES : JEET_PEPES;
    const presetSrc = presets[Math.floor(Math.random() * presets.length)] || presets[0];

    // Asynchronously pre-load the image so it can be drawn on canvas
    const img = new Image();
    img.src = presetSrc;
    img.crossOrigin = 'anonymous'; // Prevent CORS tainted canvas errors
    img.onload = () => {
      setMemeImg(img);
      setGenerating(false);
    };
    img.onerror = () => {
      console.warn("Failed to load meme image for share card, using fallback layout");
      setGenerating(false);
    };
  }, [shareCardData]);

  // Execute Canvas Drawing
  useEffect(() => {
    if (!shareCardData || generating || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1200, 630);

    const { roomId, side, tokenSymbol, duration, amount, isNewRoom, expiry, openingPrice } = shareCardData;
    const isMoon = side === 'moon';
    const primaryColor = isMoon ? '#39FF14' : '#FF073A';
    const secondaryColor = isMoon ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 7, 58, 0.08)';

    // 1. Draw Deep Space Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, '#0A0C10');
    grad.addColorStop(1, '#030406');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. High-Tech Dot Grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 0; x < 1200; x += 20) {
      for (let y = 0; y < 630; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Glowing Outer Frame
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, 1140, 570);
    ctx.shadowBlur = 0;

    // High-contrast Corner Accents
    const cl = 40; // corner length
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 15;
    const corners = [
      [[30, 30 + cl], [30, 30], [30 + cl, 30]], // TL
      [[1170 - cl, 30], [1170, 30], [1170, 30 + cl]], // TR
      [[30, 600 - cl], [30, 600], [30 + cl, 600]], // BL
      [[1170 - cl, 600], [1170, 600], [1170, 600 - cl]] // BR
    ];
    corners.forEach(pts => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // 4. Intense Backglow for Image
    const glowX = 850, glowY = 270;
    const glowGrad = ctx.createRadialGradient(glowX, glowY, 50, glowX, glowY, 300);
    glowGrad.addColorStop(0, isMoon ? 'rgba(57, 255, 20, 0.4)' : 'rgba(255, 7, 58, 0.4)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(500, 0, 700, 540);

    // 5. Meme Image with sharp corners and glow
    const imgX = 680, imgY = 70, imgW = 440, imgH = 440, imgR = 24;
    if (memeImg) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(imgX + imgR, imgY);
      ctx.lineTo(imgX + imgW - imgR, imgY);
      ctx.quadraticCurveTo(imgX + imgW, imgY, imgX + imgW, imgY + imgR);
      ctx.lineTo(imgX + imgW, imgY + imgH - imgR);
      ctx.quadraticCurveTo(imgX + imgW, imgY + imgH, imgX + imgW - imgR, imgY + imgH);
      ctx.lineTo(imgX + imgR, imgY + imgH);
      ctx.quadraticCurveTo(imgX, imgY + imgH, imgX, imgY + imgH - imgR);
      ctx.lineTo(imgX, imgY + imgR);
      ctx.quadraticCurveTo(imgX, imgY, imgX + imgR, imgY);
      ctx.closePath();
      
      // Add heavy neon glow behind the image explicitly
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 40;
      ctx.fill(); // Fills the background to cast shadow
      
      ctx.clip();
      ctx.drawImage(memeImg, imgX, imgY, imgW, imgH);
      ctx.restore();

      // Sharp Neon Image Border
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(imgX + imgR, imgY);
      ctx.lineTo(imgX + imgW - imgR, imgY);
      ctx.quadraticCurveTo(imgX + imgW, imgY, imgX + imgW, imgY + imgR);
      ctx.lineTo(imgX + imgW, imgY + imgH - imgR);
      ctx.quadraticCurveTo(imgX + imgW, imgY + imgH, imgX + imgW - imgR, imgY + imgH);
      ctx.lineTo(imgX + imgR, imgY + imgH);
      ctx.quadraticCurveTo(imgX, imgY + imgH, imgX, imgY + imgH - imgR);
      ctx.lineTo(imgX, imgY + imgR);
      ctx.quadraticCurveTo(imgX, imgY, imgX + imgR, imgY);
      ctx.closePath();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Typography
    ctx.fillStyle = '#8B9BAA';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('⚡ SHITMARKET TACTICAL INTEL', 80, 85);

    // Main header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 10;
    ctx.fillText(isNewRoom ? 'NEW ARENA SECURED' : 'WAR ORDER DEPLOYED', 80, 145);
    ctx.shadowBlur = 0;

    // Ticker ($TKN) with Massive Neon Glow
    ctx.fillStyle = primaryColor;
    ctx.font = '900 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 30;
    const tickerText = tokenSymbol.startsWith('$') ? tokenSymbol.toUpperCase() : `$${tokenSymbol.toUpperCase()}`;
    ctx.fillText(tickerText, 76, 245);
    ctx.shadowBlur = 0;

    // Alliance stance
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    const allianceLabel = 'ALLIANCE: ';
    ctx.fillText(allianceLabel, 80, 310);
    const labelW = ctx.measureText(allianceLabel).width;

    ctx.fillStyle = primaryColor;
    ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(isMoon ? 'MOON SQUAD 🚀' : 'JEET CARTEL 💀', 80 + labelW, 312);

    // 7. Sharp Stats Glass Panel
    const statsY = 350;
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(80, statsY, 560, 150);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(80, statsY, 560, 150);

    const LINE = 32;
    let lineY = statsY + 36;
    const leftPad = 100;
    const durationStr = formatDurationText(duration);
    const expiryStr = formatExactExpiry(expiry);

    // Helper for key-value rendering inside stats box
    const drawStat = (key: string, value: string, isAccent = false) => {
      ctx.fillStyle = '#A0AAB5';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(key, leftPad, lineY);
      const kWidth = ctx.measureText('ROUND DURATION: ').width; // uniform alignment

      ctx.fillStyle = isAccent ? primaryColor : '#FFFFFF';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(value, leftPad + kWidth, lineY);
      lineY += LINE;
    };

    if (!isNewRoom) drawStat('STAKE AMOUNT  : ', `${amount.toFixed(2)} SOL`, true);
    if (openingPrice) drawStat('ENTRY PRICE   : ', formatPriceForDisplay(openingPrice), true);
    drawStat('ROUND DURATION: ', durationStr);
    drawStat('DETONATION AT : ', expiryStr);

    // 8. Bottom Action Banner
    const footerY = 530;
    ctx.fillStyle = primaryColor;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 20;
    ctx.fillRect(30, footerY, 1140, 70);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#000000';
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const ctaText = 'ENLIST ON THE FRONT LINES ➔';
    ctx.fillText(ctaText, 80, footerY + 44);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    const ctaW = ctx.measureText(ctaText).width;
    ctx.fillText(referralLink, 80 + ctaW + 20, footerY + 43);

  }, [shareCardData, generating, memeImg, referralLink, referralCode, fontsLoaded]);

  if (!shareCardData) return null;

  // ONE-CLICK SHARE: copy card image to clipboard AND open Twitter with text pre-filled.
  // Twitter's compose box reads image/png from clipboard — user just pastes (CMD+V) the card.
  const handleCopyAndPost = async () => {
    if (!canvasRef.current || copying) return;
    setCopying(true);
    synthSound('bet');

    const { side, tokenSymbol, duration, roomId } = shareCardData!;
    const durationStr = formatDurationText(duration);
    const funnyText = getFunnyQuote(side, tokenSymbol, durationStr, roomId);
    const uniqueRoomLink = `${window.location.origin}/room/${roomId}?ref=${referralCode}`;
    const tweetText = `${funnyText}\n\n⚔️ ${uniqueRoomLink}\n\n@shitmarketlol`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    try {
      await new Promise<void>((resolve) => {
        canvasRef.current!.toBlob(async (blob) => {
          if (blob) {
            try {
              // Copy image to clipboard so user can CMD+V it into the Twitter compose box
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch (clipErr) {
              console.warn('Image clipboard write failed:', clipErr);
            }
          }
          resolve();
        }, 'image/png');
      });
    } catch (e) {
      console.warn('toBlob failed:', e);
    }

    // Open Twitter compose with text pre-filled
    window.open(twitterUrl, '_blank');
    setCopied(true);
    synthSound('victory');
    setTimeout(() => setCopied(false), 3500);
    setCopying(false);
  };

  const handleDownloadImage = () => {
    if (!canvasRef.current || downloading) return;
    setDownloading(true);
    synthSound('bet');

    try {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `shitmarket-bet-${shareCardData.tokenSymbol.toLowerCase()}-${shareCardData.side}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      synthSound('victory');
    } catch (e) {
      console.error("Card download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  const isMoonTheme = shareCardData.side === 'moon';
  const themeGlow = isMoonTheme ? 'border-neon-moon shadow-glow-moon' : 'border-jeet-red shadow-glow-jeet';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none overflow-y-auto">
      <div className={`w-full max-w-2xl bg-trench-mud border-4 rounded-xl p-6 relative scanlines flex flex-col items-center gap-4 ${themeGlow} animate-fadeIn`}>
        
        {/* Dismiss Button */}
        <button
          onClick={() => {
            const redirectUrl = shareCardData?.onCloseRedirectUrl;
            setShareCardData(null);
            synthSound('defeat');
            // Clear the sessionStorage fallback — we're navigating directly now
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('shitmarket_pending_room');
            }
            if (redirectUrl) {
              router.push(redirectUrl);
            }
          }}
          className="absolute top-4 right-4 text-trench-gasmask hover:text-white transition-colors"
          title="Dismiss card telemetry"
        >
          <X size={24} />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <h3 className="font-staatliches text-3xl text-white tracking-widest flex items-center justify-center gap-1.5 uppercase StencilShadow">
            <Sparkles className={isMoonTheme ? 'text-neon-moon' : 'text-jeet-red'} size={24} />
            WAR ROOM TRANSMISSION READY
          </h3>
          <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold mt-1 tracking-widest">
            FANCY CARDS PREPARED FOR TWITTER X SOCIAL BROADCAST
          </p>
        </div>

        {/* Image Preview Canvas container */}
        <div className="w-full relative bg-trench-black border border-trench-sandbag rounded-lg overflow-hidden flex items-center justify-center min-h-[180px] p-2 shadow-inner">
          
          {/* Canvas doing actual rendering, hidden from layout flow but resized visually via CSS */}
          <canvas
            ref={canvasRef}
            width={1200}
            height={630}
            className={`w-full max-w-xl h-auto border-2 rounded ${
              isMoonTheme ? 'border-neon-moon/30' : 'border-jeet-red/30'
            } ${generating ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          />

          {generating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-trench-gasmask uppercase font-mono text-xs font-bold animate-pulse">
              <Loader2 className="animate-spin text-neon-moon mb-1" size={28} />
              <span>SYNDICATING BATTLE REPORT GRAPHICS...</span>
            </div>
          )}
        </div>

        {/* Modal Actions — 2 buttons: primary share + download */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">

          {/* PRIMARY: Copy card to clipboard + open Twitter with text pre-filled */}
          <button
            onClick={handleCopyAndPost}
            disabled={generating || copying}
            className={`py-3 px-4 font-staatliches text-xl uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 border-b-4 active:translate-y-1 active:border-b-0 ${
              isMoonTheme
                ? 'bg-neon-moon text-trench-black border-green-800 hover:bg-[#34e213] shadow-glow-moon'
                : 'bg-jeet-red text-white border-red-950 hover:bg-red-700 shadow-glow-jeet'
            }`}
          >
            {copying ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>OPENING X...</span>
              </>
            ) : copied ? (
              <>
                <Check size={17} />
                <span>CARD COPIED — PASTE IT!</span>
              </>
            ) : (
              <>
                <Copy size={17} />
                <span>COPY CARD + POST TO X</span>
              </>
            )}
          </button>

          {/* Download Card */}
          <button
            onClick={handleDownloadImage}
            disabled={generating || downloading}
            className="py-3 px-4 bg-trench-black border border-trench-sandbag text-white font-staatliches text-xl uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 border-b-4 active:translate-y-1 active:border-b-0 hover:bg-white/5"
          >
            {downloading ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>SAVING...</span>
              </>
            ) : (
              <>
                <Download size={17} />
                <span>DOWNLOAD CARD</span>
              </>
            )}
          </button>

        </div>

        <p className="font-mono text-[9px] text-trench-gasmask uppercase font-bold text-center mt-1 leading-relaxed max-w-md">
          🐦 TWITTER OPENS WITH TWEET TEXT PRE-FILLED. CARD IS COPIED TO CLIPBOARD — JUST PASTE (CMD+V) THE IMAGE INTO THE COMPOSE BOX AND HIT POST.
        </p>

      </div>
    </div>
  );
};
