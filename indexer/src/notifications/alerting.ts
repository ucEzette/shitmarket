/**
 * alerting.ts
 *
 * Slack / webhook alerting for critical ShitMarket events:
 *  - Keeper settlement failures exceeding threshold
 *  - RPC circuit breaker trips to secondary
 *  - Event listener downtimes / reconnects
 *  - High error rates
 *
 * Integrates with the Prometheus alertmanager for production,
 * but also supports direct Slack webhook POST for instant alerts.
 */

import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';

// ─── Config ────────────────────────────────────────────────────────────────────

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? '';
const ALERT_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes between same-type alerts

// Track last sent time per alert type to avoid spam
const lastSentMap = new Map<string, number>();

// ─── Alert payload ─────────────────────────────────────────────────────────────

interface AlertPayload {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Send alert ────────────────────────────────────────────────────────────────

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const now = Date.now();

  // Throttle: skip if same type was sent within the throttle window
  const lastSent = lastSentMap.get(payload.type) ?? 0;
  if (now - lastSent < ALERT_THROTTLE_MS) {
    logger.debug({ msg: 'Alert throttled', type: payload.type });
    return;
  }
  lastSentMap.set(payload.type, now);

  logger.warn({ msg: `ALERT: ${payload.title}`, severity: payload.severity, ...payload.details });

  if (!SLACK_WEBHOOK_URL) return;

  try {
    const color = payload.severity === 'critical' ? '#ff0000'
      : payload.severity === 'warning' ? '#ffaa00'
      : '#36a64f';

    await axios.post(SLACK_WEBHOOK_URL, {
      attachments: [{
        color,
        title: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        text: payload.message,
        fields: payload.details
          ? Object.entries(payload.details).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            }))
          : [],
        ts: Math.floor(now / 1000),
      }],
    }, { timeout: 5000 });
  } catch (err: any) {
    logger.error({ msg: 'Failed to send Slack alert', err: err?.message });
  }
}

// ─── Pre-defined alert helpers ─────────────────────────────────────────────────

export function alertKeeperFailure(roomPubkey: string, error: string): void {
  sendAlert({
    type: 'keeper_failure',
    severity: 'warning',
    title: 'Keeper Settlement Failed',
    message: `Failed to settle room ${roomPubkey}`,
    details: { roomPubkey, error },
  });
}

export function alertCircuitBreakerTripped(primary: string, secondary: string, errorCount: number): void {
  sendAlert({
    type: 'circuit_breaker_tripped',
    severity: 'critical',
    title: 'RPC Circuit Breaker — FAILOVER TO SECONDARY',
    message: `Primary RPC (${primary}) has failed. Switched to secondary (${secondary}).`,
    details: { primary, secondary, consecutiveErrors: errorCount },
  });
}

export function alertCircuitBreakerRestored(): void {
  sendAlert({
    type: 'circuit_breaker_restored',
    severity: 'info',
    title: 'RPC Circuit Breaker — RESTORED',
    message: 'Primary RPC is healthy again. Circuit closed.',
  });
}

export function alertEventListenerDisconnected(durationMs: number): void {
  sendAlert({
    type: 'event_listener_disconnected',
    severity: 'critical',
    title: 'Event Listener Disconnected',
    message: `Solana logs subscription dropped. Reconnecting after ${Math.round(durationMs / 1000)}s downtime.`,
    details: { durationMs },
  });
}

export function alertHighErrorRate(endpoint: string, errorRate: number): void {
  sendAlert({
    type: 'high_error_rate',
    severity: 'warning',
    title: 'High API Error Rate',
    message: `Endpoint ${endpoint} has ${(errorRate * 100).toFixed(1)}% error rate.`,
    details: { endpoint, errorRate },
  });
}
