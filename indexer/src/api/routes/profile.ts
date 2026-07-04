import express from 'express';
import { prisma, prismaRead } from '../../db';
import { logger } from '../../logger';
import { validate, walletParamSchema } from '../validation';
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../../config';

export const profileRouter = express.Router();

// Parse custom borsh layout of Bet PDA (115 bytes)
function parseBet(data: Buffer) {
  if (data.length < 115) return null;
  try {
    const room = new PublicKey(data.subarray(8, 40)).toBase58();
    const user = new PublicKey(data.subarray(40, 72)).toBase58();
    const currentOwner = new PublicKey(data.subarray(72, 104)).toBase58();
    const side = data[104] === 0 ? 'moon' : 'jeet';
    const amount = data.readBigUInt64LE(105);
    const claimed = data[113] !== 0;
    return { room, user, currentOwner, side, amount, claimed };
  } catch (e: any) {
    logger.error({ msg: 'Failed to parse on-chain bet data buffer', err: e.message });
    return null;
  }
}

// ── GET /api/profile/:wallet ───────────────────────────────────────────────────

profileRouter.get('/:wallet', validate(walletParamSchema, 'params'), async (req, res) => {
  try {
    const { wallet } = req.params;

    // Self-healing: Fetch on-chain bets for this wallet as current owner and sync with database
    try {
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const programId = new PublicKey(config.solana.programId);
      const onChainAccounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 115 },
          { memcmp: { offset: 72, bytes: wallet } }
        ]
      });

      for (const acc of onChainAccounts) {
        const parsed = parseBet(acc.account.data);
        if (parsed) {
          let dbBet = await prisma.bet.findFirst({
            where: {
              roomPubkey: parsed.room,
              userPubkey: wallet,
              side: parsed.side
            }
          });

          if (!dbBet && parsed.user !== wallet) {
            // Find the bet under original bettor key that hasn't been updated to buyer yet
            dbBet = await prisma.bet.findFirst({
              where: {
                roomPubkey: parsed.room,
                userPubkey: parsed.user,
                side: parsed.side
              }
            });
          }

          if (dbBet) {
            if (dbBet.userPubkey !== wallet || dbBet.amount !== parsed.amount || dbBet.claimed !== parsed.claimed) {
              await prisma.bet.update({
                where: { id: dbBet.id },
                data: {
                  userPubkey: wallet,
                  amount: parsed.amount,
                  claimed: parsed.claimed
                }
              });
              logger.info({ msg: 'Self-healed / synced bet in database', betId: dbBet.id, wallet, amount: parsed.amount.toString() });
            }
          } else {
            const newBet = await prisma.bet.create({
              data: {
                roomPubkey: parsed.room,
                userPubkey: wallet,
                side: parsed.side,
                amount: parsed.amount,
                claimed: parsed.claimed,
                txSig: 'onchain-sync'
              }
            });
            logger.info({ msg: 'Self-healed / created missing bet in database', betId: newBet.id, wallet, amount: parsed.amount.toString() });
          }
        }
      }
    } catch (err: any) {
      logger.warn({ msg: 'Self-healing on-chain bets sync failed', err: err.message });
    }

    let profile = await prisma.userProfile.findUnique({
      where: { userPubkey: wallet },
    });

    if (profile && !profile.referralCode) {
      let fallbackCode = wallet.slice(0, 6) + Math.floor(1000 + Math.random() * 9000);
      let attempts = 0;
      let success = false;
      while (attempts < 5 && !success) {
        try {
          profile = await prisma.userProfile.update({
            where: { userPubkey: wallet },
            data: { referralCode: fallbackCode }
          });
          logger.info({ msg: 'Self-healed missing referral code in profile', wallet, fallbackCode });
          success = true;
        } catch (err: any) {
          fallbackCode = wallet.slice(0, 6) + Math.floor(1000 + Math.random() * 9000);
          attempts++;
        }
      }
    }

    // Compute referral stats
    const referralsCount = await prisma.userProfile.count({
      where: { referredBy: wallet },
    });

    const referralPayouts = await prisma.referralPayout.findMany({
      where: { referrer: wallet },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const totalReferralEarnings = referralPayouts.reduce((acc, p) => acc + BigInt(p.rewardAmount), BigInt(0));

    if (!profile) {
      // Create a default profile to ensure unique referralCode is persisted immediately
      let generatedReferralCode = wallet.slice(0, 6) + Math.floor(1000 + Math.random() * 9000);
      let attempts = 0;
      let success = false;
      while (attempts < 5 && !success) {
        try {
          profile = await prisma.userProfile.create({
            data: {
              userPubkey: wallet,
              referralCode: generatedReferralCode,
            }
          });
          logger.info({ msg: 'Created default user profile on GET', wallet, referralCode: generatedReferralCode });
          success = true;
        } catch (err: any) {
          generatedReferralCode = wallet.slice(0, 6) + Math.floor(1000 + Math.random() * 9000);
          attempts++;
        }
      }

      if (!profile) {
        // Fallback in case DB write fails to prevent route crashing
        return res.json({
          success: true,
          data: {
            userPubkey: wallet,
            totalBets: 0,
            wins: 0,
            losses: 0,
            profit: '0',
            trenchScore: 'D',
            achievements: [],
            winRate: 0,
            username: null,
            avatarUrl: null,
            referredBy: null,
            referralCode: generatedReferralCode,
            referralsCount: 0,
            referralEarnings: '0',
            referralPayouts: [],
            bets: [],
            winStreak: 0,
            longestWinStreak: 0,
            biggestBet: '0',
          },
        });
      }
    }

    // Compute win rate
    const winRate =
      profile.totalBets > 0
        ? Math.round((profile.wins / profile.totalBets) * 100)
        : 0;

    // Fetch all user's bets to calculate winStreak, longestWinStreak, and biggestBet accurately
    const allBetsForCalc = await prisma.bet.findMany({
      where: { userPubkey: wallet },
      orderBy: { createdAt: 'desc' },
      include: {
        room: {
          select: {
            tokenName: true,
            tokenSymbol: true,
            tokenImageUrl: true,
            status: true,
            winner: true,
          },
        },
      },
    });

    let winStreak = 0;
    let longestWinStreak = 0;
    let biggestBet = 0n;

    // Calculate longest win streak chronologically
    const chronologicalBets = [...allBetsForCalc].reverse();
    let tempStreak = 0;
    for (const b of chronologicalBets) {
      if (b.room.status === 'settled') {
        const won = b.side === b.room.winner;
        if (won) {
          tempStreak++;
          if (tempStreak > longestWinStreak) {
            longestWinStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      }
    }

    // Calculate current win streak going backwards chronologically (from most recent bet backwards)
    for (const b of allBetsForCalc) {
      if (b.room.status === 'settled') {
        const won = b.side === b.room.winner;
        if (won) {
          winStreak++;
        } else {
          break; // broke the streak
        }
      }
    }

    // Calculate biggest bet
    for (const b of allBetsForCalc) {
      if (b.amount > biggestBet) {
        biggestBet = b.amount;
      }
    }

    // Fetch recent bet history (limited to 20 for profile display page performance)
    const bets = allBetsForCalc.slice(0, 20).map((b) => ({
      ...b,
      amount: b.amount.toString(),
      won: b.room.status === 'settled' && b.side === b.room.winner,
    }));

    // Fetch activities
    const activities = await prisma.activity.findMany({
      where: { userPubkey: wallet },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({
      success: true,
      data: {
        ...profile,
        profit: profile.profit.toString(),
        winRate,
        referralsCount,
        referralEarnings: totalReferralEarnings.toString(),
        referralPayouts: referralPayouts.map(p => ({
          ...p,
          betAmount: p.betAmount.toString(),
          rewardAmount: p.rewardAmount.toString(),
        })),
        bets,
        activities: activities.map(a => ({
          ...a,
          timestamp: new Date(a.createdAt).getTime(),
        })),
        winStreak,
        longestWinStreak,
        biggestBet: biggestBet.toString(),
      },
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/profile/:wallet error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/profile/update ─────────────────────────────────────────────────

profileRouter.post('/update', async (req, res) => {
  try {
    const { userPubkey, username, avatarUrl, referredBy } = req.body;

    if (!userPubkey) {
      return res.status(400).json({ success: false, error: 'userPubkey is required' });
    }

    // Clean up username
    const cleanUsername = username ? username.trim().slice(0, 30) : undefined;

    // Generate unique referral code
    let referralCode = undefined;
    if (cleanUsername) {
      referralCode = cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
      const codeExists = await prisma.userProfile.findFirst({
        where: { referralCode }
      });
      if (codeExists) {
        referralCode = `${referralCode}${Math.floor(100 + Math.random() * 900)}`;
      }
    } else {
      referralCode = userPubkey.slice(0, 6) + Math.floor(1000 + Math.random() * 9000);
    }

    const existingProfile = await prisma.userProfile.findUnique({
      where: { userPubkey },
    });

    // Check if username is already taken by another wallet
    if (cleanUsername) {
      const taken = await prisma.userProfile.findFirst({
        where: {
          username: { equals: cleanUsername, mode: 'insensitive' },
          NOT: { userPubkey }
        }
      });
      if (taken) {
        return res.status(400).json({ success: false, error: 'Username is already taken' });
      }
    }

    let finalReferredBy: string | undefined = undefined;
    if (referredBy && referredBy !== userPubkey) {
      let resolvedReferrer: string | null = null;
      if (referredBy.length !== 44) {
        const refProfile = await prisma.userProfile.findFirst({
          where: { referralCode: { equals: referredBy, mode: 'insensitive' } }
        });
        if (refProfile) {
          resolvedReferrer = refProfile.userPubkey;
        }
      } else {
        resolvedReferrer = referredBy;
      }

      if (resolvedReferrer && resolvedReferrer !== userPubkey) {
        finalReferredBy = resolvedReferrer;
      }
    }

    const profile = await prisma.userProfile.upsert({
      where: { userPubkey },
      create: {
        userPubkey,
        username: cleanUsername,
        avatarUrl,
        referredBy: finalReferredBy,
        referralCode,
      },
      update: {
        username: cleanUsername !== undefined ? cleanUsername : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        referredBy: existingProfile?.referredBy ? undefined : finalReferredBy, // set only once
      }
    });

    return res.json({ success: true, data: profile });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/profile/update error', err: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
  }
});

// ── POST /api/profile/activities ─────────────────────────────────────────────

profileRouter.post('/activities', async (req, res) => {
  try {
    const { userPubkey, type, title, message, link } = req.body;

    if (!userPubkey || !type || !title || !message) {
      return res.status(400).json({ success: false, error: 'Missing required activity fields' });
    }

    const activity = await prisma.activity.create({
      data: {
        userPubkey,
        type,
        title,
        message,
        link,
      }
    });

    return res.json({ success: true, data: activity });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/profile/activities error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/profile/activities/read ────────────────────────────────────────

profileRouter.post('/activities/read', async (req, res) => {
  try {
    const { userPubkey } = req.body;

    if (!userPubkey) {
      return res.status(400).json({ success: false, error: 'userPubkey is required' });
    }

    await prisma.activity.updateMany({
      where: { userPubkey, read: false },
      data: { read: true }
    });

    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/profile/activities/read error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
