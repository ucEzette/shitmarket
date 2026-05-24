const fs = require('fs');

let content = fs.readFileSync('src/app/profile/page.tsx', 'utf8');

content = content.replace(
  "import { ShieldCheck, Award, Zap, TrendingUp, TrendingDown, RefreshCw, X, Play } from 'lucide-react';",
  "import { ShieldCheck, Award, Zap, TrendingUp, TrendingDown, RefreshCw, X, Play, Edit2, Camera, AlertTriangle, Save, Loader2, Copy, Check, Users, Coins } from 'lucide-react';"
);

// We need AnimatePresence from framer-motion. It's likely already there? Wait, page.tsx has:
// import { motion } from 'framer-motion';
// Let's add AnimatePresence
if (!content.includes('AnimatePresence')) {
  content = content.replace("import { motion } from 'framer-motion';", "import { motion, AnimatePresence } from 'framer-motion';");
}

const hookReplacement = `export default function ProfilePage() {
  const { user, connectWallet, updateProfile } = useAppState();
  const [replayBet, setReplayBet] = useState<{
    token: string;
    side: 'moon' | 'jeet';
    amount: number;
    result: 'win' | 'loss';
  } | null>(null);

  // --- Profile Edit State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  
  // --- Referral State ---
  const [copiedLink, setCopiedLink] = useState(false);

  React.useEffect(() => {
    if (user && !isEditing) {
      setEditUsername(user.username || '');
      setEditAvatar(user.avatarUrl || '');
    }
  }, [user, isEditing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setEditError('IMAGE TOO LARGE (MAX 2MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditAvatar(event.target?.result as string);
      setEditError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setEditError('');
    try {
      const res = await updateProfile(editUsername, editAvatar);
      if (res.success) {
        setIsEditing(false);
        synthSound('bet');
      } else {
        setEditError(res.error || 'FAILED TO UPDATE');
        synthSound('defeat');
      }
    } catch (err) {
      setEditError('NETWORK ERROR');
      synthSound('defeat');
    }
    setIsSaving(false);
  };

  const handleCopyLink = () => {
    if (user?.referralCode) {
      const link = \`\${window.location.origin}/rooms?ref=\${user.referralCode}\`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      synthSound('bet');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };
`;

const splitByHook = content.split("export default function ProfilePage() {");
const secondPart = splitByHook[1].substring(splitByHook[1].indexOf("} | null>(null);") + 16);
content = splitByHook[0] + hookReplacement + secondPart;

