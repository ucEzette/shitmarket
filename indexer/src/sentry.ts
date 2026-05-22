// ── Minimal Sentry Integration (Phase 4.3) ─────────────────────
// Wraps errors and sends to Sentry via the DSN.
// In production, replace with @sentry/node for full instrumentation.

import { logger } from './logger';

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENABLED = !!SENTRY_DSN && SENTRY_DSN.startsWith('https://');
const RELEASE = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

interface SentryEvent {
  message?: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: string;
  };
  level: 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id?: string; wallet?: string };
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

// ── Capture an error to Sentry ─────────────────────────────────
export function captureError(error: Error, extra?: Record<string, unknown>): void {
  if (!SENTRY_ENABLED) {
    logger.warn({ msg: 'Sentry not configured, skipping error capture', error: error.message });
    return;
  }

  const event: SentryEvent = {
    exception: {
      type: error.name || 'Error',
      value: error.message,
      stacktrace: error.stack,
    },
    level: 'error',
    tags: {
      release: RELEASE,
      environment: ENVIRONMENT,
    },
    extra,
  };

  sendToSentry(event);
}

// ── Capture a message (non-error) ──────────────────────────────
export function captureMessage(msg: string, level: SentryEvent['level'] = 'info', extra?: Record<string, unknown>): void {
  if (!SENTRY_ENABLED) return;

  const event: SentryEvent = {
    message: msg,
    level,
    tags: {
      release: RELEASE,
      environment: ENVIRONMENT,
    },
    extra,
  };

  sendToSentry(event);
}

// ── Send event to Sentry's Envelope API ────────────────────────
async function sendToSentry(event: SentryEvent): Promise<void> {
  try {
    // Parse Sentry DSN: https://key@host/org
    // We send via the /api/ endpoint using the Envelope format
    const dsnMatch = SENTRY_DSN.match(/^https:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/);
    if (!dsnMatch) {
      logger.warn({ msg: 'Invalid Sentry DSN format' });
      return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const url = `https://${host}/api/${projectId}/envelope/`;

    // Build the Sentry Envelope
    const headers = JSON.stringify({
      event_id: generateUUID(),
      sent_at: new Date().toISOString(),
      sdk: { name: 'shitmarket-sentry', version: '1.0.0' },
      dsn: SENTRY_DSN,
    });

    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
      platform: 'node',
      sdk: { name: 'shitmarket-sentry', version: '1.0.0' },
    });

    const envelope = `${headers}\n${JSON.stringify({ type: 'event', payload })}`;

    // Auth header
    const authHeader = `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=shitmarket-sentry/1.0.0`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': authHeader,
      },
      body: envelope,
    });

    logger.debug({ msg: 'Sentry event sent', eventType: event.exception?.type || event.message });
  } catch (err: any) {
    // Don't let Sentry errors crash the app
    logger.warn({ msg: 'Failed to send event to Sentry', error: err?.message });
  }
}

// ── Generate UUID v4 ───────────────────────────────────────────
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Express error handler middleware ────────────────────────────
import { Request, Response, NextFunction } from 'express';

export function sentryErrorHandler(err: Error, req: Request, _res: Response, next: NextFunction): void {
  captureError(err, {
    url: req.originalUrl,
    method: req.method,
    query: req.query,
    // Don't log body — may contain sensitive data
  });
  next(err);
}

// ── Wrap an async route handler with error tracking ────────────
export function withErrorTracking(handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (err: any) {
      captureError(err, {
        route: req.originalUrl,
        method: req.method,
      });
      next(err);
    }
  };
}
