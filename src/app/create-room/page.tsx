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
  const [customIcon, setCustomIcon] = useState<string>('/pepes/pepe-general.png');
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

  // Form State - Config & Seeding
  const [duration, setDuration] = useState<number>(30);
  const [seedSide, setSeedSide] = useState<'moon' | 'jeet'>('moon');
  const [seedAmount, setSeedAmount] = useState<number>(10);
  const [openingPriceType, setOpeningPriceType] = useState<'market' | 'set'>('market');
  const [customSetPrice, setCustomSetPrice] = useState<string>('');

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

    if (seedAmount < 1) {
      showAlert('MINIMUM ARENA SEEDING IS 1 USDC!', 'warning', 'VALIDATION ERROR', undefined, rect);
      return;
    }

    if (user && user.balance < seedAmount) {
      showAlert('INSUFFICIENT USDC AMMO BALANCE TO SEED THIS MARKET!', 'error', 'INSUFFICIENT FUNDS', undefined, rect);
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

    const moonSeed = seedSide === 'moon' ? seedAmount : 0;
    const jeetSeed = seedSide === 'jeet' ? seedAmount : 0;

    const targetOpeningPrice = arenaType === 'debate' 
      ? 1.0 
      : (openingPriceType === 'set' ? parseFloat(customSetPrice) : tokenInfo?.rawPriceUsd || 0);

    const generatedId = String(Date.now());

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
      moonPool: moonSeed > 0 ? moonSeed : 0,
      jeetPool: jeetSeed > 0 ? jeetSeed : 0,
      expiry: Date.now() + duration * 60000,
      status: 'active',
      createdAt: Date.now(),
      duration: duration,
      openingPrice: targetOpeningPrice,
      
      // Oracle layer details
      oracleAddress: finalOracleAddress,
      oracleFeeLamports: finalOracleFeeLamports,
      resolutionCriteria: finalCriteriaText
    };

    try {
      const res = await createRoom(newRoom, openingPriceType === 'set' || arenaType === 'debate');
      
      if (res && !res.alreadyExists) {
        try {
          await placeBet(res.roomPda, seedSide as any, seedAmount, true, `/room/${res.roomPda}`);
        } catch (betErr) {
          console.error("Initial seeding bet failed, but room was created:", betErr);
        }
      }
      
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
    const Icon = oracle.icon;
    return (
      <div
        key={oracle.id}
        onClick={() => handleSelectOracle(oracle)}
        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative ${
          isSelected
            ? 'border-neon-moon bg-gradient-to-r from-emerald-950/30 via-[#0A140B] to-[#0A0E17] shadow-[0_0_20px_rgba(57,255,20,0.12)]'
            : 'border-gray-800 bg-[#0A0E17] hover:border-gray-700 hover:bg-[#0E1420]'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <input
              type="radio"
              name="oracleOption"
              value={oracle.id}
              checked={isSelected}
              onChange={() => {}}
              className="accent-neon-moon h-5 w-5 pointer-events-none"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Icon size={20} className={isSelected ? 'text-neon-moon' : 'text-gray-400'} />
                <h4 className="font-staatliches text-xl text-white tracking-wider uppercase">
                  {oracle.name}
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full border font-mono text-[9px] font-bold uppercase tracking-wider ${oracle.badgeColor}`}>
                {oracle.badge}
              </span>
            </div>

            <p className="font-sans text-xs text-gray-400 mt-1.5 leading-relaxed">
              {oracle.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-800/80 font-mono text-[9px]">
              <div>
                <span className="text-gray-500 uppercase block font-bold">SUITABLE FOR</span>
                <span className="text-white font-bold block truncate">{oracle.suitability}</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block font-bold">RESOLUTION SPEED</span>
                <span className="text-neon-moon font-bold block">{oracle.resolutionSpeed}</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block font-bold">TRUST MODEL</span>
                <span className="text-gray-300 font-bold block">{oracle.trustModel}</span>
              </div>
              <div>
                <span className="text-gray-500 uppercase block font-bold">ORACLE FEE</span>
                <span className="text-yellow-400 font-bold block">{oracle.feeSol > 0 ? `${oracle.feeSol} USDC` : '0 USDC'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 flex flex-col items-center select-none">
      
      {/* Main Wizard Container */}
      <div className="w-full bg-[#080B11] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative">
        
        {/* Top Gradient Banner & Header */}
        <div className="bg-gradient-to-r from-gray-900 via-[#0E1525] to-gray-900 border-b border-gray-800 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 font-mono text-xs">• PERMISSIONLESS DEPLOYMENT</span>
            </div>
            <h1 className="font-staatliches text-4xl text-white tracking-wider uppercase font-bold flex items-center gap-2">
              DEPLOY PREDICTION ARENA
            </h1>
            <p className="font-sans text-xs text-gray-400 mt-1 max-w-xl">
              Create instant prediction markets on live price action or custom qualitative events. Resolved on-chain by automated price feeds or AI oracle nodes.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#05080E] p-3 rounded-xl border border-gray-800/80">
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={42} glowColor="moon" className="rounded-lg" />
            <div>
              <span className="font-mono text-[10px] text-gray-400 block uppercase font-bold">COMMAND CREATOR</span>
              <span className="font-mono text-xs text-white font-bold select-all">
                {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'WALLET NOT CONNECTED'}
              </span>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="bg-[#0b101a] border-b border-gray-800/80 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            
            {/* Step 1 Button */}
            <button
              onClick={() => { if (step > 1) setStep(1); }}
              className={`flex items-center gap-3 transition-all ${step === 1 ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-staatliches text-lg font-bold border transition-all ${
                step === 1
                  ? 'bg-neon-moon text-black border-neon-moon shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                  : step > 1
                  ? 'bg-emerald-950 text-neon-moon border-neon-moon/60'
                  : 'bg-gray-900 text-gray-500 border-gray-800'
              }`}>
                {step > 1 ? <Check size={18} className="stroke-[3]" /> : '1'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-gray-400 uppercase font-bold block">STEP 1</span>
                <span className={`font-staatliches text-base tracking-wider uppercase block ${step === 1 ? 'text-white font-bold' : 'text-gray-400'}`}>
                  TARGET MARKET
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-4 transition-colors ${step >= 2 ? 'bg-neon-moon/60' : 'bg-gray-800'}`} />

            {/* Step 2 Button */}
            <button
              onClick={() => { if (step > 2) setStep(2); }}
              className={`flex items-center gap-3 transition-all ${step === 2 ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-staatliches text-lg font-bold border transition-all ${
                step === 2
                  ? 'bg-neon-moon text-black border-neon-moon shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                  : step > 2
                  ? 'bg-emerald-950 text-neon-moon border-neon-moon/60'
                  : 'bg-gray-900 text-gray-500 border-gray-800'
              }`}>
                {step > 2 ? <Check size={18} className="stroke-[3]" /> : '2'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-gray-400 uppercase font-bold block">STEP 2</span>
                <span className={`font-staatliches text-base tracking-wider uppercase block ${step === 2 ? 'text-white font-bold' : 'text-gray-400'}`}>
                  ORACLE PROTOCOL
                </span>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-4 transition-colors ${step >= 3 ? 'bg-neon-moon/60' : 'bg-gray-800'}`} />

            {/* Step 3 Button */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-staatliches text-lg font-bold border transition-all ${
                step === 3
                  ? 'bg-neon-moon text-black border-neon-moon shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                  : 'bg-gray-900 text-gray-500 border-gray-800'
              }`}>
                3
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-mono text-[9px] text-gray-400 uppercase font-bold block">STEP 3</span>
                <span className={`font-staatliches text-base tracking-wider uppercase block ${step === 3 ? 'text-white font-bold' : 'text-gray-400'}`}>
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
                <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase flex items-center gap-2">
                  <Layers size={22} className="text-neon-moon" />
                  <span>SELECT PREDICTION MARKET STRUCTURE</span>
                </h3>
                <p className="font-sans text-xs text-gray-400 mt-1">
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
                      ? 'border-neon-moon bg-gradient-to-b from-emerald-950/30 to-[#0A140B] shadow-[0_0_20px_rgba(57,255,20,0.12)]'
                      : 'border-gray-800 bg-[#0A0E17] hover:border-gray-700 hover:bg-[#0E1420]'
                  }`}
                >
                  {arenaType === 'token' && (
                    <div className="absolute top-3 right-3 text-neon-moon">
                      <CheckCircle2 size={20} className="fill-neon-moon text-black" />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-neon-moon/40 flex items-center justify-center mb-3">
                    <TrendingUp size={26} className="text-neon-moon" />
                  </div>
                  <h4 className="font-staatliches text-2xl text-white tracking-wider uppercase">PRICE CHART BATTLE</h4>
                  <p className="font-sans text-xs text-gray-400 mt-1 leading-relaxed">
                    Bet on live USD price movements of any token on Solana or Avalanche. Uses Pyth & Chainlink feeds to resolve automatically.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 font-mono text-[9px] text-neon-moon uppercase font-bold">
                      ⚡ Trustless TWAP
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 font-mono text-[9px] text-gray-300 uppercase font-bold">
                      0 USDC Fee
                    </span>
                  </div>
                </div>

                {/* Custom Prediction / Debate Card */}
                <div
                  onClick={() => handleSelectArenaType('debate')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                    arenaType === 'debate'
                      ? 'border-yellow-400 bg-gradient-to-b from-amber-950/30 to-[#141007] shadow-[0_0_20px_rgba(255,215,0,0.12)]'
                      : 'border-gray-800 bg-[#0A0E17] hover:border-gray-700 hover:bg-[#0E1420]'
                  }`}
                >
                  {arenaType === 'debate' && (
                    <div className="absolute top-3 right-3 text-yellow-400">
                      <CheckCircle2 size={20} className="fill-yellow-400 text-black" />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-yellow-400/40 flex items-center justify-center mb-3">
                    <Scale size={26} className="text-yellow-400" />
                  </div>
                  <h4 className="font-staatliches text-2xl text-white tracking-wider uppercase">CUSTOM PREDICTION / DEBATE</h4>
                  <p className="font-sans text-xs text-gray-400 mt-1 leading-relaxed">
                    Create plain-language prediction statements regarding politics, crypto milestones, tech releases, or custom events.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 font-mono text-[9px] text-yellow-400 uppercase font-bold">
                      AI & DAO Oracles
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 font-mono text-[9px] text-gray-300 uppercase font-bold">
                      Custom Uploads
                    </span>
                  </div>
                </div>

              </div>

              {/* Chart Battle Scanner Form */}
              {arenaType === 'token' && (
                <div className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center justify-between">
                      <span>Token Contract Address (Solana / EVM):</span>
                      <span className="text-[10px] text-gray-400">DexScreener Verified</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="PASTE TOKEN CONTRACT ADDRESS (e.g., 0x420fca... or 4k3Dyw...)"
                        value={contractAddress}
                        onChange={(e) => {
                          setContractAddress(e.target.value);
                          setTokenInfo(null);
                        }}
                        className="flex-1 px-4 py-3 bg-[#05080E] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-neon-moon focus:outline-none tracking-widest font-bold"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleScan(e)}
                        disabled={scanning || !contractAddress.trim()}
                        className="px-6 bg-neon-moon hover:bg-green-400 text-black font-staatliches text-xl rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        {scanning ? (
                          <>
                            <Loader2 size={18} className="animate-spin text-black" />
                            <span>SCANNING...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={18} />
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
                    </div>
                  )}
                </div>
              )}

              {/* Custom Debate & Prediction Form */}
              {arenaType === 'debate' && (
                <div className="space-y-6 pt-2">
                  
                  {/* Title / Statement */}
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-gray-200 uppercase tracking-wider">
                      Prediction Question / Statement Title:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., WILL BITCOIN REACH $100,000 BEFORE DECEMBER 2026?"
                      value={debateName}
                      onChange={(e) => setDebateName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#05080E] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-yellow-400 focus:outline-none uppercase tracking-wide font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-gray-200 uppercase tracking-wider">
                        Virtual Market Ticker Symbol:
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="e.g., BTC100K"
                        value={debateSymbol}
                        onChange={(e) => setDebateSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                        className="w-full px-4 py-3 bg-[#05080E] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-yellow-400 focus:outline-none uppercase tracking-widest font-bold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-gray-200 uppercase tracking-wider">
                        Market Image / Avatar:
                      </label>
                      <div className="flex items-center gap-2">
                        {customIcon && (
                          <div className="w-10 h-10 bg-black rounded-lg border border-yellow-400 overflow-hidden shrink-0 flex items-center justify-center text-xl shadow-lg">
                            {customIcon.startsWith('http') || customIcon.startsWith('data:') || customIcon.startsWith('/') ? (
                              <img src={customIcon} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <span>{customIcon}</span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 px-4 py-3 bg-[#05080E] border border-dashed border-gray-700 hover:border-yellow-400 text-gray-300 font-mono text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold"
                        >
                          <Upload size={16} className="text-yellow-400" />
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

                  {/* Drag and Drop Zone & Presets */}
                  <div className="bg-[#05080E] border border-gray-800 rounded-2xl p-5 space-y-4">
                    
                    {/* Drag and Drop Box */}
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
                      className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isDragOver
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-gray-800 bg-[#0A0E17] hover:border-gray-700'
                      }`}
                    >
                      <ImageIcon size={32} className="text-yellow-400 mb-2" />
                      <span className="font-staatliches text-lg text-white tracking-wider uppercase">
                        DRAG & DROP CUSTOM MARKET IMAGE HERE
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 uppercase mt-0.5">
                        SUPPORTS PNG, JPG, WEBP, SVG (AUTO-COMPRESSED TO INSTANT HIGH-SPEED DATA URL)
                      </span>
                    </div>

                    {/* Presets Grid */}
                    <div>
                      <span className="font-mono text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                        OR CHOOSE A CURATED DEGEN AVATAR:
                      </span>
                      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                        {PRESET_AVATARS.map((avatar) => (
                          <button
                            key={avatar.id}
                            type="button"
                            onClick={() => {
                              setCustomIcon(avatar.url);
                              synthSound('bet');
                            }}
                            className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${
                              customIcon === avatar.url
                                ? 'border-yellow-400 bg-yellow-400/20 scale-110 shadow-[0_0_10px_rgba(255,215,0,0.4)]'
                                : 'border-gray-800 bg-black hover:border-gray-600'
                            }`}
                            title={avatar.name}
                          >
                            <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover rounded-xl" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Room Card Replica Preview */}
                  <div className="bg-[#05080E] border border-gray-800/80 rounded-2xl p-5">
                    <span className="font-mono text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-yellow-400" />
                      <span>LIVE ARENA CARD PREVIEW ON EXPLORE PAGE:</span>
                    </span>

                    <div className="max-w-md mx-auto p-4 rounded-xl border border-yellow-400/50 bg-[#05050A] shadow-xl">
                      <div className="flex items-center gap-3 border-b border-gray-800 pb-3 mb-3">
                        <div className="w-10 h-10 bg-black rounded-lg border border-yellow-400 overflow-hidden shrink-0 flex items-center justify-center">
                          {customIcon.startsWith('http') || customIcon.startsWith('data:') || customIcon.startsWith('/') ? (
                            <img src={customIcon} alt="Market" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{customIcon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-staatliches text-base text-white truncate leading-tight uppercase">
                            {debateName.trim() || 'WILL BITCOIN HIT $100K BEFORE DECEMBER?'}
                          </h4>
                          <span className="font-mono text-[10px] text-yellow-400 font-bold">
                            ${debateSymbol.trim() || 'BTC100K'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#0A0E17] border border-gray-800 p-2 rounded-lg text-center font-mono text-[10px] text-gray-300 font-bold uppercase mb-3">
                        WILL {debateSymbol.trim() || 'BTC100K'} RESOLVE TO MOON BEFORE EXPIRY?
                      </div>

                      <div className="grid grid-cols-2 gap-2 font-staatliches text-xs">
                        <div className="py-2 bg-emerald-950/80 text-neon-moon border border-neon-moon/40 text-center rounded-lg font-bold">
                          MOON (YES) 50%
                        </div>
                        <div className="py-2 bg-red-950/80 text-jeet-red border border-jeet-red/40 text-center rounded-lg font-bold">
                          JEET (NO) 50%
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Wizard Nav buttons */}
              <div className="flex justify-end pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-8 py-3 bg-neon-moon hover:bg-green-400 font-staatliches text-xl text-black rounded-xl tracking-wider flex items-center gap-2 font-bold transition-all uppercase"
                >
                  <span>NEXT: ORACLE PROTOCOL</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CLEAR & EXPLICIT ORACLE SELECTION GRID */}
          {step === 2 && (
            <div className="space-y-8 animate-fadeIn">
              
              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase flex items-center gap-2">
                  <Brain size={22} className="text-neon-moon" />
                  <span>SELECT RESOLUTION ORACLE PROTOCOL</span>
                </h3>
                <p className="font-sans text-xs text-gray-400 mt-1">
                  Choose the oracle mechanism responsible for settling outcomes on-chain. Every oracle runs transparently.
                </p>
              </div>

              {/* Oracle Selection Grid */}
              <div className="space-y-6">
                {arenaType === 'token' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-neon-moon font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                      <TrendingUp size={14} />
                      <span>AUTOMATED PRICE FEED (TRUSTLESS ON-CHAIN INDEXING)</span>
                    </div>
                    {AVAILABLE_ORACLES
                      .filter(o => o.id === 'price')
                      .map((oracle) => renderOracleCard(oracle))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                        <Brain size={14} />
                        <span>AUTONOMOUS AI AGENTS (FAST RESOLUTION)</span>
                      </div>
                      {AVAILABLE_ORACLES
                        .filter(o => o.id === 'ai-sonnet' || o.id === 'ai-consensus')
                        .map((oracle) => renderOracleCard(oracle))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-yellow-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                        <Globe size={14} />
                        <span>COMMUNITY DECISION MAKING (DEMOCRATIC VERDICT)</span>
                      </div>
                      {AVAILABLE_ORACLES
                        .filter(o => o.id === 'dao-jury')
                        .map((oracle) => renderOracleCard(oracle))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                        <UserCheck size={14} />
                        <span>ESCROW SIGNER (DESIGNATED WALLET KEY)</span>
                      </div>
                      {AVAILABLE_ORACLES
                        .filter(o => o.id === 'custom')
                        .map((oracle) => renderOracleCard(oracle))}
                    </div>
                  </>
                )}
              </div>

              {/* AI & Custom Resolution Rules Builder */}
              {(selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus' || selectedOracleId === 'dao-jury' || selectedOracleId === 'custom') && (
                <div className="bg-[#05080E] border border-gray-800 rounded-2xl p-6 space-y-5 animate-fadeIn">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-staatliches text-xl text-white tracking-wider uppercase flex items-center gap-2">
                        <FileText size={18} className="text-neon-moon" />
                        <span>ORACLE RESOLUTION RULES & PROMPTS</span>
                      </h4>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">
                        Specify precise evaluation conditions for the oracle node.
                      </p>
                    </div>

                    {/* Pre-filled Templates */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] text-gray-500 font-bold uppercase">TEMPLATES:</span>
                      <button
                        type="button"
                        onClick={() => applyTemplate('target')}
                        className="px-2 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-neon-moon font-mono text-[9px] rounded uppercase font-bold"
                      >
                        Price Target
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTemplate('web')}
                        className="px-2 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-yellow-400 font-mono text-[9px] rounded uppercase font-bold"
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
                      className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-neon-moon focus:outline-none uppercase tracking-wide font-bold"
                    />
                  </div>

                  {/* Reference URL */}
                  {(selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus') && (
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={14} className="text-cyan-400" />
                        <span>Reference URL / Scraper Source (Optional):</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://x.com/realDonaldTrump or official news announcement URL"
                        value={referenceUrl}
                        onChange={(e) => setReferenceUrl(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0A0E17] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-cyan-400 focus:outline-none font-bold"
                      />
                    </div>
                  )}

                  {/* Custom Arbitrator Key input */}
                  {selectedOracleId === 'custom' && (
                    <div className="space-y-4 pt-2 border-t border-gray-800">
                      <div className="space-y-2">
                        <label className="block font-mono text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Arbitrator Wallet Public Key:
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="PASTE THE ARBITRATOR'S WALLET PUBLIC KEY OR EVM ADDRESS..."
                          value={customOracleAddress}
                          onChange={(e) => setCustomOracleAddress(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-800 text-white font-mono text-xs placeholder-gray-600 rounded-xl focus:border-emerald-400 focus:outline-none uppercase font-bold"
                        />
                      </div>

                      {/* Oracle Fee Slider */}
                      <div className="space-y-2 bg-[#0A0E17] p-4 border border-gray-800 rounded-xl">
                        <div className="flex justify-between items-center">
                          <label className="font-staatliches text-base text-white tracking-wider uppercase">
                            Custom Oracle Resolution Fee:
                          </label>
                          <span className="font-mono text-sm text-yellow-400 font-extrabold">
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
                          className="w-full accent-neon-moon cursor-pointer"
                        />
                        <p className="font-mono text-[9px] text-gray-400 uppercase font-bold">
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

          {/* STEP 3: DURATION, LIQUIDITY SEEDING & LAUNCH */}
          {step === 3 && (
            <div className="space-y-8 animate-fadeIn">
              
              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase flex items-center gap-2">
                  <Coins size={22} className="text-neon-moon" />
                  <span>CONFIGURE DURATION & SEED AMMO</span>
                </h3>
                <p className="font-sans text-xs text-gray-400 mt-1">
                  Specify market expiry duration and seed initial USDC liquidity into your target side.
                </p>
              </div>

              {/* Duration Presets & Slider */}
              <div className="bg-[#05080E] border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="font-staatliches text-xl text-white tracking-wider uppercase">
                    BATTLE EXPIRY DURATION:
                  </label>
                  <span className="font-mono text-sm text-neon-moon font-extrabold bg-emerald-950/60 px-3 py-1 border border-neon-moon/40 rounded-lg">
                    {duration >= 1440 ? `${(duration / 1440).toFixed(1)} DAYS` : duration >= 60 ? `${(duration / 60).toFixed(1)} HOURS` : `${duration} MINS`}
                  </span>
                </div>

                <input 
                  type="range" 
                  min="5" 
                  max="10080" 
                  step="5"
                  value={duration} 
                  onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 5))}
                  className="w-full accent-neon-moon cursor-pointer"
                />

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                  {[
                    { time: 5, label: '5 MIN' },
                    { time: 30, label: '30 MIN' },
                    { time: 60, label: '60 MIN' },
                    { time: 240, label: '4 HRS' },
                    { time: 1440, label: '24 HRS' },
                    { time: 10080, label: '1 WEEK' }
                  ].map((opt) => (
                    <button
                      key={opt.time}
                      type="button"
                      onClick={() => { setDuration(opt.time); synthSound('bet'); }}
                      className={`py-2 rounded-xl font-mono text-xs font-bold transition-all ${
                        duration === opt.time
                          ? 'bg-neon-moon text-black font-extrabold shadow-[0_0_12px_rgba(57,255,20,0.3)]'
                          : 'bg-[#0A0E17] border border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Ammo Seeding Box */}
              <div className="bg-[#05080E] border border-gray-800 rounded-2xl p-6 space-y-5">
                
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <h4 className="font-staatliches text-xl text-white tracking-wider uppercase">
                      INITIAL LIQUIDITY AMMO (*REQUIRED)
                    </h4>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">
                      Seed initial USDC into the pot to activate this arena on the explore page.
                    </p>
                  </div>
                  <span className="font-mono text-lg text-yellow-400 font-extrabold">
                    {seedAmount} USDC
                  </span>
                </div>

                {/* Seed Side Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSeedSide('moon'); synthSound('bet'); }}
                    className={`py-3.5 rounded-xl font-staatliches text-lg tracking-wider uppercase transition-all border-2 font-bold ${
                      seedSide === 'moon'
                        ? 'bg-neon-moon text-black border-neon-moon shadow-[0_0_16px_rgba(57,255,20,0.3)]'
                        : 'bg-[#0A0E17] border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    SEED MOON (YES)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSeedSide('jeet'); synthSound('bet'); }}
                    className={`py-3.5 rounded-xl font-staatliches text-lg tracking-wider uppercase transition-all border-2 font-bold ${
                      seedSide === 'jeet'
                        ? 'bg-jeet-red text-white border-jeet-red shadow-[0_0_16px_rgba(255,7,58,0.3)]'
                        : 'bg-[#0A0E17] border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    SEED JEET (NO)
                  </button>
                </div>

                {/* Seeding Amount Input */}
                <div className="space-y-2">
                  <label className="block font-mono text-xs font-bold text-gray-300 uppercase tracking-wider">
                    USDC Seeding Amount:
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="ENTER USDC SEED AMOUNT..."
                      value={seedAmount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSeedAmount(isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-[#0A0E17] border border-gray-800 text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-neon-moon focus:outline-none font-bold"
                    />
                    <span className="absolute right-4 font-mono text-xs text-neon-moon font-extrabold uppercase">
                      USDC AMMO
                    </span>
                  </div>
                </div>
              </div>

              {/* Complete Deployment Order Summary */}
              <div className="bg-[#05080E] border border-emerald-900/60 rounded-2xl p-6 space-y-4">
                <h4 className="font-staatliches text-xl text-neon-moon tracking-wider uppercase flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>PRE-DEPLOYMENT ORDER SUMMARY</span>
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="bg-[#0A0F1A] border border-gray-800 p-3 rounded-xl">
                    <span className="text-gray-500 uppercase block font-bold text-[9px]">TARGET MARKET</span>
                    <span className="text-white font-bold block truncate mt-0.5">
                      {arenaType === 'token' ? (tokenInfo?.name || 'Chart Battle') : (debateName || 'Custom Event')}
                    </span>
                  </div>
                  <div className="bg-[#0A0F1A] border border-gray-800 p-3 rounded-xl">
                    <span className="text-gray-500 uppercase block font-bold text-[9px]">ORACLE RESOLVER</span>
                    <span className="text-neon-moon font-bold block truncate mt-0.5">
                      {selectedOracleId.toUpperCase()}
                    </span>
                  </div>
                  <div className="bg-[#0A0F1A] border border-gray-800 p-3 rounded-xl">
                    <span className="text-gray-500 uppercase block font-bold text-[9px]">EXPIRY TIME</span>
                    <span className="text-white font-bold block mt-0.5">
                      {duration} MINS
                    </span>
                  </div>
                  <div className="bg-[#0A0F1A] border border-gray-800 p-3 rounded-xl">
                    <span className="text-gray-500 uppercase block font-bold text-[9px]">INITIAL POT</span>
                    <span className="text-yellow-400 font-bold block mt-0.5">
                      {seedAmount} USDC ({seedSide.toUpperCase()})
                    </span>
                  </div>
                </div>
              </div>

              {/* Wizard Nav & Submit Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-staatliches text-xl rounded-xl tracking-wider flex items-center gap-2 transition-all uppercase"
                >
                  <ArrowLeft size={18} />
                  <span>BACK</span>
                </button>

                <button
                  type="submit"
                  disabled={isTransactionLoading}
                  className="px-10 py-4 bg-neon-moon hover:bg-green-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed font-staatliches text-2xl text-black rounded-xl shadow-[0_0_25px_rgba(57,255,20,0.4)] active:scale-95 transition-all uppercase flex items-center justify-center gap-3 font-extrabold"
                >
                  {isTransactionLoading ? (
                    <>
                      <Loader2 className="animate-spin text-black shrink-0" size={26} />
                      <span>LAUNCHING ARENA ON-CHAIN...</span>
                    </>
                  ) : (
                    <>
                      <PepePortrait src={PEPE_ASSETS.diamondHands} size={30} className="rounded-full" />
                      <span>LAUNCH PREDICTION ARENA</span>
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
