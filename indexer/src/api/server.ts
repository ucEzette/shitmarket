import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { roomsRouter } from './routes/rooms';
import { validationRouter } from './routes/validation';
import { profileRouter } from './routes/profile';
import { leaderboardRouter } from './routes/leaderboard';
import { reservesRouter } from './routes/reserves';
import { register, apiRequestDuration } from '../metrics/prometheus';
import { config } from '../config';
import { logger } from '../logger';
import { prisma, prismaRead } from '../db';
import { redis } from '../redis';
import type { RpcCircuitBreaker } from '../solana/rpcCircuitBreaker';
import { sentryErrorHandler, captureError } from '../sentry';

// ─── Health check helpers ──────────────────────────────────────────────────────

async function checkDb(): Promise<{ status: 'ok' | 'error'; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<{ status: 'ok' | 'error'; latencyMs: number }> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

async function checkRpc(
  cb: RpcCircuitBreaker | null
): Promise<{ status: 'ok' | 'degraded' | 'error'; circuitState: string; isPrimary: boolean; slot?: number }> {
  const connection = cb?.getConnection();
  if (!connection || !cb) {
    return { status: 'ok', circuitState: 'CLOSED', isPrimary: true };
  }
  try {
    const slot = await connection.getSlot();
    return {
      status: cb.isPrimaryActive() ? 'ok' : 'degraded',
      circuitState: cb.getState(),
      isPrimary: cb.isPrimaryActive(),
      slot,
    };
  } catch {
    return {
      status: 'error',
      circuitState: cb.getState(),
      isPrimary: cb.isPrimaryActive(),
    };
  }
}

/**
 * Check replica database health (Phase 4.2).
 * Errors here are non-fatal — primary DB may still be healthy.
 */
async function checkReplicaDb(): Promise<{ status: 'ok' | 'error' | 'unconfigured'; latencyMs: number }> {
  if (!config.db.replicaUrl) {
    return { status: 'unconfigured', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    await prismaRead.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

// ─── App factory ───────────────────────────────────────────────────────────────

export function createApiServer(circuitBreaker?: RpcCircuitBreaker): express.Application {
  const app = express();

  // ── Security middleware ──────────────────────────────────────────────────────
  app.use(helmet());
  // Restrict in production to your frontend domain
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '64kb' }));

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,            // 2 requests per second per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests — slow down, degen' },
  });
  app.use('/api/', limiter);

  // ── Prometheus metrics middleware ────────────────────────────────────────────
  app.use((req, res, next) => {
    const end = apiRequestDuration.startTimer({
      method: req.method,
      route: req.path,
    });
    res.on('finish', () => {
      end({ status_code: res.statusCode.toString() });
    });
    next();
  });

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.use('/api/rooms', validationRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/reserves', reservesRouter);

  // ── Enhanced health check ────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const [db, rds, rpcResult, replicaDb] = await Promise.all([
      checkDb(),
      checkRedis(),
      checkRpc(circuitBreaker ?? null),
      checkReplicaDb(),
    ]);

    const allOk = db.status === 'ok' && rds.status === 'ok' && rpcResult.status === 'ok';

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      ts: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: db,
        databaseReplica: replicaDb,
        redis: rds,
        solanaRpc: rpcResult,
      },
    });
  });

  // ── Prometheus metrics endpoint ───────────────────────────────────────────────
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // ── 404 handler ──────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // ── Sentry error handler (Phase 4.3) ─────────────────────────────────────────
  app.use(sentryErrorHandler);

  // ── Fallback error handler ───────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    captureError(err, { route: 'unknown', handler: 'final' });
    logger.error({ msg: 'Unhandled API error', err: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}

export function startApiServer(app: express.Application): void {
  app.listen(config.api.restPort, () => {
    logger.info({ msg: 'REST API server listening', port: config.api.restPort });
  });
}
