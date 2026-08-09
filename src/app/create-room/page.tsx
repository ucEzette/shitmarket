'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState, Room, detectCategory, formatPrice, formatCashtag } from '@/store/useAppState';
import { getAnchorProgram, getPlatformConfigPda } from '@/utils/solanaClient';
import { PublicKey } from '@solana/web3.js';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { INDEXER_URL } from '@/utils/config';
import { 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  Coins, 
  ArrowRight, 
  ArrowLeft,
  Scale,
  Brain,
  TrendingUp,
  UserCheck,
  Globe,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Zap,
  HelpCircle,
  FileText,
  Check,
  Flame,
  Bomb,
  Layers,
  CheckCircle2,
  X
} from 'lucide-react';

const PRESET_AVATARS = [
  { id: 'pepe-chad', name: 'Giga Pepe', url: '/pepes/pepe-few-understand.png' },
  { id: 'wojak-neon', name: 'Cyber Wojak', url: '/pepes/pepe-wojak-neon.png' },
  { id: 'crypto-bunker', name: 'Bunker HQ', url: '/pepes/pepe-crypto-bunker.png' },
  { id: 'diamond-hands', name: 'Diamond Hands', url: '/pepes/pepe-diamond-hands.png' },
  { id: 'jeet-skull', name: 'Jeet Skeleton', url: '/pepes/jeet-skeleton.png' },
  { id: 'general-ape', name: 'General Pepe', url: '/pepes/pepe-general.png' }
];

