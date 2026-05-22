import { register, Counter, Histogram, Gauge } from 'prom-client';

// Enable default Node.js metrics (CPU, memory, event loop lag, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register });

// ─── Business Metrics ─────────────────────────────────────────────────────────

export const roomsCreatedTotal = new Counter({
  name: 'shitmarket_rooms_created_total',
  help: 'Total number of rooms created',
  registers: [register],
});

export const roomsSettledTotal = new Counter({
  name: 'shitmarket_rooms_settled_total',
  help: 'Total number of rooms settled',
  labelNames: ['winner'] as const,
  registers: [register],
});

export const betsPlacedTotal = new Counter({
  name: 'shitmarket_bets_placed_total',
  help: 'Total bets placed',
  labelNames: ['side'] as const,
  registers: [register],
});

export const betsVolumeTotal = new Counter({
  name: 'shitmarket_bets_volume_lamports_total',
  help: 'Total bet volume in lamports',
  registers: [register],
});

export const keeperSuccessTotal = new Counter({
  name: 'shitmarket_keeper_settlement_success_total',
  help: 'Successful keeper settlements',
  registers: [register],
});

export const keeperFailureTotal = new Counter({
  name: 'shitmarket_keeper_settlement_failure_total',
  help: 'Failed keeper settlement attempts',
  registers: [register],
});

export const activeRoomsGauge = new Gauge({
  name: 'shitmarket_active_rooms',
  help: 'Number of currently active rooms',
  registers: [register],
});

export const wsClientsGauge = new Gauge({
  name: 'shitmarket_ws_connected_clients',
  help: 'Number of WebSocket clients connected',
  registers: [register],
});

export const apiRequestDuration = new Histogram({
  name: 'shitmarket_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const eventProcessingDuration = new Histogram({
  name: 'shitmarket_event_processing_duration_seconds',
  help: 'Time to process a Solana event',
  labelNames: ['event_type'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export { register };
