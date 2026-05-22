/**
 * rpcCircuitBreaker.ts
 *
 * Production-grade RPC circuit breaker with automatic failover.
 *
 * Architecture:
 * ┌────────────┐     ┌──────────────────┐     ┌─────────────────┐
 * │  Caller    │────▶│  RpcCircuitBreaker│────▶│  Primary RPC    │
 * │ (keeper,   │     │  (state machine) │     │ (e.g. Helius)   │
 * │  listener) │     │                  │     └─────────────────┘
 * │            │     │  On 3 cons. errs │────▶│  Secondary RPC   │
 * │            │     │  → open circuit  │     │ (e.g. Triton)    │
 * └────────────┘     └──────────────────┘     └─────────────────┘
 *
 * State machine: CLOSED → OPEN (after threshold) → HALF_OPEN → CLOSED or OPEN
 */

import { Connection, Commitment } from '@solana/web3.js';
import { logger } from '../logger';
import { config } from '../config';

// ─── Types ──────────────────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Number of consecutive errors before tripping to OPEN */
  errorThreshold: number;

  /** Milliseconds to wait before trying HALF_OPEN probe */
  resetTimeoutMs: number;

  /** Health check slot interval (ms) — polls getSlot on the active connection */
  healthCheckIntervalMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  errorThreshold: 5,
  resetTimeoutMs: 30_000,       // 30 seconds
  healthCheckIntervalMs: 10_000, // 10 seconds
};

// ─── RPC Circuit Breaker ───────────────────────────────────────────────────────

export class RpcCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private primaryConnection: Connection;
  private secondaryConnection: Connection | null = null;

  private consecutiveErrors = 0;
  private lastErrorTimestamp = 0;
  private lastHealthCheckOk = true;

  /** The currently active connection (primary or secondary) */
  private activeConnection: Connection;

  private options: CircuitBreakerOptions;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    primaryUrl: string,
    secondaryUrl: string | undefined,
    commitment: Commitment = 'confirmed',
    options?: Partial<CircuitBreakerOptions>
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.primaryConnection = new Connection(primaryUrl, {
      commitment,
      wsEndpoint: config.solana.wsUrl,
      confirmTransactionInitialTimeout: 60_000,
    });

    if (secondaryUrl && secondaryUrl !== primaryUrl) {
      this.secondaryConnection = new Connection(secondaryUrl, {
        commitment,
        wsEndpoint: config.solana.wsUrl,
        confirmTransactionInitialTimeout: 60_000,
      });
    }

    this.activeConnection = this.primaryConnection;

    logger.info({
      msg: 'RPC Circuit Breaker initialized',
      primary: primaryUrl,
      secondary: secondaryUrl ?? '(none)',
      state: this.state,
    });

    // Start periodic health checks
    this.startHealthChecks();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Returns the current active connection. Use this wherever you call RPC methods. */
  getConnection(): Connection {
    return this.activeConnection;
  }

  /** Returns the current circuit state (for metrics / health endpoint) */
  getState(): CircuitState {
    return this.state;
  }

  /** Returns whether the circuit is healthy and using primary */
  isPrimaryActive(): boolean {
    return this.activeConnection === this.primaryConnection;
  }

  /** Report a successful RPC call. Resets error count. */
  reportSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Probe succeeded — close the circuit
      this.transitionTo('CLOSED');
      this.switchToPrimary();
    }
    this.consecutiveErrors = 0;
    this.lastHealthCheckOk = true;
  }

  /** Report a failed RPC call. May trigger circuit open. */
  reportFailure(error?: string): void {
    this.consecutiveErrors++;
    this.lastErrorTimestamp = Date.now();
    this.lastHealthCheckOk = false;

    logger.warn({
      msg: 'RPC call failed',
      consecutiveErrors: this.consecutiveErrors,
      threshold: this.options.errorThreshold,
      state: this.state,
      error,
    });

    if (
      this.state === 'CLOSED' &&
      this.consecutiveErrors >= this.options.errorThreshold
    ) {
      this.transitionTo('OPEN');
      this.switchToSecondary();
    }
  }

  /** Graceful shutdown — clean up timers */
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    logger.info('RPC Circuit Breaker shut down');
  }

  // ── Internal state machine ────────────────────────────────────────────────

  private transitionTo(newState: CircuitState): void {
    const prev = this.state;
    this.state = newState;
    logger.warn({
      msg: 'RPC circuit state transition',
      from: prev,
      to: newState,
      consecutiveErrors: this.consecutiveErrors,
    });
  }

  private switchToPrimary(): void {
    if (this.activeConnection !== this.primaryConnection) {
      this.activeConnection = this.primaryConnection;
      this.consecutiveErrors = 0;
      logger.info({ msg: 'Switched RPC to PRIMARY', url: config.solana.rpcUrl });
    }
  }

  private switchToSecondary(): void {
    if (this.secondaryConnection && this.activeConnection !== this.secondaryConnection) {
      this.activeConnection = this.secondaryConnection;
      logger.info({ msg: 'Switched RPC to SECONDARY (circuit open)' });

      // Schedule reset attempt after timeout
      setTimeout(() => {
        if (this.state === 'OPEN') {
          this.transitionTo('HALF_OPEN');
          // The next getSlot health check will probe the primary
        }
      }, this.options.resetTimeoutMs);
    }
  }

  // ── Health checks ───────────────────────────────────────────────────────────

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const slot = await this.primaryConnection.getSlot();
        logger.debug({ msg: 'Primary RPC health check OK', slot });
        this.lastHealthCheckOk = true;

        // If we're in HALF_OPEN and primary responds, close the circuit
        if (this.state === 'HALF_OPEN') {
          this.transitionTo('CLOSED');
          this.switchToPrimary();
        }
      } catch (err: any) {
        logger.warn({
          msg: 'Primary RPC health check FAILED',
          error: err?.message,
          state: this.state,
        });

        if (this.state === 'CLOSED') {
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= this.options.errorThreshold) {
            this.transitionTo('OPEN');
            this.switchToSecondary();
          }
        }
      }

      // Also check secondary if available and we're using it
      if (this.activeConnection === this.secondaryConnection && this.secondaryConnection) {
        try {
          await this.secondaryConnection.getSlot();
        } catch (err: any) {
          logger.error({
            msg: 'Secondary RPC health check FAILED',
            error: err?.message,
          });
          // If both are down, stay on secondary and keep retrying
        }
      }
    }, this.options.healthCheckIntervalMs);
  }
}
