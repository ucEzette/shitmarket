/**
 * validation.ts
 *
 * Zod schemas + middleware for all API request validation.
 * Prevents malformed / injection-style requests from reaching the DB.
 */

import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

// ─── Validation middleware factory ──────────────────────────────────────────────

type RequestPart = 'query' | 'params' | 'body';

/**
 * Express middleware that validates the specified request part against a Zod schema.
 * On success, replaces the raw values with the parsed (and defaulted) values.
 * On failure, returns a 400 with structured error info.
 */
export function validate(schema: ZodSchema, source: RequestPart = 'query') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));

      logger.warn({
        msg: `Validation failed on request ${source}`,
        path: req.path,
        issues,
      });

      res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: issues,
      });
      return;
    }

    // Replace raw values with parsed (typed + defaults applied)
    (req as any)[source] = result.data;
    next();
  };
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

export const roomsQuerySchema = z.object({
  filter: z.enum(['ending', 'biggest', 'newest']).optional().default('ending'),
  status: z.enum(['active', 'settled', 'all']).optional().default('active'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const roomPubkeyParamSchema = z.object({
  pubkey: z
    .string()
    .min(32, 'Pubkey too short')
    .max(48, 'Pubkey too long')
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 pubkey'),
});

export const walletParamSchema = z.object({
  wallet: z
    .string()
    .min(32, 'Wallet address too short')
    .max(48, 'Wallet address too long')
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 wallet address'),
});

export const leaderboardQuerySchema = z.object({
  sortBy: z.enum(['profit', 'wins', 'winRate']).optional().default('profit'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ─── WebSocket incoming message ──────────────────────────────────────────────

export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), room: z.string().min(32).max(48) }),
  z.object({ type: z.literal('unsubscribe'), room: z.string().min(32).max(48) }),
  z.object({ type: z.literal('subscribe_global') }),
  z.object({ type: z.literal('ping') }),
]);
