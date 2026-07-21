'use client';
import { INDEXER_URL } from "@/utils/config";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState, Room, detectCategory } from '@/store/useAppState';
import { getAnchorProgram, getPlatformConfigPda } from '@/utils/solanaClient';
import { PublicKey } from '@solana/web3.js';
import { PixelShovel, PixelGasMask, PixelCrackedHelmet } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { 
  ShieldCheck, 
  CalendarRange, 
  Info, 
  Clock, 
  AlertTriangle, 
  Radio, 
  Loader2, 
  Coins, 
  ArrowRight, 
  ArrowLeft,
  Scale,
  Brain,
  TrendingUp,
  UserCheck,
  Globe
} from 'lucide-react';

const MOCK_TOKENS = [
  { name: 'Jeet Repellent Coin', symbol: 'REPENT', icon: '🧴' },
  { name: 'Slippage Slayer Ultimate', symbol: 'SLIP', icon: '⚔️' },
  { name: 'Giga Chad Premium Token', symbol: 'CHADG', icon: '🗿' },
  { name: 'Honeypot Immune Safe', symbol: 'IMMUNE', icon: '🛡️' },
  { name: 'Slerf Lazy Sloth V2', symbol: 'SLERF2', icon: '🦥' },
  { name: 'Pump and Never Dump', symbol: 'PAND', icon: '🐼' }
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
  const [step, setStep] = useState(1);

  // Form State - Type & Asset
  const [arenaType, setArenaType] = useState<'token' | 'debate'>('token');
  const [contractAddress, setContractAddress] = useState('');
  const [debateSymbol, setDebateSymbol] = useState('');
  const [debateName, setDebateName] = useState('');

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

  // Available Oracles List (dynamic addresses based on keeperAddress)
  const AVAILABLE_ORACLES = [
    {
      id: 'price',
      name: 'Automated Price Feed (Pyth / Chainlink)',
      type: 'price',
      icon: TrendingUp,
      description: 'Settle automatically based on Pyth Network, Chainlink & DexScreener price feeds. Bypasses custom signers.',
      feeSol: 0,
      address: '0x0000000000000000000000000000000000000000',
      suitability: 'Chart Battles Only',
      badge: 'Trustless'
    },
    {
      id: 'ai-sonnet',
      name: 'Claude 3.5 Sonnet Node',
      type: 'ai',
      icon: Brain,
      description: 'Autonomous evaluation by our background LLM agent scanning reference URLs & news sites.',
      feeSol: 0.005,
      address: keeperAddress || 'Keeper Default Key',
      suitability: 'Debate & Qualitative Bets',
      badge: 'Automated AI'
    },
    {
      id: 'ai-consensus',
      name: 'AI Consensus Aggregator',
      type: 'ai',
      icon: Brain,
      description: 'Aggregates multiple LLMs (Claude 3.5 + GPT-4o) to evaluate outcome, resolving based on majority vote.',
      feeSol: 0.01,
      address: keeperAddress || 'Keeper Default Key',
      suitability: 'High-Stakes Qualitative Bets',
      badge: 'Multi-Agent AI'
    },
    {
      id: 'dao-jury',
      name: 'Community DAO Jury',
      type: 'custom',
      icon: Globe,
      description: 'Democratic resolution resolved by DAO token-holder voting. 24-hour voting window.',
      feeSol: 0.015,
      address: '0x0000000000000000000000000000000000000000',
      suitability: 'Community Disputes',
      badge: 'DAO Voting'
    },
    {
      id: 'custom',
      name: 'Custom Arbitrator Signer',
      type: 'custom',
      icon: UserCheck,
      description: 'Designate any custom wallet public key to resolve this arena. You set the resolver fee.',
      feeSol: 0.005,
      address: customOracleAddress || 'User Defined',
      suitability: 'P2P Private Wagers',
      badge: 'Escrow Key'
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
    setOracleFeeSol(oracle.feeSol);
    if (oracle.id === 'dao-jury') {
      setCustomOracleAddress('ByNq6kkYAPWPkHSimJPL6nhkeP7xFKHkstZRQcdLLH1B');
    } else if (oracle.id !== 'custom') {
      setCustomOracleAddress('');
    }
    synthSound('bet');
  };

  // Fetch keeper address for defaulting the AI oracle
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
        showAlert('API SCAN TIMED OUT. SECURE SATELLITE CONNECTION AND TRY AGAIN!', 'warning', 'SCAN TIMEOUT', undefined, rect);
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
        showAlert('MUST SCAN A VALID TOKEN FIRST!', 'warning', 'ACTION BLOCKED');
        return;
      }
      if (arenaType === 'debate') {
        if (!debateName.trim() || !debateSymbol.trim()) {
          showAlert('PLEASE SPECIFY DEBATE TITLE AND TICKER!', 'warning', 'VALIDATION ERROR');
          return;
        }
      }
    }
    if (step === 2) {
      if (oracleType === 'ai' && !resolutionCriteria.trim()) {
        showAlert('PLEASE SPECIFY RESOLUTION CRITERIA FOR THE AI ORACLE!', 'warning', 'VALIDATION ERROR');
        return;
      }
      if (oracleType === 'custom') {
        if (!customOracleAddress.trim()) {
          showAlert('PLEASE SPECIFY A CUSTOM RESOLVER WALLET ADDRESS!', 'warning', 'VALIDATION ERROR');
          return;
        }
        try {
          new PublicKey(customOracleAddress);
        } catch {
          showAlert('INVALID CUSTOM RESOLVER WALLET PUBLIC KEY!', 'error', 'VALIDATION ERROR');
          return;
        }
      }
    }
    synthSound('bet');
    setStep(step + 1);
  };

  const prevStep = () => {
    synthSound('bet');
    setStep(step - 1);
  };

  const handleLaunch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    const creatorAddress = wallet?.address || (wallet?.publicKey ? wallet.publicKey.toBase58() : '');

    if (!creatorAddress) {
      showAlert('PLEASE ENLIST YOUR EVM WALLET TO DEPLOY ARENAS!', 'warning', 'WALLET NOT CONNECTED', () => {
        connectWallet();
      }, rect);
      return;
    }

    if (seedAmount < 1) {
      showAlert('MINIMUM ARENA INITIAL SEEDING IS 1 USDC!', 'warning', 'VALIDATION ERROR', undefined, rect);
      return;
    }

    if (user && user.balance < seedAmount) {
      showAlert('INSUFFICIENT AMMO USDC TO SEED THIS ROOM!', 'error', 'INSUFFICIENT FUNDS', undefined, rect);
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
    let tokenIconStr = tokenInfo?.icon || '🗣️';
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
      
      let betSucceeded = false;
      if (res && !res.alreadyExists) {
        try {
          await placeBet(res.roomPda, seedSide as any, seedAmount, true, `/room/${res.roomPda}`);
          betSucceeded = true;
        } catch (betErr) {
          console.error("Initial seeding bet failed, but room was created:", betErr);
        }
      }
      
      synthSound('explosion');
      if (res && res.alreadyExists) {
        showAlert("COMMAND HQ DETECTED THAT A PREDICTION ARENA ALREADY EXISTS FOR THIS TOKEN! REDIRECTING...", 'info', 'ARENA FOUND', undefined, rect);
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

  return (
    <div className="mx-auto max-w-2xl w-full px-4 py-8 flex-1 flex flex-col items-center select-none">
      
      {/* military clipboard frame */}
      <div className="w-full bg-trench-mud border-4 border-trench-sandbag rounded-lg shadow-2xl relative scanlines p-6 md:p-8">
        
        {/* Metal clipboard clip */}
        <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-[#5C5244] border-2 border-[#8B8B7A] text-white px-8 py-1 rounded font-staatliches text-base tracking-widest shadow-md uppercase flex items-center gap-2">
          <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={24} className="rounded-full" />
          <span>DEPLOYMENT WIZARD</span>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-between mb-8 mt-4 border-b border-trench-sandbag/40 pb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-staatliches text-lg ${
              step >= 1 ? 'border-neon-moon bg-neon-moon/10 text-neon-moon' : 'border-trench-sandbag text-trench-gasmask'
            }`}>1</div>
            <span className={`font-staatliches text-sm tracking-wider uppercase hidden sm:inline ${step === 1 ? 'text-white' : 'text-trench-gasmask'}`}>Asset Target</span>
          </div>
          <div className="h-0.5 flex-1 mx-2 bg-trench-sandbag/40"></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-staatliches text-lg ${
              step >= 2 ? 'border-neon-moon bg-neon-moon/10 text-neon-moon' : 'border-trench-sandbag text-trench-gasmask'
            }`}>2</div>
            <span className={`font-staatliches text-sm tracking-wider uppercase hidden sm:inline ${step === 2 ? 'text-white' : 'text-trench-gasmask'}`}>Oracle Selection</span>
          </div>
          <div className="h-0.5 flex-1 mx-2 bg-trench-sandbag/40"></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-staatliches text-lg ${
              step >= 3 ? 'border-neon-moon bg-neon-moon/10 text-neon-moon' : 'border-trench-sandbag text-trench-gasmask'
            }`}>3</div>
            <span className={`font-staatliches text-sm tracking-wider uppercase hidden sm:inline ${step === 3 ? 'text-white' : 'text-trench-gasmask'}`}>Ammo Seeding</span>
          </div>
        </div>

        <form onSubmit={handleLaunch} className="space-y-6">
          
          {/* STEP 1: ASSET TARGET */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-6">
                <PepePortrait src={PEPE_ASSETS.cryptoBunker} size={70} glowColor="moon" animated className="rounded-lg mx-auto mb-3" />
                <h3 className="font-staatliches text-3xl text-white tracking-wider uppercase">SELECT TARGET ARENA</h3>
                <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1 leading-snug">
                  Choose whether bettors wage war on standard market token charts or custom qualitative debate topics.
                </p>
              </div>

              {/* Arena Type Tabs */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleSelectArenaType('token')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 text-center transition-all ${
                    arenaType === 'token'
                      ? 'border-neon-moon bg-neon-moon/5 text-white shadow-glow-moon'
                      : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white'
                  }`}
                >
                  <TrendingUp size={28} className={arenaType === 'token' ? 'text-neon-moon' : ''} />
                  <span className="font-staatliches text-xl tracking-wider">CHART BATTLE</span>
                  <span className="font-mono text-[9px] uppercase leading-tight text-trench-gasmask">Bet on standard price feed movements of any token.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectArenaType('debate')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 text-center transition-all ${
                    arenaType === 'debate'
                      ? 'border-moon-gold bg-moon-gold/5 text-white shadow-glow-gold'
                      : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white'
                  }`}
                >
                  <Scale size={28} className={arenaType === 'debate' ? 'text-moon-gold' : ''} />
                  <span className="font-staatliches text-xl tracking-wider">DEBATE BATTLE</span>
                  <span className="font-mono text-[9px] uppercase leading-tight text-trench-gasmask">Create plain-text prediction statements resolved by oracles.</span>
                </button>
              </div>

              {/* Chart Battle Form */}
              {arenaType === 'token' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Token Mint Address:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="PASTE TOKEN CONTRACT ADDRESS TO SCAN..."
                        value={contractAddress}
                        onChange={(e) => {
                          setContractAddress(e.target.value);
                          setTokenInfo(null);
                        }}
                        className="flex-1 px-3 py-2.5 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-widest font-bold font-mono"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleScan(e)}
                        disabled={scanning || !contractAddress.trim()}
                        className="px-5 bg-trench-sandbag hover:bg-trench-gasmask font-staatliches text-lg text-white border border-trench-sandbag/80 active:translate-y-0.5 rounded transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {scanning ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-neon-moon" />
                            <span>SCANNING</span>
                          </>
                        ) : (
                          <span>SCAN TARGET</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {tokenInfo && (
                    <div className="bg-trench-black p-4 border border-trench-sandbag rounded shadow-inner space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-3.5 border-b border-trench-sandbag/40 pb-3">
                        <div className="w-12 h-12 bg-trench-black rounded-full border-2 border-neon-moon flex items-center justify-center text-2xl overflow-hidden shrink-0">
                          {tokenInfo.icon.startsWith('http') ? (
                            <img src={tokenInfo.icon} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                          ) : (
                            tokenInfo.icon
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-staatliches text-2xl text-neon-moon tracking-wide">
                            {tokenInfo.name} (${tokenInfo.symbol})
                          </h4>
                          <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase block mt-0.5">
                            TARGET VALIDATED ON-CHAIN
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                          <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono text-[8px] text-trench-gasmask block font-bold">PRICE</span>
                            <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.priceUsd}</span>
                          </div>
                        </div>
                        <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                          <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono text-[8px] text-trench-gasmask block font-bold">LIQUIDITY</span>
                            <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.liquidity}</span>
                          </div>
                        </div>
                        <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                          <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono text-[8px] text-trench-gasmask block font-bold">24H VOL</span>
                            <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.volume24h}</span>
                          </div>
                        </div>
                        <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                          <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                          <div className="min-w-0">
                            <span className="font-mono text-[8px] text-trench-gasmask block font-bold">FDV</span>
                            <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.fdv}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Debate Battle Form */}
              {arenaType === 'debate' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Debate Title / Topic:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., WILL TRUMP TWEET ABOUT MONAD BY FRIDAY?"
                      value={debateName}
                      onChange={(e) => setDebateName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-widest font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                        Virtual Ticker Symbol:
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="e.g., TWEET"
                        value={debateSymbol}
                        onChange={(e) => setDebateSymbol(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                        className="w-full px-3 py-2.5 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-widest font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                        Display Icon:
                      </label>
                      <div className="w-full px-3 py-2.5 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs rounded flex items-center gap-2">
                        <span>🗣️</span>
                        <span className="text-trench-gasmask uppercase">Virtual Arena Icon</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Nav buttons */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-neon-moon hover:bg-green-500 font-staatliches text-xl text-black border-b-4 border-green-800 rounded tracking-wider flex items-center gap-1.5 active:translate-y-0.5 transition-all uppercase"
                >
                  <span>NEXT: ORACLE</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ORACLE SELECTION */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-6">
                <PepePortrait src={PEPE_ASSETS.diamondHands} size={70} glowColor="gold" animated className="rounded-lg mx-auto mb-3" />
                <h3 className="font-staatliches text-3xl text-white tracking-wider uppercase">SELECT RESOLUTION ORACLE</h3>
                <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1 leading-snug">
                  Choose the oracle to settle this arena. Every oracle operates permissionless.
                </p>
              </div>

              {/* Oracle Type Options */}
              <div className="space-y-3">
                {AVAILABLE_ORACLES
                  .filter(o => arenaType === 'token' || o.id !== 'price')
                  .map((oracle) => {
                    const isSelected = selectedOracleId === oracle.id;
                    const Icon = oracle.icon;
                    return (
                      <div
                        key={oracle.id}
                        onClick={() => handleSelectOracle(oracle)}
                        className={`p-4 border-2 rounded-lg flex items-start gap-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-neon-moon bg-neon-moon/5 text-white shadow-glow-moon'
                            : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-center h-5 w-5 shrink-0 mt-1">
                          <input
                            type="radio"
                            name="oracleType"
                            value={oracle.id}
                            checked={isSelected}
                            onChange={() => {}} // Handled by div onClick
                            className="accent-neon-moon h-4 w-4"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Icon size={16} className={isSelected ? 'text-neon-moon' : 'text-trench-gasmask'} />
                              <span className="font-staatliches text-lg tracking-wider uppercase truncate">{oracle.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-trench-mud border border-trench-sandbag/60 text-[8px] font-mono font-bold text-white uppercase tracking-wider shrink-0">
                              {oracle.badge}
                            </span>
                          </div>
                          <p className="font-mono text-[9px] uppercase leading-snug mt-1 text-trench-gasmask">
                            {oracle.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2 font-mono text-[8px] font-bold text-neon-moon uppercase tracking-wider flex-wrap">
                            <span>🎯 SUITABLE FOR: <span className="text-white">{oracle.suitability}</span></span>
                            <span>💰 ORACLE FEE: <span className="text-white">{oracle.feeSol > 0 ? `${oracle.feeSol} USDC` : '0 USDC'}</span></span>
                            {oracle.address && oracle.id !== 'custom' && (
                              <span className="truncate max-w-[200px]">🔑 SIGNER: <span className="text-white select-all">{oracle.address.slice(0, 4)}...{oracle.address.slice(-4)}</span></span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* AI Oracle prompt setups */}
              {(selectedOracleId === 'ai-sonnet' || selectedOracleId === 'ai-consensus') && (
                <div className="space-y-4 bg-trench-black p-4 border border-trench-sandbag rounded shadow-inner animate-fadeIn">
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold text-neon-moon uppercase tracking-wider">
                      AI Arbitrage Prompts / Rules:
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="SPECIFY PRECISE INSTRUCTIONS FOR THE AI RESOLVER... e.g. WILL $TRUMP HIT 20 USD ON BY EXPIRY? RESOLVE MOON IF TRUE, OTHERWISE JEET."
                      value={resolutionCriteria}
                      onChange={(e) => setResolutionCriteria(e.target.value)}
                      className="w-full px-3 py-2 bg-trench-mud border border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-wider font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold text-neon-moon uppercase tracking-wider flex items-center gap-1">
                      <Globe size={12} />
                      <span>Reference URL (Optional Scraper Target):</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://twitter.com/realDonaldTrump or news source link"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-trench-mud border border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* DAO Jury & Custom Signer details */}
              {(selectedOracleId === 'dao-jury' || selectedOracleId === 'custom') && (
                <div className="space-y-4 bg-trench-black p-4 border border-trench-sandbag rounded shadow-inner animate-fadeIn">
                  {selectedOracleId === 'custom' && (
                    <div className="space-y-2">
                      <label className="block font-mono text-[10px] font-bold text-neon-moon uppercase tracking-wider">
                        Arbitrator Wallet Public Key:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="PASTE THE ARBITRATOR'S PUBLIC KEY OR EVM ADDRESS..."
                        value={customOracleAddress}
                        onChange={(e) => setCustomOracleAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-trench-mud border border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase font-bold"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold text-neon-moon uppercase tracking-wider">
                      Resolution Criteria Details:
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="EXPLAIN UNDER WHAT CONDITIONS THIS ARENA RESOLVES TO MOON, JEET, OR DRAW..."
                      value={resolutionCriteria}
                      onChange={(e) => setResolutionCriteria(e.target.value)}
                      className="w-full px-3 py-2 bg-trench-mud border border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-wider font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Custom Oracle Fee configurator */}
              {selectedOracleId === 'custom' && (
                <div className="bg-trench-mud p-4 border border-trench-sandbag rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block font-staatliches text-base text-white tracking-wider uppercase">
                      💰 Custom Oracle Arbitrage Fee:
                    </label>
                    <span className="font-mono text-sm text-neon-moon font-bold glow-moon">
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
                  <div className="flex justify-between text-[8px] text-trench-gasmask font-mono">
                    <span>1 USDC</span>
                    <span>100 USDC (MAX)</span>
                  </div>
                  <p className="font-mono text-[8px] text-trench-gasmask uppercase font-bold leading-tight">
                    *Paid directly to the resolver wallet when they invoke settlement. Deducted from winning pool.
                  </p>
                </div>
              )}

              {/* Wizard Nav buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-2.5 bg-trench-sandbag hover:bg-trench-gasmask font-staatliches text-xl text-white border border-trench-sandbag/80 rounded tracking-wider flex items-center gap-1.5 active:translate-y-0.5 transition-all uppercase"
                >
                  <ArrowLeft size={18} />
                  <span>BACK</span>
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-neon-moon hover:bg-green-500 font-staatliches text-xl text-black border-b-4 border-green-800 rounded tracking-wider flex items-center gap-1.5 active:translate-y-0.5 transition-all uppercase font-bold"
                >
                  <span>NEXT: AMMO SEED</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIGURE PARAMETERS & SEED AMMO */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Duration selector */}
              <div className="space-y-3">
                <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                  Battle Duration Option:
                </label>
                <div className="px-1">
                  <input 
                    type="range" 
                    min="5" 
                    max="10080" 
                    step="5"
                    value={duration} 
                    onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-full accent-neon-moon cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-trench-gasmask font-mono mt-1">
                    <span>5 MIN</span>
                    <span>1 WEEK</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
                      className={`px-3 py-1.5 border rounded font-mono text-xs transition-all ${
                        duration === opt.time
                          ? 'border-neon-moon bg-neon-moon/10 text-neon-moon shadow-glow-moon'
                          : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ammo Seeding Frame */}
              <div className="space-y-3 bg-trench-mud border-2 border-trench-sandbag p-4 rounded-lg shadow-inner">
                <div className="flex justify-between items-center border-b border-trench-sandbag/40 pb-2">
                  <label className="block font-staatliches text-lg text-white uppercase tracking-wider">
                    ⚔️ Initial Seeding Ammo (*Required)
                  </label>
                  <span className="font-mono text-sm text-moon-gold font-bold glow-gold">
                    {seedAmount} USDC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-trench-black p-1 border border-trench-sandbag rounded">
                  <button
                    type="button"
                    onClick={() => { setSeedSide('moon'); synthSound('bet'); }}
                    className={`py-2 font-staatliches text-sm tracking-wider uppercase rounded transition-all ${
                      seedSide === 'moon' ? 'bg-neon-moon text-black font-bold shadow-glow-moon' : 'text-trench-gasmask hover:text-white'
                    }`}
                  >
                    Seed Moon
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSeedSide('jeet'); synthSound('bet'); }}
                    className={`py-2 font-staatliches text-sm tracking-wider uppercase rounded transition-all ${
                      seedSide === 'jeet' ? 'bg-jeet-red text-white font-bold shadow-glow-jeet' : 'text-trench-gasmask hover:text-white'
                    }`}
                  >
                    Seed Jeet
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="relative flex items-center bg-trench-black border-2 border-trench-sandbag rounded focus-within:border-neon-moon transition-all">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Seeding Ammo Amount (USDC)"
                      value={seedAmount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSeedAmount(isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-transparent px-3 py-2.5 text-white font-mono text-sm focus:outline-none"
                    />
                    <span className="absolute right-3 font-mono text-[10px] text-trench-gasmask font-bold tracking-wider uppercase">
                      USDC AMMO
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Boundaries */}
              {arenaType === 'token' && (
                <div className="space-y-2">
                  <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                    Opening Price Type:
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-trench-black p-1 border border-trench-sandbag rounded">
                    <button
                      type="button"
                      onClick={() => { setOpeningPriceType('market'); synthSound('bet'); }}
                      className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                        openingPriceType === 'market' ? 'bg-neon-moon text-black font-bold shadow-glow-moon' : 'text-trench-gasmask hover:text-white'
                      }`}
                    >
                      Market Price ⚡
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOpeningPriceType('set'); synthSound('bet'); }}
                      className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                        openingPriceType === 'set' ? 'bg-moon-gold text-black font-bold shadow-glow-gold' : 'text-trench-gasmask hover:text-white'
                      }`}
                    >
                      Set Price 🎯
                    </button>
                  </div>

                  {openingPriceType === 'set' && (
                    <div className="space-y-2 pt-2 animate-fadeIn">
                      <span className="font-mono text-[10px] text-moon-gold font-bold uppercase block">
                        🎯 CUSTOM STARTING PRICE (USD):
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={customSetPrice}
                        onChange={(e) => setCustomSetPrice(e.target.value)}
                        className="w-full bg-trench-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Wizard Nav buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-2.5 bg-trench-sandbag hover:bg-trench-gasmask font-staatliches text-xl text-white border border-trench-sandbag/80 rounded tracking-wider flex items-center gap-1.5 active:translate-y-0.5 transition-all uppercase"
                >
                  <ArrowLeft size={18} />
                  <span>BACK</span>
                </button>
                <button
                  type="submit"
                  disabled={isTransactionLoading}
                  className="px-8 py-2.5 bg-neon-moon hover:bg-green-500 disabled:bg-trench-sandbag disabled:text-trench-gasmask disabled:border-trench-sandbag disabled:shadow-none disabled:cursor-not-allowed font-staatliches text-2xl text-black border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all rounded uppercase flex items-center justify-center gap-2 font-bold"
                >
                  {isTransactionLoading ? (
                    <>
                      <Loader2 className="animate-spin text-black shrink-0" size={24} />
                      <span>LAUNCHING ARENA...</span>
                    </>
                  ) : (
                    <>
                      <PepePortrait src={PEPE_ASSETS.diamondHands} size={28} className="rounded-full" />
                      <span>LAUNCH ARENA 💣</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </form>

        <div className="mt-6 border-t-2 border-trench-sandbag/45 pt-4 flex gap-2 items-start text-trench-gasmask">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={32} glowColor="gold" className="rounded shrink-0" />
          <p className="font-mono text-[9px] uppercase leading-tight font-bold">
            Notice: Seeding immediately locks USDC into the pot. Challenge window locks status for 30 minutes post-settlement to allow community disputes. Play hard.
          </p>
        </div>

        {/* Degen Quote at bottom */}
        <div className="mt-4">
          <DegenQuoteBanner />
        </div>

      </div>

    </div>
  );
}
