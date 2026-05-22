import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import idl from '../../../src/utils/idl.json';

const PROGRAM_ID = new PublicKey(config.solana.programId);

function loadKeeperKeypair(): Keypair {
  const raw = config.solana.keeperPrivateKey;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

export async function runTwapCron() {
  const connection = new Connection(config.solana.rpcUrl, 'confirmed');
  const keeper = loadKeeperKeypair();
  const wallet = new anchor.Wallet(keeper);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
  const program = new anchor.Program(idlWithAddress as anchor.Idl, provider);

  logger.info({ msg: 'Running TWAP cron job...' });

  try {
    // Find all active rooms
    const activeRooms = await prisma.room.findMany({
      where: { status: 'active' },
    });

    if (activeRooms.length === 0) {
      logger.debug({ msg: 'No active rooms found for TWAP recording.' });
      return;
    }

    const keeperPubkey = keeper.publicKey;
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_config')],
      PROGRAM_ID
    );

    let successCount = 0;
    let failCount = 0;

    for (const room of activeRooms) {
      try {
        const roomPubkey = new PublicKey(room.roomPubkey);
        const tokenMint = room.tokenMint;
        
        // Find Pyth feed
        const pythFeedMap = config.pythFeedMapping;
        const feedStr = pythFeedMap[tokenMint] || "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4GGKAD";
        const priceFeed = new PublicKey(feedStr);

        await program.methods
          .recordTwap()
          .accounts({
            room: roomPubkey,
            priceFeed: priceFeed,
            keeper: keeperPubkey,
            config: configPda,
          })
          .rpc();
        
        successCount++;
        logger.debug({ msg: 'Recorded TWAP sample', room: room.roomPubkey });
      } catch (err: any) {
        failCount++;
        logger.error({ msg: 'Failed to record TWAP for room', room: room.roomPubkey, error: err.message });
      }
    }

    logger.info({ msg: 'TWAP cron finished', successCount, failCount });
  } catch (err: any) {
    logger.error({ msg: 'TWAP cron failed', error: err.message });
  }
}
