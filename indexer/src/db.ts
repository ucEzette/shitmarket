import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaRead: PrismaClient | undefined;
}

// ── Primary (Write) Client ─────────────────────────────────────
// Singleton to avoid multiple connections in dev hot-reload
export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// ── Read Replica Client (Phase 4.2) ────────────────────────────
// For read-heavy API routes (leaderboard, rooms list, profile).
// Falls back to primary if no replica URL configured.
export const prismaRead: PrismaClient =
  global.__prismaRead ??
  new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
    datasources: config.db.replicaUrl
      ? {
          db: {
            url: config.db.replicaUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaRead = prismaRead;
}

// ── Event Logging ───────────────────────────────────────────────

(prisma as any).$on('error', (e: any) => logger.error({ msg: 'Prisma write error', error: e }));
(prisma as any).$on('warn', (e: any) => logger.warn({ msg: 'Prisma write warning', warn: e }));

(prismaRead as any).$on('error', (e: any) => logger.error({ msg: 'Prisma read error', error: e }));
(prismaRead as any).$on('warn', (e: any) => logger.warn({ msg: 'Prisma read warning', warn: e }));

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL primary connected');

  if (config.db.replicaUrl) {
    await prismaRead.$connect();
    logger.info('PostgreSQL replica connected');
  }
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  await prismaRead.$disconnect();
  logger.info('PostgreSQL connections closed');
}