// Replace Soldier Card
const cardStart = "{/* Left Column: Soldier Passport ID Card (5 cols) */}";
const cardEnd = "FRONT PASS APPROVED FOR PvP ARENA\n                </span>\n              </div>\n            </div>";
const newSoldierCard = `{/* Left Column: Soldier Passport ID Card (5 cols) */}
            <div className="lg:col-span-5 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 flex flex-col justify-between relative shadow-lg scanlines">
              {/* Clipboard corner details */}
              <div className="absolute top-2 right-2 font-mono text-[8px] text-trench-gasmask/50 uppercase font-bold flex items-center gap-2">
                HQ-DOCS #8420-AA
                <button onClick={() => { setIsEditing(!isEditing); setEditError(''); }} className="text-neon-moon hover:text-white transition-colors bg-neon-moon/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-neon-moon/30">
                  {isEditing ? <X size={10} /> : <Edit2 size={10} />} {isEditing ? 'CANCEL' : 'EDIT'}
                </button>
              </div>

              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
                  <PixelCrackedHelmet size={20} />
                  SOLDIER PORTRAIT
                </h3>

                {/* Passport Card details */}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <div className={\`w-28 h-28 bg-gradient-to-br \${getAvatarBg()} border-4 border-trench-sandbag rounded flex items-center justify-center relative shadow-inner overflow-hidden shrink-0 group\`}>
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[size:100%_4px] pointer-events-none z-10" />
                      <img src={isEditing ? (editAvatar || PEPE_ASSETS.fewUnderstand) : (user.avatarUrl || PEPE_ASSETS.chadBull)} alt="Commander Avatar" className="w-full h-full object-cover relative z-0 group-hover:scale-110 transition-transform duration-300" />
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      <span className="font-mono text-[9px] text-neon-moon font-bold bg-neon-moon/10 px-2 py-0.5 border border-neon-moon/30 rounded uppercase tracking-wider inline-block">
                        COMMAND SQUAD ACTIVE
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          maxLength={30}
                          placeholder="ENTER CALLSIGN"
                          className="w-full bg-trench-black border border-trench-sandbag text-white font-staatliches text-xl px-2 py-1 outline-none focus:border-neon-moon mt-1"
                        />
                      ) : (
                        <h4 className="font-staatliches text-2xl text-white tracking-wide truncate leading-none mt-1" title={user.username || \`COMMANDER_\${user.wallet!.substring(0, 6)}\`}>
                          {user.username || \`COMMANDER_\${user.wallet!.substring(0, 6)}\`}
                        </h4>
                      )}
                      <p className="font-mono text-[10px] text-trench-gasmask truncate uppercase leading-tight font-bold">
                        {user.wallet}
                      </p>
                      <p className="font-mono text-xs text-moon-gold font-bold">
                        Balance: {user.balance.toFixed(2)} Ammo SOL
                      </p>
                    </div>
                  </div>

                  {/* Edit Controls */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 border-t border-trench-sandbag/40 pt-4">
                          <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold mb-2 block">SELECT AVATAR PRESET</span>
                          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {[PEPE_ASSETS.chadBull, PEPE_ASSETS.apeGeneral, PEPE_ASSETS.diamondHands, PEPE_ASSETS.neonWojak, PEPE_ASSETS.jeetSkeleton, PEPE_ASSETS.fewUnderstand].map((preset, idx) => (
                              <button key={idx} onClick={() => setEditAvatar(preset)} className={\`w-12 h-12 shrink-0 border-2 rounded overflow-hidden \${editAvatar === preset ? 'border-neon-moon shadow-glow-moon' : 'border-trench-sandbag hover:border-white/50'} transition-all\`}>
                                <img src={preset} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                          
                          <div className="mt-3 flex items-center gap-3">
                            <label className="flex-1 cursor-pointer bg-trench-black hover:bg-[#1a1c23] border border-dashed border-trench-sandbag text-trench-gasmask hover:text-white font-mono text-[10px] uppercase font-bold py-2 text-center rounded transition-colors flex justify-center items-center gap-2">
                              <Camera size={14} /> UPLOAD CUSTOM AVI
                              <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" className="hidden" onChange={handleFileUpload} />
                            </label>
                          </div>

                          {editError && (
                            <div className="mt-3 font-mono text-[10px] text-jeet-red bg-jeet-red/10 border border-jeet-red/30 px-2 py-1 rounded flex items-center gap-2 uppercase font-bold">
                              <AlertTriangle size={12} /> {editError}
                            </div>
                          )}

                          <button onClick={handleSaveProfile} disabled={isSaving} className="mt-4 w-full bg-neon-moon/20 hover:bg-neon-moon/40 border border-neon-moon text-neon-moon py-2 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} SAVE RECRUIT ID
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Gritty Rating Badge with ELO */}
                <div className="mt-8 bg-trench-black border-2 border-trench-sandbag p-4 rounded flex items-center justify-between gap-4 shadow-inner">
                  <div>
                    <span className="font-staatliches text-lg text-white tracking-wide block uppercase leading-none">
                      TRENCH CLASSIFICATION
                    </span>
                    <span className={\`font-mono text-[10px] \${userClass.color} uppercase font-bold\`}>
                      {userClass.label} — ELO {userElo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={\`font-staatliches text-xl \${userClass.color} block leading-tight\`}>
                        {userElo}
                      </span>
                      <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold leading-tight">
                        ELO
                      </span>
                    </div>
                    <div className="bg-trench-mud border-4 border-trench-sandbag rounded p-1.5 h-16 w-16 flex flex-col items-center justify-center relative">
                      <span className="absolute inset-0 border border-black/40 rounded-sm pointer-events-none" />
                      <span className={\`font-staatliches text-3xl \${userClass.color} leading-none font-black shadow-inner\`}>
                        {user.trenchScore}
                      </span>
                      <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold leading-none -mt-0.5">
                        CLASS
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-6 border-t border-trench-sandbag/40 pt-4 text-center">
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold tracking-widest block">
                  FRONT PASS APPROVED FOR PvP ARENA
                </span>
              </div>
            </div>`;

