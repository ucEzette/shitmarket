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

    const { roomId, side, tokenSymbol, duration, amount, isNewRoom, expiry, openingPrice } = shareCardData;
    const isMoon = side === 'moon';

    // 1. Draw Background Gradient (Premium neutral dark charcoal-black, no green background tint)
    const grad = ctx.createRadialGradient(600, 315, 50, 600, 315, 700);
    grad.addColorStop(0, '#111318'); // dark charcoal
    grad.addColorStop(1, '#07080b'); // rich black
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Draw CRT Grid Overlay
    ctx.strokeStyle = isMoon ? 'rgba(57, 255, 20, 0.035)' : 'rgba(255, 7, 58, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 630);
      ctx.stroke();
    }
    for (let y = 0; y < 630; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }

    // 3. Draw Outer Neon Border
    ctx.strokeStyle = isMoon ? '#39FF14' : '#FF073A';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 1160, 590);

    // Draw Inner border
    ctx.strokeStyle = isMoon ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 7, 58, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, 1136, 566);

    // 4. Draw Glow behind Meme Image
    const glowGrad = ctx.createRadialGradient(930, 290, 50, 930, 290, 250);
    glowGrad.addColorStop(0, isMoon ? 'rgba(57, 255, 20, 0.12)' : 'rgba(255, 7, 58, 0.12)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(930, 290, 250, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Meme Image (with rounded corners)
    if (memeImg) {
      ctx.save();
      ctx.beginPath();
      
      // Draw rounded rectangle clip path
      const rx = 740, ry = 100, rw = 380, rh = 380, radius = 24;
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(memeImg, rx, ry, rw, rh);
      ctx.restore();

      // Image Neon Border Outlining
      ctx.strokeStyle = isMoon ? '#39FF14' : '#FF073A';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // 6. Draw Text telemetries
    // Sub-header details
    ctx.fillStyle = '#8c9e88';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('SHITMARKET PvP TELEMETRY // INTEL REPORT', 70, 75);

    // Main header Action (using clean industry standard Apple/system font!)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    if (isNewRoom) {
      ctx.fillText('NEW ARENA DEPLOYED!', 70, 140);
    } else {
      ctx.fillText('WAR ORDER BROADCASTED!', 70, 140);
    }

    // Ticker ($TKN) (using clean system font)
    ctx.fillStyle = isMoon ? '#39FF14' : '#FF073A';
    ctx.font = '800 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const tickerText = tokenSymbol.startsWith('$') ? tokenSymbol.toUpperCase() : `$${tokenSymbol.toUpperCase()}`;
    ctx.fillText(tickerText, 70, 230);

    // Alliance stance (prevent overlap by measuring label and placing value dynamically)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    const allianceLabel = 'ALLIANCE: ';
    ctx.fillText(allianceLabel, 70, 295);
    const labelWidth = ctx.measureText(allianceLabel).width;

    ctx.fillStyle = isMoon ? '#39FF14' : '#FF073A';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(isMoon ? 'MOON ARMY 🚀' : 'JEET SQUAD 💀', 70 + labelWidth, 295);

    // Stats Layout with Detonation expiry date/time
    ctx.fillStyle = '#e4ece3';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    const durationStr = formatDurationText(duration);
    const expiryStr = formatExactExpiry(expiry);

    // ─── Stats block — tight 26px line spacing so everything clears the footer ───
    // Footer banner sits at y=542. Description box (80px) + separator needs to fit above it.
    // Hard cap: splitY ≤ 455 so descBoxY+80 ≤ 535, safely above 542.
    const LINE = 26; // tight line height
    let lineY = isNewRoom ? 325 : 315;

    if (!isNewRoom) {
      ctx.fillStyle = '#e4ece3';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText(`STAKE AMOUNT : ${amount.toFixed(2)} SOL`, 70, lineY);
      lineY += LINE;
    }

    if (openingPrice !== undefined && openingPrice > 0) {
      // Entry price label in neutral + value in accent
      ctx.fillStyle = '#e4ece3';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText('ENTRY PRICE  : ', 70, lineY);
      const epLabelW = ctx.measureText('ENTRY PRICE  : ').width;
      ctx.fillStyle = isMoon ? '#39FF14' : '#FF073A';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(formatPriceForDisplay(openingPrice), 70 + epLabelW, lineY);
      lineY += LINE - 2;
      // Direction sub-label
      ctx.fillStyle = '#8c9e88';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(isMoon ? '↑ WILL END ABOVE THIS PRICE' : '↓ WILL DUMP BELOW THIS PRICE', 70, lineY);
      lineY += LINE;
    }

    ctx.fillStyle = '#e4ece3';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(`ROUND LENGTH : ${durationStr}`, 70, lineY);
    lineY += LINE;
    ctx.fillText(`DETONATION   : ${expiryStr}`, 70, lineY);

    // Cap splitY so desc box + footer never overlap
    const splitY = Math.min(lineY + 18, 455);

    // Horizontal Split separator line
    ctx.strokeStyle = isMoon ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 7, 58, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, splitY);
    ctx.lineTo(680, splitY);
    ctx.stroke();

    // 7. Funny description box — fixed height 80px, always ends at or before y=535
    const descBoxY = splitY + 8;
    const descBoxH = 80;
    ctx.fillStyle = isMoon ? 'rgba(57, 255, 20, 0.04)' : 'rgba(255, 7, 58, 0.04)';
    ctx.fillRect(70, descBoxY, 610, descBoxH);
    ctx.strokeStyle = isMoon ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 7, 58, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(70, descBoxY, 610, descBoxH);

    // Render customized funny text — up to 3 lines, centred in the box
    const funnyText = getFunnyQuote(side, tokenSymbol, durationStr, roomId);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';

    // Wrapping helper
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur + w + ' ';
        if (ctx.measureText(test).width < maxWidth) {
          cur = test;
        } else {
          lines.push(cur.trim());
          cur = w + ' ';
        }
      }
      lines.push(cur.trim());
      return lines;
    };

    const funnyLines = wrapText(funnyText, 570);
    // Centre the text lines vertically within the box
    const maxLines = 3;
    const lineH = 20;
    const textBlockH = Math.min(funnyLines.length, maxLines) * lineH;
    let startY = descBoxY + (descBoxH - textBlockH) / 2 + lineH - 4;
    funnyLines.slice(0, maxLines).forEach((line) => {
      ctx.fillText(line, 90, startY);
      startY += lineH;
    });

    // 8. Referral Footer Banner Box
    ctx.fillStyle = isMoon ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 7, 58, 0.08)';
    ctx.fillRect(36, 542, 1128, 48);
    
    ctx.strokeStyle = isMoon ? '#39FF14' : '#FF073A';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 542, 1128, 48);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '400 18px "JetBrains Mono", monospace';
    ctx.fillText('ENLIST ON THE FRONT LINES:', 56, 572);

    ctx.fillStyle = isMoon ? '#39FF14' : '#FF073A';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(referralLink, 345, 572);

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