export default function CreateRoomPage() {
  const router = useRouter();
  const { createRoom, user, connectWallet, placeBet, isTransactionLoading, wallet, showAlert } = useAppState();

  useEffect(() => {
    const pendingRoom = sessionStorage.getItem('shitmarket_pending_room');
    if (pendingRoom) {
      sessionStorage.removeItem('shitmarket_pending_room');
      router.replace(`/room/${pendingRoom}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wizard Step State
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State - Type & Target Definition
  const [arenaType, setArenaType] = useState<'token' | 'debate'>('token');
  const [contractAddress, setContractAddress] = useState('');
  const [debateName, setDebateName] = useState('');
  const [debateSymbol, setDebateSymbol] = useState('');
  const [customIcon, setCustomIcon] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State - Oracle Selection
  const [selectedOracleId, setSelectedOracleId] = useState<string>('price');
  const [oracleType, setOracleType] = useState<'price' | 'ai' | 'custom'>('price');
  const [customOracleAddress, setCustomOracleAddress] = useState('');
  const [oracleFeeSol, setOracleFeeSol] = useState<number>(0);
  const [resolutionCriteria, setResolutionCriteria] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  
  // Platform Keeper address cached
  const [keeperAddress, setKeeperAddress] = useState('');

  // Form State - Outcome labels (moon/jeet or yes/no)
  const [moonLabel, setMoonLabel] = useState('MOON');
  const [jeetLabel, setJeetLabel] = useState('JEET');

  // Form State - Config & Seeding
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
    const tzOffset = defaultDate.getTimezoneOffset() * 60000;
    return new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [seedAmount, setSeedAmount] = useState<number>(10);
  const [openingPriceType, setOpeningPriceType] = useState<'market' | 'set'>('market');
  const [customSetPrice, setCustomSetPrice] = useState<string>('');

  // Pump.fun style First Buy / Dev Snipe state (anti-frontrun)
  const [enableFirstBuy, setEnableFirstBuy] = useState<boolean>(false);
  const [snipeSide, setSnipeSide] = useState<'moon' | 'jeet'>('moon');
  const [snipeAmount, setSnipeAmount] = useState<number>(0);

  useEffect(() => {
    if (arenaType === 'token') {
      setMoonLabel('MOON');
      setJeetLabel('JEET');
    } else {
      setMoonLabel('YES');
      setJeetLabel('NO');
    }
  }, [arenaType]);

  // Available Oracles Specification Grid
  const AVAILABLE_ORACLES = [
    {
      id: 'price',
      name: 'Automated Price Feed (Pyth / Chainlink)',
      type: 'price',
      icon: TrendingUp,
      badge: 'Trustless & Instant',
      badgeColor: 'border-neon-moon/60 text-neon-moon bg-neon-moon/10',
      description: 'Settles automatically using Pyth Network, Chainlink, and DexScreener TWAP pricing. Fully decentralized with zero human intervention.',
      feeSol: 0,
      address: '0x0000000000000000000000000000000000000000',
      suitability: 'Token Price Battles & Market Metrics',
      resolutionSpeed: '< 5 Seconds',
      trustModel: 'Cryptographic Feeds'
    },
    {
      id: 'ai-sonnet',
      name: 'Claude 3.5 Sonnet AI Resolver',
      type: 'ai',
      icon: Brain,
      badge: 'Autonomous AI Agent',
      badgeColor: 'border-cyan-500/60 text-cyan-400 bg-cyan-950/40',
      description: 'Autonomous resolution powered by background Claude 3.5 agent. Scans specified reference URLs, X (Twitter), news feeds, and APIs to evaluate conditions.',
      feeSol: 0.005,
      address: keeperAddress || 'Keeper Default Key',
      suitability: 'Real-World Events & Qualitative Statements',
      resolutionSpeed: '1 - 2 Minutes Post-Expiry',
      trustModel: 'LLM Verification & Web Scraping'
    },
    {
      id: 'ai-consensus',
      name: 'Multi-Model AI Consensus (Claude + GPT-4o)',
      type: 'ai',
      icon: Sparkles,
      badge: 'Multi-Agent Quorum',
      badgeColor: 'border-purple-500/60 text-purple-400 bg-purple-950/40',
      description: 'Queries multiple independent LLMs (Claude 3.5 Sonnet + GPT-4o) and resolves based on strict majority vote. Eliminates single-model hallucination risk.',
      feeSol: 0.01,
      address: keeperAddress || 'Keeper Default Key',
      suitability: 'High-Stakes Prediction Markets & Complex Topics',
      resolutionSpeed: '2 - 3 Minutes Post-Expiry',
      trustModel: 'Multi-Model Majority Agreement'
    },
    {
      id: 'dao-jury',
      name: 'Community DAO Jury',
      type: 'custom',
      icon: Globe,
      badge: 'Democratic Governance',
      badgeColor: 'border-yellow-500/60 text-yellow-400 bg-yellow-950/40',
      description: 'Democratic resolution executed by community token holders. 24-hour voting period where participants stake tokens to verify market outcome.',
      feeSol: 0.015,
      address: '0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6',
      suitability: 'Community Disputes & Subjective Criteria',
      resolutionSpeed: '24 Hour Voting Window',
      trustModel: 'Staked Token Governance'
    },
    {
      id: 'custom',
      name: 'Custom Escrow Arbitrator Key',
      type: 'custom',
      icon: UserCheck,
      badge: 'Designated Signer',
      badgeColor: 'border-emerald-500/60 text-emerald-400 bg-emerald-950/40',
      description: 'Assign any custom EVM or Solana public key as the authorized arbitrator. You set the resolver reward fee paid upon settlement.',
      feeSol: oracleFeeSol || 1,
      address: customOracleAddress || 'User Defined Public Key',
      suitability: 'P2P Private Wagers & Tournament Arbitrators',
      resolutionSpeed: 'Manual Signer Invocation',
      trustModel: 'Single Designated Key'
    }
  ];

  const handleSelectArenaType = (type: 'token' | 'debate') => {
    setArenaType(type);
    synthSound('bet');
    if (type === 'debate') {
      setSelectedOracleId('ai-sonnet');
      setOracleType('ai');
      setOracleFeeSol(0.005);
    } else {
      setSelectedOracleId('price');
      setOracleType('price');
      setOracleFeeSol(0);
    }
  };

  const handleSelectOracle = (oracle: typeof AVAILABLE_ORACLES[number]) => {
    setSelectedOracleId(oracle.id);
    setOracleType(oracle.type as any);
    if (oracle.id === 'custom') {
      setOracleFeeSol(1);
    } else {
      setOracleFeeSol(oracle.feeSol);
    }
    if (oracle.id === 'dao-jury') {
      setCustomOracleAddress('0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6');
    } else if (oracle.id !== 'custom') {
      setCustomOracleAddress('');
    }
    synthSound('bet');
  };

  // Canvas Image Compression Helper (Max 256x256 Base64 Data URI)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert('PLEASE SELECT A VALID IMAGE FILE (PNG, JPG, WEBP, SVG)!', 'error', 'INVALID FORMAT');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showAlert('MAX IMAGE FILE SIZE IS 5MB!', 'warning', 'FILE TOO LARGE');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/png', 0.85);
        setCustomIcon(compressedDataUrl);
        synthSound('victory');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Fetch keeper address for default AI oracle signer
  useEffect(() => {
    const loadKeeper = async () => {
      try {
        const program = getAnchorProgram(null as any);
        const configPda = getPlatformConfigPda();
        const configAcc: any = await (program.account as any).platformConfig.fetch(configPda);
        if (configAcc && configAcc.keeper) {
          setKeeperAddress(typeof configAcc.keeper.toBase58 === 'function' ? configAcc.keeper.toBase58() : String(configAcc.keeper));
        }
      } catch (err) {
        console.warn("Failed to fetch keeper address, using default...", err);
      }
    };
    loadKeeper();
  }, []);

  // Scanner Loading and Results
  const [scanning, setScanning] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    icon: string;
    liquidity: string;
    priceUsd: string;
    fdv: string;
    volume24h: string;
    rawLiquidity?: number;
    rawFdv?: number;
    chainId?: string;
    pairAddress?: string;
    rawPriceUsd?: number;
  } | null>(null);

  const handleScan = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e?.currentTarget.getBoundingClientRect();
    if (!contractAddress.trim()) {
      showAlert('ENTER A VALID TOKEN CONTRACT ADDRESS!', 'error', 'SCAN ERROR', undefined, rect);
      return;
    }

    setScanning(true);
    synthSound('bet');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${contractAddress.trim()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (data && data.pairs && data.pairs.length > 0) {
        const sortedPairs = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const pair = sortedPairs[0];
        
        const formatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        });
        
        const priceFormatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });

        // Validate via indexer API
        try {
          const valRes = await fetch(`${INDEXER_URL}/api/rooms/validate?mint=${contractAddress.trim()}`);
          if (valRes.ok) {
            const valData = await valRes.json();
            if (!valData.valid) {
              showAlert(`TOKEN SECURITY SCREENING FAILED: ${valData.reason}`, 'error', 'SECURITY EXCLUSION', undefined, rect);
              setTokenInfo(null);
              return;
            }
          }
        } catch (valErr) {
          console.warn("Could not reach validation server, proceeding with caution...", valErr);
        }

        const rawPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
        setTokenInfo({
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          icon: pair.info?.imageUrl ? pair.info.imageUrl : '📊',
          liquidity: pair.liquidity?.usd ? `${formatter.format(pair.liquidity.usd)}` : 'UNKNOWN',
          priceUsd: pair.priceUsd ? priceFormatter.format(parseFloat(pair.priceUsd)) : 'UNKNOWN',
          fdv: pair.fdv ? formatter.format(pair.fdv) : 'UNKNOWN',
          volume24h: pair.volume?.h24 ? formatter.format(pair.volume.h24) : 'UNKNOWN',
          rawLiquidity: pair.liquidity?.usd,
          rawFdv: pair.fdv,
          chainId: pair.chainId,
          pairAddress: pair.pairAddress,
          rawPriceUsd: rawPrice
        });
        setCustomSetPrice(rawPrice.toString());
        
        synthSound('victory');
      } else {
        showAlert('NO PAIRS FOUND ON DEXSCREENER FOR THIS ADDRESS!', 'warning', 'NO TRADING PAIRS', undefined, rect);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error(e);
      if (e.name === 'AbortError') {
        showAlert('API SCAN TIMED OUT. SECURE CONNECTION AND TRY AGAIN!', 'warning', 'SCAN TIMEOUT', undefined, rect);
      } else {
        showAlert('ERROR FETCHING FROM DEXSCREENER!', 'error', 'SCAN ERROR', undefined, rect);
      }
    } finally {
      setScanning(false);
    }
  };

  // Expiry configuration helpers
  const getExpiryHours = (): number => {
    const diffMs = new Date(expiryDate).getTime() - Date.now();
    return Math.max(0, diffMs / (60 * 60 * 1000));
  };

  const sliderValToHours = (v: number): number => {
    if (v <= 25) {
      return Math.round(1 + (v / 25) * 23);
    } else if (v <= 50) {
      return Math.round(24 + ((v - 25) / 25) * 144);
    } else if (v <= 75) {
      return Math.round(168 + ((v - 50) / 25) * (720 - 168));
    } else {
      return Math.round(720 + ((v - 75) / 25) * (8760 - 720));
    }
  };

  const hoursToSliderVal = (h: number): number => {
    if (h <= 24) {
      return ((Math.max(1, h) - 1) / 23) * 25;
    } else if (h <= 168) {
      return 25 + ((h - 24) / 144) * 25;
    } else if (h <= 720) {
      return 50 + ((h - 168) / (720 - 168)) * 25;
    } else {
      return 75 + ((h - 720) / (8760 - 720)) * 25;
    }
  };

  const handleSliderChange = (valPercent: number) => {
    const hours = sliderValToHours(valPercent);
    const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    const tzOffset = targetDate.getTimezoneOffset() * 60000;
    const dateStr = new Date(targetDate.getTime() - tzOffset).toISOString().slice(0, 16);
    setExpiryDate(dateStr);
  };

  const handlePresetSelect = (hours: number) => {
    const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    const tzOffset = targetDate.getTimezoneOffset() * 60000;
    const dateStr = new Date(targetDate.getTime() - tzOffset).toISOString().slice(0, 16);
    setExpiryDate(dateStr);
    synthSound('bet');
  };

  const nextStep = () => {
    if (step === 1) {
      if (arenaType === 'token' && !tokenInfo) {
        showAlert('MUST SCAN A VALID TOKEN CONTRACT FIRST!', 'warning', 'ACTION BLOCKED');
        return;
      }
      if (arenaType === 'debate') {
        if (!debateName.trim()) {
          showAlert('PLEASE SPECIFY PREDICTION STATEMENT / TITLE!', 'warning', 'VALIDATION ERROR');
          return;
        }
        if (!debateSymbol.trim()) {
          showAlert('PLEASE SPECIFY A TICKER SYMBOL!', 'warning', 'VALIDATION ERROR');
          return;
        }
      }
    }
    if (step === 2) {
      if (oracleType === 'ai' && !resolutionCriteria.trim()) {
        showAlert('PLEASE SPECIFY RESOLUTION RULES FOR THE AI RESOLVER!', 'warning', 'VALIDATION ERROR');
        return;
      }
      if (oracleType === 'custom') {
        if (!customOracleAddress.trim()) {
          showAlert('PLEASE SPECIFY A CUSTOM ARBITRATOR WALLET ADDRESS!', 'warning', 'VALIDATION ERROR');
          return;
        }
      }
    }
    synthSound('bet');
    setStep((step + 1) as any);
  };

  const prevStep = () => {
    synthSound('bet');
    setStep((step - 1) as any);
  };

  // Auto-fill prompt rule templates
  const applyTemplate = (templateType: 'target' | 'web' | 'binary') => {
    synthSound('bet');
    const symbolStr = arenaType === 'token' ? (tokenInfo?.symbol || 'TKN') : (debateSymbol || 'EVENT');
    if (templateType === 'target') {
      setResolutionCriteria(`Resolves MOON if $${symbolStr} price reaches target metric before market expiry. Resolves JEET if price stays below target or trends downward.`);
    } else if (templateType === 'web') {
      setResolutionCriteria(`Resolves MOON if the specified event is confirmed positive by official reference sources before expiry date. Resolves JEET otherwise.`);
    } else if (templateType === 'binary') {
      setResolutionCriteria(`Resolves MOON if [Statement] evaluates TRUE as per verified news or API feeds. Resolves JEET if FALSE or unconfirmed.`);
    }
  };

  const handleLaunch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    const creatorAddress = wallet?.address || (wallet?.publicKey ? wallet.publicKey.toBase58() : '');

    if (!creatorAddress) {
      showAlert('PLEASE ENLIST YOUR WALLET TO DEPLOY ARENAS!', 'warning', 'WALLET NOT CONNECTED', () => {
        connectWallet();
      }, rect);
      return;
    }

    const selectedExpiry = new Date(expiryDate).getTime();
    const minExpiry = Date.now() + 55 * 60000; // 55 mins buffer
    const maxExpiry = Date.now() + 366 * 24 * 60 * 60000; // 1 year max

    if (selectedExpiry < minExpiry) {
      showAlert('MINIMUM BATTLE DURATION IS 1 HOUR!', 'warning', 'VALIDATION ERROR', undefined, rect);
      return;
    }

    if (selectedExpiry > maxExpiry) {
      showAlert('MAXIMUM BATTLE DURATION IS 1 YEAR!', 'warning', 'VALIDATION ERROR', undefined, rect);
      return;
    }

    if (seedAmount < 1) {
      showAlert('MINIMUM ARENA SEEDING IS 1 USDC!', 'warning', 'VALIDATION ERROR', undefined, rect);
      return;
    }

    const isEvm = process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche';
    const creationFeeUsdc = isEvm ? 3 : 0;
    const actualSnipeAmount = (enableFirstBuy && snipeAmount > 0) ? snipeAmount : 0;
    const totalRequiredUsdc = creationFeeUsdc + seedAmount + actualSnipeAmount;

    if (user && user.balance < totalRequiredUsdc) {
      showAlert(
        `INSUFFICIENT USDC AMMO BALANCE! Need at least ${totalRequiredUsdc} USDC (${creationFeeUsdc > 0 ? `$${creationFeeUsdc} creation fee + ` : ''}$${seedAmount} seed liquidity${actualSnipeAmount > 0 ? ` + $${actualSnipeAmount} first buy` : ''}).`,
        'error',
        'INSUFFICIENT FUNDS',
        undefined,
        rect
      );
      return;
    }

    // Determine Oracle parameters
    let finalOracleAddress = '0x0000000000000000000000000000000000000000';
    let finalOracleFeeLamports = 0;
    let finalCriteriaText = '';

    if (selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus') {
      finalOracleAddress = keeperAddress || creatorAddress;
      finalOracleFeeLamports = Math.round(oracleFeeSol * 1e6); // 6 decimals for USDC
      finalCriteriaText = resolutionCriteria.trim();
      if (selectedOracleId === 'ai-consensus') {
        finalCriteriaText = `[AI CONSENSUS CONTEXT] ${finalCriteriaText}`;
      }
      if (referenceUrl.trim()) {
        finalCriteriaText += ` | Ref: ${referenceUrl.trim()}`;
      }
    } else if (selectedOracleId === 'dao-jury') {
      finalOracleAddress = process.env.NEXT_PUBLIC_CORE_CONTRACT_ADDRESS || '0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6';
      finalOracleFeeLamports = Math.round(oracleFeeSol * 1e6);
      finalCriteriaText = `[DAO JURY PROTOCOL] ${resolutionCriteria.trim()}`;
    } else if (selectedOracleId === 'custom') {
      finalOracleAddress = customOracleAddress.trim();
      finalOracleFeeLamports = Math.round(oracleFeeSol * 1e6);
      finalCriteriaText = resolutionCriteria.trim();
    }

    // Build standard or debate token metadata
    let tokenAddress = contractAddress.trim();
    let tokenNameStr = tokenInfo?.name || debateName.trim();
    let tokenSymbolStr = tokenInfo?.symbol || debateSymbol.trim().toUpperCase();
    let tokenIconStr = tokenInfo?.icon || customIcon;
    let chainIdStr = tokenInfo?.chainId || (process.env.NEXT_PUBLIC_CORE_CHAIN || 'avalanche');

    if (arenaType === 'debate') {
      tokenAddress = creatorAddress;
    }

    // Neutral 50/50 starting reserves + optional snipe bonus
    const snipeMoonBonus = (enableFirstBuy && snipeSide === 'moon') ? actualSnipeAmount : 0;
    const snipeJeetBonus = (enableFirstBuy && snipeSide === 'jeet') ? actualSnipeAmount : 0;
    const moonSeed = seedAmount + snipeMoonBonus;
    const jeetSeed = seedAmount + snipeJeetBonus;

    const targetOpeningPrice = arenaType === 'debate' 
      ? 1.0 
      : (openingPriceType === 'set' ? parseFloat(customSetPrice) : tokenInfo?.rawPriceUsd || 0);

    const generatedId = String(Date.now());

    const computedDuration = Math.max(60, Math.floor((selectedExpiry - Date.now()) / 60000));
    const finalExpiryMs = Date.now() + computedDuration * 60000;

    const newRoom: Room = {
      id: generatedId,
      category: detectCategory(tokenNameStr, tokenSymbolStr, finalCriteriaText),
      token: {
        address: tokenAddress,
        name: tokenNameStr,
        symbol: tokenSymbolStr,
        icon: tokenIconStr,
        liquidity: tokenInfo?.rawLiquidity || 500000,
        marketCap: tokenInfo?.rawFdv || 1000000,
        chainId: chainIdStr,
        pairAddress: tokenInfo?.pairAddress || ''
      },
      creator: creatorAddress,
      moonPool: moonSeed,
      jeetPool: jeetSeed,
      expiry: finalExpiryMs,
      status: 'active',
      createdAt: Date.now(),
      duration: computedDuration,
      openingPrice: targetOpeningPrice,
      moonLabel: moonLabel || 'MOON',
      jeetLabel: jeetLabel || 'JEET',
      
      // Oracle layer details
      oracleAddress: finalOracleAddress,
      oracleFeeLamports: finalOracleFeeLamports,
      resolutionCriteria: finalCriteriaText
    };

    try {
      const initialSnipe = (enableFirstBuy && snipeAmount > 0) ? { side: snipeSide, amount: snipeAmount } : undefined;
      const res = await createRoom(newRoom, openingPriceType === 'set' || arenaType === 'debate', initialSnipe);
      
      synthSound('explosion');
      if (res && res.alreadyExists) {
        showAlert("PREDICTION ARENA ALREADY EXISTS FOR THIS TOKEN! REDIRECTING...", 'info', 'ARENA FOUND', undefined, rect);
      }
      
      if (res && res.roomPda) {
        router.push(`/room/${res.roomPda}`);
      } else {
        router.push('/rooms');
      }
    } catch (err: any) {
      console.error("Launch Arena transaction failed:", err);
    }
  };

  const renderOracleCard = (oracle: typeof AVAILABLE_ORACLES[number]) => {
    const isSelected = selectedOracleId === oracle.id;
    return (
      <div
        key={oracle.id}
        onClick={() => handleSelectOracle(oracle)}
        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
          isSelected
            ? 'border-emerald-500 bg-emerald-500/[0.04] dark:bg-emerald-950/10'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <input
            type="radio"
            name="oracleOption"
            value={oracle.id}
            checked={isSelected}
            onChange={() => {}}
            className="accent-emerald-500 h-4.5 w-4.5 shrink-0 pointer-events-none"
          />
          <div className="min-w-0">
            <h4 className="font-sans text-sm text-slate-800 dark:text-white font-extrabold tracking-tight uppercase leading-tight">
              {oracle.name}
            </h4>
            <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal truncate">
              {oracle.description}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 ml-4">
          <span className="font-mono text-xs font-bold text-slate-950 dark:text-white block">
            {oracle.feeSol > 0 ? `${oracle.feeSol} USDC` : 'FREE'}
          </span>
          <span className="font-mono text-[9px] text-slate-400 block uppercase">
            ORACLE FEE
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 flex flex-col items-center select-none">
          {/* Main Wizard Container */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-xl overflow-hidden relative text-slate-800 dark:text-white transition-colors duration-200">
        
        {/* Top Gradient Banner & Header */}
        <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="font-sans text-3xl text-slate-900 dark:text-white tracking-tight uppercase font-extrabold flex items-center gap-2">
              CREATE PREDICTION ARENA
            </h1>
            <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
              Create instant prediction markets on live price action or custom qualitative events. Resolved on-chain by automated price feeds or AI oracle nodes.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={42} glowColor="moon" className="rounded-lg" />
            <div>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">CREATOR WALLET</span>
              <span className="font-mono text-xs text-slate-900 dark:text-white font-bold select-all">
                {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'WALLET NOT CONNECTED'}
              </span>
            </div>
          </div>
        </div>
        {/* Step Indicator */}
        <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            
            {/* Step 1 Button */}
            <button
              onClick={() => { if (step > 1) setStep(1); }}
              className={`flex items-center gap-3 transition-all ${step === 1 ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold border transition-all ${
                step === 1
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : step > 1
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
              }`}>
                {step > 1 ? <Check size={18} className="stroke-[3]" /> : '1'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block">STEP 1</span>
                <span className={`font-mono text-xs uppercase block ${step === 1 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                  TARGET MARKET
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-4 transition-colors ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-850'}`} />

            {/* Step 2 Button */}
            <button
              onClick={() => { if (step > 2) setStep(2); }}
              className={`flex items-center gap-3 transition-all ${step === 2 ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold border transition-all ${
                step === 2
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : step > 2
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
              }`}>
                {step > 2 ? <Check size={18} className="stroke-[3]" /> : '2'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block">STEP 2</span>
                <span className={`font-mono text-xs uppercase block ${step === 2 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                  ORACLE PROTOCOL
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-4 transition-colors ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-850'}`} />

            {/* Step 3 Button */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold border transition-all ${
                step === 3
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
              }`}>
                3
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block">STEP 3</span>
                <span className={`font-mono text-xs uppercase block ${step === 3 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                  LIQUIDITY & LAUNCH
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Wizard Form Body */}
        <form onSubmit={handleLaunch} className="p-6 md:p-8">
          
          {/* STEP 1: TARGET MARKET DEFINITION */}
          {step === 1 && (
            <div className="space-y-8 animate-fadeIn">
                          {/* Type Selection Header */}
              <div>
                <h3 className="font-sans text-xl text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2 font-extrabold">
                  <Layers size={22} className="text-emerald-500" />
                  <span>SELECT PREDICTION MARKET STRUCTURE</span>
                </h3>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose between automated token price battles or custom qualitative event markets.
                </p>
              </div>

              {/* Arena Type Toggle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Price Chart Battle Card */}
                <div
                  onClick={() => handleSelectArenaType('token')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                    arenaType === 'token'
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {arenaType === 'token' && (
                    <div className="absolute top-3 right-3 text-emerald-500">
                      <CheckCircle2 size={20} className="fill-emerald-500 text-white" />
                    </div>
                  )}
                  <h4 className="font-sans text-lg text-slate-900 dark:text-white font-extrabold uppercase">PRICE CHART BATTLE</h4>
                  <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Bet on live USD price movements of any token. Uses Pyth & Chainlink feeds to resolve automatically.
                  </p>
                </div>

                {/* Custom Prediction / Debate Card */}
                <div
                  onClick={() => handleSelectArenaType('debate')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                    arenaType === 'debate'
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {arenaType === 'debate' && (
                    <div className="absolute top-3 right-3 text-emerald-500">
                      <CheckCircle2 size={20} className="fill-emerald-500 text-white" />
                    </div>
                  )}
                  <h4 className="font-sans text-lg text-slate-900 dark:text-white font-extrabold uppercase">CUSTOM PREDICTION / DEBATE</h4>
                  <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Create plain-language prediction statements regarding politics, crypto milestones, tech releases, or custom events.
                  </p>
                </div>

              </div>

              {/* Chart Battle Scanner Form */}
              {arenaType === 'token' && (
                <div className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider flex items-center justify-between">
                      <span>Token Contract Address (Solana / EVM):</span>
                      <span className="text-[10px] text-gray-400">DexScreener Verified</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="PASTE TOKEN CONTRACT ADDRESS"
                        value={contractAddress}
                        onChange={(e) => {
                          setContractAddress(e.target.value);
                          setTokenInfo(null);
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none tracking-widest font-bold"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleScan(e)}
                        disabled={scanning || !contractAddress.trim()}
                        className="px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        {scanning ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-white" />
                            <span>SCANNING...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} />
                            <span>SCAN TOKEN</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* DexScreener Validated Card */}
                  {tokenInfo && (
                    <div className="bg-[#05080E] border border-emerald-900/60 rounded-2xl p-5 shadow-inner space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-4 border-b border-gray-800 pb-4">
                        <div className="w-14 h-14 bg-black rounded-xl border border-neon-moon flex items-center justify-center text-3xl overflow-hidden shrink-0">
                          {tokenInfo.icon.startsWith('http') ? (
                            <img src={tokenInfo.icon} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                          ) : (
                            tokenInfo.icon
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-staatliches text-3xl text-white tracking-wide">
                              {tokenInfo.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-neon-moon/40 font-mono text-[10px] text-neon-moon font-extrabold">
                              ${tokenInfo.symbol}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-gray-400 font-bold uppercase block mt-0.5">
                            CHAIN: {tokenInfo.chainId?.toUpperCase() || 'AVALANCHE'} // PAIR: {tokenInfo.pairAddress ? tokenInfo.pairAddress.slice(0, 10) : 'DEX'}...
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-[#0A0F1A] border border-gray-800 rounded-xl p-3">
                          <span className="font-mono text-[9px] text-gray-400 block font-bold">LIVE PRICE</span>
                          <span className="font-mono text-sm text-neon-moon font-extrabold truncate block mt-0.5">{tokenInfo.priceUsd}</span>
                        </div>
                        <div className="bg-[#0A0F1A] border border-gray-800 rounded-xl p-3">
                          <span className="font-mono text-[9px] text-gray-400 block font-bold">DEX LIQUIDITY</span>
                          <span className="font-mono text-sm text-white font-extrabold truncate block mt-0.5">{tokenInfo.liquidity}</span>
                        </div>
                        <div className="bg-[#0A0F1A] border border-gray-800 rounded-xl p-3">
                          <span className="font-mono text-[9px] text-gray-400 block font-bold">24H VOLUME</span>
                          <span className="font-mono text-sm text-white font-extrabold truncate block mt-0.5">{tokenInfo.volume24h}</span>
                        </div>
                        <div className="bg-[#0A0F1A] border border-gray-800 rounded-xl p-3">
                          <span className="font-mono text-[9px] text-gray-400 block font-bold">FDV</span>
                          <span className="font-mono text-sm text-white font-extrabold truncate block mt-0.5">{tokenInfo.fdv}</span>
                        </div>
                      </div>

                      {/* Entry & Strike Price Configuration */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3.5">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 border-b border-slate-800 pb-2.5">
                          <div>
                            <h5 className="font-sans text-xs font-extrabold text-white uppercase tracking-tight flex items-center gap-1.5">
                              <Scale size={14} className="text-emerald-400" />
                              <span>ENTRY & STRIKE PRICE CONFIGURATION</span>
                            </h5>
                            <p className="font-sans text-[11px] text-slate-400 mt-0.5">
                              Specify whether predictions resolve against the live spot price or a custom target strike price.
                            </p>
                          </div>
                          <span className="font-mono text-[9px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 uppercase w-fit">
                            {openingPriceType === 'market' ? '⚡ LIVE SPOT BASELINE' : '🎯 CUSTOM STRIKE TARGET'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Option 1: Live Market Price */}
                          <div
                            onClick={() => {
                              setOpeningPriceType('market');
                              synthSound('bet');
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              openingPriceType === 'market'
                                ? 'border-emerald-500 bg-emerald-950/30 shadow-sm'
                                : 'border-slate-800 bg-black/40 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-sans text-[11px] font-extrabold text-white uppercase flex items-center gap-1">
                                <span>⚡ LIVE MARKET PRICE</span>
                              </span>
                              {openingPriceType === 'market' && <CheckCircle2 size={14} className="text-emerald-400" />}
                            </div>
                            <div className="font-mono text-sm text-neon-moon font-extrabold truncate">
                              {tokenInfo.priceUsd}
                            </div>
                            <p className="font-sans text-[10px] text-slate-400 mt-0.5 leading-tight">
                              Locked at launch. Resolves <strong className="text-emerald-400">{moonLabel}</strong> if higher at expiry, <strong className="text-rose-400">{jeetLabel}</strong> if lower.
                            </p>
                          </div>

                          {/* Option 2: Custom Strike Price */}
                          <div
                            onClick={() => {
                              setOpeningPriceType('set');
                              if (!customSetPrice && tokenInfo.rawPriceUsd) {
                                setCustomSetPrice(tokenInfo.rawPriceUsd.toString());
                              }
                              synthSound('bet');
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              openingPriceType === 'set'
                                ? 'border-emerald-500 bg-emerald-950/30 shadow-sm'
                                : 'border-slate-800 bg-black/40 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-sans text-[11px] font-extrabold text-white uppercase flex items-center gap-1">
                                <span>🎯 CUSTOM TARGET / STRIKE</span>
                              </span>
                              {openingPriceType === 'set' && <CheckCircle2 size={14} className="text-emerald-400" />}
                            </div>
                            <div className="font-mono text-sm text-cyan-400 font-extrabold truncate">
                              ${customSetPrice ? parseFloat(customSetPrice).toLocaleString('en-US', { maximumFractionDigits: 8 }) : '0.00'}
                            </div>
                            <p className="font-sans text-[10px] text-slate-400 mt-0.5 leading-tight">
                              Custom target threshold. Resolves <strong className="text-emerald-400">{moonLabel}</strong> if price reaches target, <strong className="text-rose-400">{jeetLabel}</strong> if not.
                            </p>
                          </div>
                        </div>

                        {/* Custom Price Inputs and Multiplier Chips */}
                        {openingPriceType === 'set' && (
                          <div className="space-y-2.5 pt-2.5 border-t border-slate-800 animate-fadeIn">
                            <div className="space-y-1">
                              <label className="block font-mono text-[10px] font-bold text-slate-300 uppercase">
                                Specify Target Strike Price (USD):
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 font-mono text-xs font-bold text-slate-400">$</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="e.g. 0.00045"
                                  value={customSetPrice}
                                  onChange={(e) => setCustomSetPrice(e.target.value)}
                                  className="w-full pl-7 pr-4 py-2 bg-black border border-slate-700 text-white font-mono text-xs rounded-lg focus:border-emerald-500 focus:outline-none font-bold"
                                />
                              </div>
                            </div>

                            {tokenInfo.rawPriceUsd && tokenInfo.rawPriceUsd > 0 && (
                              <div className="space-y-1">
                                <span className="font-mono text-[9px] text-slate-400 font-bold uppercase block">
                                  QUICK TARGET PRESETS:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { label: '+5% Moon', mult: 1.05 },
                                    { label: '+10% Moon', mult: 1.10 },
                                    { label: '+25% Moon', mult: 1.25 },
                                    { label: '+50% Moon', mult: 1.50 },
                                    { label: '2x Moon (+100%)', mult: 2.00 },
                                    { label: '-10% Jeet (Dip)', mult: 0.90 },
                                    { label: 'Spot Baseline', mult: 1.00 },
                                  ].map((p) => (
                                    <button
                                      key={p.label}
                                      type="button"
                                      onClick={() => {
                                        const targetP = (tokenInfo.rawPriceUsd || 0) * p.mult;
                                        setCustomSetPrice(targetP.toFixed(targetP < 1 ? 8 : 4).replace(/0+$/, '').replace(/\.$/, ''));
                                        synthSound('bet');
                                      }}
                                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-[9px] rounded font-bold transition-all uppercase"
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Debate & Prediction Form */}
              {arenaType === 'debate' && (
                <div className="space-y-6 pt-2">
                  
                  {/* Title / Statement */}
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
                      Prediction Question / Statement Title:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., WILL BITCOIN REACH $100,000 BEFORE DECEMBER 2026?"
                      value={debateName}
                      onChange={(e) => setDebateName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none uppercase tracking-wide font-bold transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
                        Virtual Market Ticker Symbol:
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="e.g., BTC100K"
                        value={debateSymbol}
                        onChange={(e) => setDebateSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none uppercase tracking-widest font-bold transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
                        Market Image / Avatar:
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-xl shadow-md">
                          {customIcon ? (
                            <img 
                              src={customIcon} 
                              alt="Preview" 
                              className="w-full h-full object-cover animate-fadeIn" 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon size={18} className="text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:dark:border-emerald-500 text-slate-700 dark:text-slate-300 font-mono text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-bold"
                        >
                          <Upload size={16} className="text-emerald-500" />
                          <span>UPLOAD CUSTOM IMAGE</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              processImageFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          processImageFile(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isDragOver
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500'
                      }`}
                    >
                      <ImageIcon size={32} className="text-emerald-500 mb-2" />
                      <span className="font-sans text-sm font-extrabold text-slate-800 dark:text-white tracking-wider uppercase">
                        DRAG & DROP CUSTOM MARKET IMAGE HERE
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                        SUPPORTS PNG, JPG, WEBP, SVG (AUTO-COMPRESSED TO INSTANT HIGH-SPEED DATA URL)
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* Custom Outcome Labels Editor */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-sans text-sm text-slate-800 dark:text-white font-extrabold uppercase tracking-wide flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-500" />
                  <span>CUSTOM OUTCOME LABELS</span>
                </h4>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400">
                  Customize outcome names for Side 0 (Bullish/Yes) and Side 1 (Bearish/No).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                      Side 0 Label (Default: {arenaType === 'token' ? 'MOON' : 'YES'})
                    </label>
                    <input
                      type="text"
                      value={moonLabel}
                      onChange={(e) => setMoonLabel(e.target.value.toUpperCase().slice(0, 15))}
                      placeholder={arenaType === 'token' ? 'MOON' : 'YES'}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs rounded-xl focus:border-emerald-500 focus:outline-none uppercase font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                      Side 1 Label (Default: {arenaType === 'token' ? 'JEET' : 'NO'})
                    </label>
                    <input
                      type="text"
                      value={jeetLabel}
                      onChange={(e) => setJeetLabel(e.target.value.toUpperCase().slice(0, 15))}
                      placeholder={arenaType === 'token' ? 'JEET' : 'NO'}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs rounded-xl focus:border-emerald-500 focus:outline-none uppercase font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Beautified Live Room Card Replica Preview */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-4">
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" />
                  <span>LIVE PREVIEW CARD:</span>
                </span>

                <div className="max-w-md mx-auto p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5 mb-3.5">
                    <div className="w-11 h-11 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {arenaType === 'token' && tokenInfo ? (
                        tokenInfo.icon.startsWith('http') ? (
                          <img src={tokenInfo.icon} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{tokenInfo.icon}</span>
                        )
                      ) : customIcon ? (
                        <img
                          src={customIcon}
                          alt="Market"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon size={22} className="text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-sans text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight uppercase">
                        {arenaType === 'token' 
                          ? (tokenInfo?.name || 'PASTE TOKEN ADDRESS')
                          : (debateName.trim() || 'ENTER PREDICTION STATEMENT TITLE')}
                      </h4>
                      <span className="font-mono text-[10px] text-emerald-500 font-extrabold">
                        ${arenaType === 'token' ? (tokenInfo?.symbol || 'TKN') : (debateSymbol.trim() || 'EVENT')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800 p-2.5 rounded-xl text-center font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase mb-3.5">
                    {arenaType === 'token'
                      ? `Will $${tokenInfo?.symbol || 'TKN'} close above ${openingPriceType === 'set' && customSetPrice ? `$${parseFloat(customSetPrice).toLocaleString('en-US', { maximumFractionDigits: 8 })}` : (tokenInfo?.priceUsd || '$0.00')} upon expiry?`
                      : `Will this event resolve to ${moonLabel || 'YES'}?`}
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-sans text-xs">
                    <div className="py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-center rounded-xl font-extrabold uppercase tracking-wide">
                      {moonLabel || 'YES'} 50%
                    </div>
                    <div className="py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-center rounded-xl font-extrabold uppercase tracking-wide">
                      {jeetLabel || 'NO'} 50%
                    </div>
                  </div>
                </div>
              </div>

              {/* Wizard Nav buttons */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 font-mono text-xs text-white rounded-xl tracking-wider flex items-center gap-2 font-bold transition-all uppercase"
                >
                  <span>NEXT: ORACLE PROTOCOL</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CLEAR & EXPLICIT ORACLE SELECTION GRID */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              
              <div>
                <h3 className="font-sans text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                  SELECT RESOLUTION ORACLE PROTOCOL
                </h3>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose the oracle mechanism responsible for settling outcomes on-chain. Every oracle runs transparently.
                </p>
              </div>

              {/* Oracle Selection List */}
              <div className="space-y-2">
                {arenaType === 'token' ? (
                  AVAILABLE_ORACLES
                    .filter(o => o.id === 'price')
                    .map((oracle) => renderOracleCard(oracle))
                ) : (
                  AVAILABLE_ORACLES
                    .filter(o => o.id !== 'price')
                    .map((oracle) => renderOracleCard(oracle))
                )}
              </div>

              {/* AI & Custom Resolution Rules Builder */}
              {(selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus' || selectedOracleId === 'dao-jury' || selectedOracleId === 'custom') && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 animate-fadeIn">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-sans text-sm font-extrabold text-slate-800 dark:text-white tracking-tight uppercase flex items-center gap-2">
                        <FileText size={18} className="text-emerald-500" />
                        <span>ORACLE RESOLUTION RULES & PROMPTS</span>
                      </h4>
                      <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Specify precise evaluation conditions for the oracle node.
                      </p>
                    </div>

                    {/* Pre-filled Templates */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">TEMPLATES:</span>
                      <button
                        type="button"
                        onClick={() => applyTemplate('target')}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] rounded uppercase font-bold transition-all shadow-sm"
                      >
                        Price Target
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTemplate('web')}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-amber-600 dark:text-yellow-400 font-mono text-[9px] rounded uppercase font-bold transition-all shadow-sm"
                      >
                        Web Event
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      required
                      rows={4}
                      placeholder="ENTER PRECISE RESOLUTION CRITERIA... e.g., RESOLVES MOON IF BITCOIN TRADES ABOVE $100K USD BEFORE DEC 2026. RESOLVES JEET OTHERWISE."
                      value={resolutionCriteria}
                      onChange={(e) => setResolutionCriteria(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none uppercase tracking-wide font-bold transition-all"
                    />
                  </div>

                  {/* Reference URL */}
                  {(selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus') && (
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={14} className="text-emerald-500" />
                        <span>Reference URL / Scraper Source (Optional):</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://x.com/realDonaldTrump or official news announcement URL"
                        value={referenceUrl}
                        onChange={(e) => setReferenceUrl(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none font-bold transition-all"
                      />
                    </div>
                  )}

                  {/* Custom Arbitrator Key input */}
                  {selectedOracleId === 'custom' && (
                    <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="space-y-2">
                        <label className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                          Arbitrator Wallet Public Key:
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="PASTE THE ARBITRATOR'S WALLET PUBLIC KEY OR EVM ADDRESS..."
                          value={customOracleAddress}
                          onChange={(e) => setCustomOracleAddress(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 rounded-xl focus:border-emerald-500 focus:outline-none uppercase font-bold transition-all"
                        />
                      </div>

                      {/* Oracle Fee Slider */}
                      <div className="space-y-2 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center">
                          <label className="font-sans text-sm font-extrabold text-slate-800 dark:text-white tracking-tight uppercase">
                            Custom Oracle Resolution Fee:
                          </label>
                          <span className="font-mono text-sm text-amber-600 dark:text-yellow-400 font-extrabold">
                            {oracleFeeSol} USDC
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={oracleFeeSol || 1}
                          onChange={(e) => setOracleFeeSol(parseFloat(e.target.value) || 1)}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <p className="font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold">
                          *Paid directly to the resolver wallet when they invoke settlement. Deducted from winning pool pot.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Wizard Nav buttons */}
              <div className="flex justify-between pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-staatliches text-xl rounded-xl tracking-wider flex items-center gap-2 transition-all uppercase"
                >
                  <ArrowLeft size={18} />
                  <span>BACK</span>
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-8 py-3 bg-neon-moon hover:bg-green-400 text-black font-staatliches text-xl rounded-xl tracking-wider flex items-center gap-2 font-bold transition-all uppercase"
                >
                  <span>NEXT: LIQUIDITY & LAUNCH</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DURATION, LIQUIDITY SEEDING & FIRST BUY (DEV SNIPE) */}
          {step === 3 && (
            <div className="space-y-8 animate-fadeIn">
              
              <div>
                <h3 className="font-sans text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Coins size={22} className="text-emerald-500" />
                  <span>CONFIGURE DURATION, LIQUIDITY & FIRST BUY</span>
                </h3>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Specify market expiry, seed neutral AMM liquidity, and optionally execute a first buy (dev snipe) to protect against front-running.
                </p>
              </div>

              {/* Duration Presets & Slider */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-sans text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Clock size={16} className="text-emerald-500 animate-pulse" />
                    <span>BATTLE EXPIRY DURATION:</span>
                  </label>
                  <span className="font-mono text-xs text-emerald-500 font-extrabold bg-emerald-500/10 px-3 py-1 border border-emerald-500/20 rounded-lg">
                    {(() => {
                      const diffMs = new Date(expiryDate).getTime() - Date.now();
                      const diffMins = Math.max(0, Math.floor(diffMs / 60000));
                      if (diffMins >= 525600) return '1.0 YEAR (MAX)';
                      if (diffMins >= 43200) return `${(diffMins / 43200).toFixed(1)} MONTHS`;
                      if (diffMins >= 10080) return `${(diffMins / 10080).toFixed(1)} WEEKS`;
                      if (diffMins >= 1440) return `${(diffMins / 1440).toFixed(1)} DAYS`;
                      if (diffMins >= 60) return `${(diffMins / 60).toFixed(1)} HOURS`;
                      return `${diffMins} MINS`;
                    })()}
                  </span>
                </div>

                {/* Preset Buttons Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '1 HR', hours: 1 },
                    { label: '12 HRS', hours: 12 },
                    { label: '24 HRS', hours: 24 },
                    { label: '1 WEEK', hours: 168 },
                    { label: '1 MONTH', hours: 720 },
                  ].map((preset) => {
                    const currentHours = getExpiryHours();
                    const isSelected = Math.abs(currentHours - preset.hours) < 0.15;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePresetSelect(preset.hours)}
                        className={`py-2 rounded-xl font-mono text-xs uppercase transition-all border font-bold ${
                          isSelected
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Range Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono font-bold">
                    <span>1 HOUR</span>
                    <span>1 WEEK</span>
                    <span>1 MONTH</span>
                    <span>1 YEAR (MAX)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={hoursToSliderVal(getExpiryHours())}
                    onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Manual Date/Time Picker */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-850">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold uppercase block">
                    MANUAL EXACT EXPIRY TIME (MAX 1 YEAR LIMIT):
                  </span>
                  <input 
                    type="datetime-local"
                    value={expiryDate}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      const selectedTime = new Date(selectedVal).getTime();
                      const maxTime = Date.now() + 365 * 24 * 60 * 60000;
                      if (selectedTime > maxTime) {
                        const maxDate = new Date(maxTime);
                        const tzOffset = maxDate.getTimezoneOffset() * 60000;
                        setExpiryDate(new Date(maxDate.getTime() - tzOffset).toISOString().slice(0, 16));
                      } else {
                        setExpiryDate(selectedVal);
                      }
                    }}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60 * 60000).toISOString().slice(0, 16)}
                    max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 365 * 24 * 60 * 60000).toISOString().slice(0, 16)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs px-4 py-3 rounded-xl focus:border-emerald-500 focus:outline-none font-bold cursor-pointer"
                  />
                </div>
              </div>

              {/* CARD 1: Initial Liquidity Seeding (Neutral 50/50 AMM Pool) */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h4 className="font-sans text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Layers size={18} className="text-emerald-500" />
                      <span>1. INITIAL POOL LIQUIDITY (NEUTRAL SEEDING)</span>
                    </h4>
                    <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Deposit USDC into the AMM liquidity pool. This creates equal 50/50 YES and NO outcome reserves (starting at $0.50 each) and earns you 0.07% claimable fees on all future swaps.
                    </p>
                  </div>
                  <span className="font-mono text-sm text-emerald-500 font-extrabold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 w-fit shrink-0">
                    {seedAmount} USDC (50/50 LP)
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    USDC Liquidity Amount to Seed:
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="ENTER USDC SEED AMOUNT..."
                      value={seedAmount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSeedAmount(isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-emerald-500 focus:outline-none font-bold"
                    />
                    <span className="absolute right-4 font-mono text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase">
                      USDC
                    </span>
                  </div>

                  {/* Quick Seed Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">PRESETS:</span>
                    {[5, 10, 25, 50, 100, 250].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setSeedAmount(amt);
                          synthSound('bet');
                        }}
                        className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all uppercase border ${
                          seedAmount === amt
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-[11px] font-sans text-slate-600 dark:text-slate-300">
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                    <span>
                      <strong>Neutral Seeding:</strong> You do not pick a side here. Your ${seedAmount} USDC mints {seedAmount} {moonLabel} + {seedAmount} {jeetLabel} tokens to bootstrap fair 50/50 trading.
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 2: First Buy / Dev Snipe (Pump.fun Anti-Frontrun Style) */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h4 className="font-sans text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Flame size={18} className="text-amber-500" />
                      <span>2. FIRST BUY / DEV SNIPE (OPTIONAL)</span>
                    </h4>
                    <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Instantly buy outcome shares directly from your seeded pool in the same creation transaction before sniper bots or external traders can front-run your market.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-amber-500 font-extrabold bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 uppercase w-fit shrink-0 flex items-center gap-1">
                    <Zap size={12} />
                    <span>ANTI-FRONTRUN</span>
                  </span>
                </div>

                {/* Enable First Buy Toggle */}
                <div
                  onClick={() => {
                    const nextVal = !enableFirstBuy;
                    setEnableFirstBuy(nextVal);
                    if (nextVal && snipeAmount === 0) {
                      setSnipeAmount(5);
                    }
                    synthSound('bet');
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    enableFirstBuy
                      ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      enableFirstBuy
                        ? 'bg-amber-500 text-black border-amber-500'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'
                    }`}>
                      {enableFirstBuy && <Check size={14} className="stroke-[3]" />}
                    </div>
                    <div>
                      <span className="font-sans text-xs font-extrabold text-slate-900 dark:text-white uppercase block">
                        EXECUTE FIRST BUY ON LAUNCH (DEV SNIPE)
                      </span>
                      <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Secures your initial prediction bag immediately upon pool creation at base odds.
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-500 uppercase">
                    {enableFirstBuy ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {/* First Buy Parameters Form */}
                {enableFirstBuy && (
                  <div className="space-y-4 pt-2 animate-fadeIn">
                    
                    {/* Outcome Selection */}
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        CHOOSE OUTCOME TO SNIPE / BUY:
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setSnipeSide('moon'); synthSound('bet'); }}
                          className={`py-3 px-4 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border-2 font-bold flex items-center justify-center gap-2 ${
                            snipeSide === 'moon'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <span>🚀</span>
                          <span>{moonLabel} ({arenaType === 'token' ? 'BULLISH' : 'YES'})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSnipeSide('jeet'); synthSound('bet'); }}
                          className={`py-3 px-4 rounded-xl font-mono text-xs uppercase tracking-wider transition-all border-2 font-bold flex items-center justify-center gap-2 ${
                            snipeSide === 'jeet'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <span>💀</span>
                          <span>{jeetLabel} ({arenaType === 'token' ? 'BEARISH' : 'NO'})</span>
                        </button>
                      </div>
                    </div>

                    {/* Snipe Amount Input */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          First Buy Amount (USDC):
                        </label>
                        <span className="font-mono text-[11px] text-slate-400">
                          Wallet Ammo: <strong>{user?.balance ? user.balance.toFixed(2) : '0.00'} USDC</strong>
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          placeholder="ENTER FIRST BUY AMOUNT..."
                          value={snipeAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setSnipeAmount(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-amber-500 focus:outline-none font-bold"
                        />
                        <span className="absolute right-4 font-mono text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase">
                          USDC
                        </span>
                      </div>

                      {/* Quick Presets for Snipe */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">QUICK BUY:</span>
                        {[1, 5, 10, 25, 50].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setSnipeAmount(amt);
                              synthSound('bet');
                            }}
                            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all uppercase border ${
                              snipeAmount === amt
                                ? 'bg-amber-500 text-black border-amber-500'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live CPMM Snipe Simulator Box */}
                    {snipeAmount > 0 && seedAmount > 0 && (
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 font-mono text-xs animate-fadeIn">
                        <span className="font-sans text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
                          <Sparkles size={13} className="text-amber-400" />
                          <span>SNIPE SIMULATION & POST-TRADE ODDS</span>
                        </span>
                        
                        {(() => {
                          const k = seedAmount * seedAmount;
                          const poolMoon = seedAmount;
                          const poolJeet = seedAmount;
                          const isMoon = snipeSide === 'moon';
                          
                          // CPMM swap math
                          const newReserveIn = (isMoon ? poolJeet : poolMoon) + snipeAmount;
                          const newReserveOut = k / newReserveIn;
                          const sharesReceived = (isMoon ? poolMoon : poolJeet) - newReserveOut;
                          
                          const postMoonPool = isMoon ? poolMoon - sharesReceived + snipeAmount : poolMoon;
                          const postJeetPool = !isMoon ? poolJeet - sharesReceived + snipeAmount : poolJeet;
                          const totalOdds = postMoonPool + postJeetPool;
                          const moonOddsPct = Math.round((postMoonPool / totalOdds) * 100);
                          const jeetOddsPct = 100 - moonOddsPct;

                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                              <div className="bg-black/50 p-2 rounded-lg border border-slate-800">
                                <span className="text-[9px] text-slate-400 uppercase block font-bold">EST. SHARES</span>
                                <span className="text-xs text-white font-extrabold truncate block mt-0.5">
                                  ~{sharesReceived.toFixed(2)} {snipeSide.toUpperCase()}
                                </span>
                              </div>
                              <div className="bg-black/50 p-2 rounded-lg border border-slate-800">
                                <span className="text-[9px] text-slate-400 uppercase block font-bold">AVG BUY PRICE</span>
                                <span className="text-xs text-amber-400 font-extrabold truncate block mt-0.5">
                                  ${sharesReceived > 0 ? (snipeAmount / sharesReceived).toFixed(3) : '0.500'}
                                </span>
                              </div>
                              <div className="bg-black/50 p-2 rounded-lg border border-slate-800">
                                <span className="text-[9px] text-slate-400 uppercase block font-bold">POST-SNIPE ODDS</span>
                                <span className="text-xs text-emerald-400 font-extrabold truncate block mt-0.5">
                                  {moonOddsPct}% / {jeetOddsPct}%
                                </span>
                              </div>
                              <div className="bg-black/50 p-2 rounded-lg border border-slate-800">
                                <span className="text-[9px] text-slate-400 uppercase block font-bold">MAX PAYOUT</span>
                                <span className="text-xs text-neon-moon font-extrabold truncate block mt-0.5">
                                  ${sharesReceived.toFixed(2)} USDC
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* CARD 3: Complete Pre-Deployment Order Summary & Balance Check */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-sans text-sm text-slate-900 dark:text-white font-extrabold uppercase flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span>PRE-DEPLOYMENT ORDER SUMMARY</span>
                  </h4>
                  <span className="font-mono text-[10px] text-slate-400 uppercase">
                    Chain: <strong>Avalanche Fuji</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 dark:text-slate-400 uppercase block font-bold text-[9px]">ROOM CREATION FEE</span>
                    <span className="text-slate-900 dark:text-white font-bold block mt-0.5">
                      $3.00 USDC
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 dark:text-slate-400 uppercase block font-bold text-[9px]">SEED LIQUIDITY (LP)</span>
                    <span className="text-emerald-500 font-bold block mt-0.5">
                      ${seedAmount} USDC (50/50)
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 dark:text-slate-400 uppercase block font-bold text-[9px]">DEV FIRST BUY</span>
                    <span className="text-amber-500 font-bold block mt-0.5">
                      {enableFirstBuy && snipeAmount > 0 ? `$${snipeAmount} USDC (${snipeSide.toUpperCase()})` : 'None ($0.00)'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 dark:text-slate-400 uppercase block font-bold text-[9px]">TOTAL REQUIRED</span>
                    <span className="text-neon-moon font-extrabold block mt-0.5">
                      ${(3 + seedAmount + (enableFirstBuy ? snipeAmount : 0)).toFixed(2)} USDC
                    </span>
                  </div>
                </div>

                {/* Ammo Balance Check Banner */}
                {user && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    user.balance >= (3 + seedAmount + (enableFirstBuy ? snipeAmount : 0))
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Coins size={15} />
                      <span>
                        Your Balance: <strong>{user.balance.toFixed(2)} USDC</strong> / Needed: <strong>${(3 + seedAmount + (enableFirstBuy ? snipeAmount : 0)).toFixed(2)} USDC</strong>
                      </span>
                    </div>
                    {user.balance < (3 + seedAmount + (enableFirstBuy ? snipeAmount : 0)) && (
                      <span className="font-bold uppercase text-[10px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                        INSUFFICIENT FUNDS
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Wizard Nav & Submit Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-mono text-xs rounded-xl tracking-wider flex items-center gap-2 transition-all uppercase font-bold"
                >
                  <ArrowLeft size={14} />
                  <span>BACK</span>
                </button>

                <button
                  type="submit"
                  disabled={isTransactionLoading}
                  className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed font-mono text-xs text-white rounded-xl shadow-md transition-all uppercase flex items-center justify-center gap-3 font-extrabold cursor-pointer"
                >
                  {isTransactionLoading ? (
                    <>
                      <Loader2 className="animate-spin text-white shrink-0" size={14} />
                      <span>LAUNCHING ON-CHAIN...</span>
                    </>
                  ) : (
                    <>
                      <PepePortrait src={PEPE_ASSETS.diamondHands} size={20} className="rounded-full" />
                      <span>LAUNCH ARENA (${(3 + seedAmount + (enableFirstBuy ? snipeAmount : 0)).toFixed(0)} USDC)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </form>

        {/* Footer Degen Quote Banner */}
        <div className="p-6 border-t border-gray-800 bg-[#05080E]">
          <DegenQuoteBanner />
        </div>

      </div>

    </div>
  );
}