const cardStartIndex = content.indexOf(cardStart);
const cardEndIndex = content.indexOf(cardEnd) + cardEnd.length;
content = content.substring(0, cardStartIndex) + newSoldierCard + content.substring(cardEndIndex);

// Add Referral HQ after the BATTLE LOGS container.
const battleLogsEnd = ")}\n          </div>";
const battleLogsLastIndex = content.lastIndexOf(battleLogsEnd);
if (battleLogsLastIndex === -1) {
    console.error("Could not find battle logs end");
    process.exit(1);
}

const referralModule = `          </div>

          {/* 5. TRENCH REFERRAL HQ */}
          <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines mt-8">
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
              <Users className="text-neon-moon animate-pulse" />
              TRENCH REFERRAL HQ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left side: Link and Metrics */}
              <div className="space-y-6">
                <div className="bg-trench-black border border-trench-sandbag rounded p-5 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Users size={64} />
                  </div>
                  <span className="font-mono text-[10px] text-trench-gasmask block uppercase font-bold mb-2">
                    YOUR UNIQUE INVITATION CODE
                  </span>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-trench-mud border-2 border-trench-sandbag rounded px-3 py-2 font-mono text-xs text-white truncate shadow-inner flex items-center">
                      \${typeof window !== 'undefined' ? window.location.origin : ''}/rooms?ref={user.referralCode}
                    </div>
                    <button 
                      onClick={handleCopyLink}
                      className={\`shrink-0 py-2 px-4 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 border-b-4 active:translate-y-1 \${
                        copiedLink 
                          ? 'bg-neon-moon text-trench-black border-neon-moon/50 shadow-glow-moon' 
                          : 'bg-jeet-red hover:bg-red-700 text-white border-red-950 shadow-glow-jeet'
                      }\`}
                    >
                      {copiedLink ? <><Check size={16} /> COPIED</> : <><Copy size={16} /> COPY LINK</>}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-neon-moon uppercase font-bold mt-3 max-w-[250px] leading-relaxed">
                    Earn 0.1% ammo SOL on every mission deployed by your enlisted recruits. Paid automatically on-chain.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-trench-black border border-trench-sandbag rounded p-4 text-center shadow-inner">
                    <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block">ENLISTED RECRUITS</span>
                    <span className="font-staatliches text-3xl text-white block mt-1 glow-white">{user.referralsCount || 0}</span>
                  </div>
                  <div className="bg-trench-black border border-trench-sandbag rounded p-4 text-center shadow-inner">
                    <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block">COMMISSION (SOL)</span>
                    <span className="font-staatliches text-3xl text-moon-gold block mt-1 glow-gold">
                      {((Number(user.referralEarnings) || 0) / 1e9).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: Ledger */}
              <div className="bg-trench-black border border-trench-sandbag rounded flex flex-col shadow-inner overflow-hidden max-h-[250px]">
                <div className="border-b border-trench-sandbag p-3 bg-trench-mud/50">
                  <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold flex items-center gap-1.5">
                    <Coins size={12} className="text-moon-gold" />
                    RECENT COMMISSION PAYOUTS
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {user.referralPayouts && user.referralPayouts.length > 0 ? (
                    user.referralPayouts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-trench-mud border border-trench-sandbag/50 rounded p-2 text-[10px] font-mono">
                        <div>
                          <div className="text-white font-bold">RECRUIT_{p.invitee.substring(0,4)}</div>
                          <div className="text-trench-gasmask mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-neon-moon font-bold glow-moon">+{((Number(p.rewardAmount) || 0)/1e9).toFixed(3)} SOL</div>
                          {p.txSig && (
                            <a href={\`https://solscan.io/tx/\${p.txSig}?cluster=devnet\`} target="_blank" rel="noreferrer" className="text-trench-gasmask hover:text-white underline mt-0.5 block">
                              VIEW TX
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <span className="font-staatliches text-lg text-trench-gasmask uppercase">NO PAYOUTS YET</span>
                      <span className="font-mono text-[9px] text-trench-gasmask/50 uppercase font-bold mt-1">
                        Distribute your invite code to start earning.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>`;

content = content.substring(0, battleLogsLastIndex) + referralModule + content.substring(battleLogsLastIndex + battleLogsEnd.length);

fs.writeFileSync('src/app/profile/page.tsx', content);
console.log("Profile page successfully rewritten!");
