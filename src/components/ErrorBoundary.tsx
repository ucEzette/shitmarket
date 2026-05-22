'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { PixelBarbedWire } from './PixelArt';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ── Frontend Error Boundary (Phase 4.3) ────────────────────────
// Catches React render errors and displays a military-themed crash screen.
// Prevents the entire app from white-screening on component failures.

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in dev
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);

    // Attempt to send to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry?.captureException) {
      (window as any).Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          url: window.location.href,
        },
      });
    }

    // Call optional onError prop
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default military crash screen
      return (
        <div className="min-h-screen bg-trench-black flex items-center justify-center p-4 select-none">
          <div className="max-w-lg w-full bg-trench-mud border-4 border-jeet-red rounded-lg p-8 text-center shadow-[0_0_40px_rgba(255,7,58,0.3)] scanlines">
            
            {/* Skull indicator */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={96} glowColor="jeet" animated className="rounded-full" />
                <div className="absolute -top-2 -right-2 bg-jeet-red text-white font-staatliches text-xs px-2 py-0.5 rounded animate-pulse font-bold">
                  FATAL
                </div>
              </div>
            </div>

            <h2 className="font-staatliches text-3xl text-jeet-red tracking-wider uppercase mb-2 glow-jeet">
              ❌ COMBAT SYSTEMS OFFLINE
            </h2>
            
            <p className="font-mono text-xs text-trench-gasmask uppercase leading-relaxed mb-6 font-bold">
              A critical front-line error has compromised your deployment. 
              The trench network has detected an unhandled exception in the sector.
            </p>

            {/* Error details */}
            <div className="bg-trench-black border border-trench-sandbag rounded p-4 mb-6 text-left font-mono text-[10px]">
              <span className="text-jeet-red block font-bold uppercase tracking-wider mb-2">
                ▸ ERROR LOG
              </span>
              <code className="text-trench-gasmask block break-all leading-relaxed">
                {this.state.error?.name}: {this.state.error?.message}
              </code>
              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className="mt-2">
                  <summary className="text-trench-gasmask cursor-pointer hover:text-white uppercase text-[9px] font-bold tracking-wider">
                    ▸ STACK TRACE (DEV ONLY)
                  </summary>
                  <pre className="mt-2 text-[8px] text-trench-gasmask/70 whitespace-pre-wrap leading-tight max-h-32 overflow-y-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-wood py-3 px-6 rounded font-staatliches text-lg uppercase tracking-wider flex items-center justify-center gap-2"
              >
                ⟳ RETRY DEPLOYMENT
              </button>
              <button
                onClick={this.handleReload}
                className="bg-jeet-red hover:bg-red-700 text-white py-3 px-6 rounded font-staatliches text-lg uppercase tracking-wider border-b-4 border-red-950 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                ⟲ FULL SYSTEM REBOOT
              </button>
            </div>

            <div className="mt-6">
              <PixelBarbedWire height={12} />
            </div>

            <p className="font-mono text-[8px] text-trench-gasmask/50 mt-4 uppercase font-bold">
              If this persists, report to HQ: #operations on Discord
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── API Error Retry Utility ────────────────────────────────────
// Wraps fetch calls with exponential backoff and retry logic.

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOpts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 10000, onRetry } = retryOpts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? (attempt < maxRetries ? undefined : undefined),
      });

      if (!response.ok) {
        // Don't retry 4xx errors (client errors) — they won't succeed on retry
        if (response.status >= 400 && response.status < 500) {
          const body = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        // 5xx errors are retryable
        throw new Error(`HTTP ${response.status}: Server error`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      lastError = err;

      // Don't retry if the request was aborted
      if (err.name === 'AbortError') {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * (0.5 + Math.random() * 0.5);

        onRetry?.(attempt, err);

        await new Promise((resolve) => setTimeout(resolve, jitter));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

// ── Degraded Mode Hook ─────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react';

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface UseDegradedModeOptions {
  checkInterval?: number; // ms between health checks
  initialStatus?: ServiceStatus;
}

export function useDegradedMode(
  healthEndpoint: string,
  options: UseDegradedModeOptions = {}
): {
  status: ServiceStatus;
  isHealthy: boolean;
  isDegraded: boolean;
  isDown: boolean;
  forceDegraded: boolean;
  setForceDegraded: (val: boolean) => void;
  checkHealth: () => Promise<void>;
} {
  const { checkInterval = 30000, initialStatus = 'healthy' } = options;
  const [status, setStatus] = useState<ServiceStatus>(initialStatus);
  const [forceDegraded, setForceDegraded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(healthEndpoint, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        setStatus('healthy');
      } else {
        setStatus('degraded');
      }
    } catch {
      setStatus('down');
    }
  }, [healthEndpoint]);

  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(checkHealth, checkInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth, checkInterval]);

  const effectiveStatus: ServiceStatus = forceDegraded ? 'degraded' : status;

  return {
    status: effectiveStatus,
    isHealthy: effectiveStatus === 'healthy',
    isDegraded: effectiveStatus === 'degraded',
    isDown: effectiveStatus === 'down',
    forceDegraded,
    setForceDegraded,
    checkHealth,
  };
}
