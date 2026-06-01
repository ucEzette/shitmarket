import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { logger } from '../logger';

/**
 * dbPruner.ts
 *
 * Core utility that routinely clears obsolete database tables for space preservation
 * and backs up all chat messages (the chat communication radar) to local JSON archives.
 */

export async function runPruner(): Promise<{
  backupPath: string | null;
  prunedChatsCount: number;
  prunedSamplesCount: number;
  prunedTxsCount: number;
}> {
  logger.info('Starting Database Pruner & Chat Radar Backup...');
  
  let backupPath: string | null = null;
  let prunedChatsCount = 0;
  let prunedSamplesCount = 0;
  let prunedTxsCount = 0;

  try {
    // 1. Establish Backup Directory recursively
    const backupDir = path.resolve(__dirname, '../../backups/chats');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      logger.info({ msg: 'Created chat backups directory', backupDir });
    }

    // 2. Fetch all chat messages from DB for full archive backup
    const chats = await prisma.chatMessage.findMany({
      orderBy: { timestamp: 'asc' },
    });

    if (chats.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `chat_backup_${timestamp}.json`;
      const fullPath = path.join(backupDir, filename);

      // Serialize chats with bigint-safe mapping (if any numeric fields exist, though chats are string-based)
      const serialized = JSON.stringify(
        chats.map((c) => ({
          id: c.id,
          roomPubkey: c.roomPubkey,
          side: c.side,
          user: c.user,
          message: c.message,
          timestamp: c.timestamp.toISOString(),
        })),
        null,
        2
      );

      fs.writeFileSync(fullPath, serialized, 'utf8');
      backupPath = fullPath;
      logger.info({ msg: 'Chat communication radar backed up successfully', filename, count: chats.length });
    } else {
      logger.info('No chat messages in database to back up.');
    }

    // 3. Prune old ChatMessages from PostgreSQL (keep last 7 days of chat in DB for fast UI load)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const chatsDel = await prisma.chatMessage.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo,
        },
      },
    });
    prunedChatsCount = chatsDel.count;

    // 4. Prune high-frequency PriceSamples from PostgreSQL (keep last 24 hours of price samples for TWAP)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const samplesDel = await prisma.priceSample.deleteMany({
      where: {
        createdAt: {
          lt: oneDayAgo,
        },
      },
    });
    prunedSamplesCount = samplesDel.count;

    // 5. Prune ProcessedTx idempotency logs from PostgreSQL (keep last 30 days of signatures)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const txsDel = await prisma.processedTx.deleteMany({
      where: {
        processedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    prunedTxsCount = txsDel.count;

    logger.info({
      msg: 'Database space preservation pruning complete ✅',
      prunedChats: prunedChatsCount,
      prunedSamples: prunedSamplesCount,
      prunedTxs: prunedTxsCount,
    });

  } catch (err: any) {
    logger.error({ msg: 'Database pruner/backup execution failed', error: err?.message || String(err) });
    throw err;
  }

  return {
    backupPath,
    prunedChatsCount,
    prunedSamplesCount,
    prunedTxsCount,
  };
}
