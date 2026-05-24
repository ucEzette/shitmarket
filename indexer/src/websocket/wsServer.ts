/**
 * wsServer.ts
 *
 * Standalone WebSocket server using the `ws` library.
 * Clients subscribe to individual rooms or the global feed.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: 'subscribe',   room: '<pubkey>' }
 *     { type: 'unsubscribe', room: '<pubkey>' }
 *     { type: 'subscribe_global' }      ← new room creations
 *     { type: 'ping' }
 *
 *   Server → Client:
 *     { type: 'pong' }
 *     { type: 'subscribed',   room: '<pubkey>' }
 *     { type: 'room_update',  roomPubkey, ...data }
 *     { type: 'new_room',     roomPubkey, ...data }
 *     { type: 'error',        message: string }
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { redisSub } from '../redis';
import { logger } from '../logger';
import { config } from '../config';
import { wsClientsGauge } from '../metrics/prometheus';

// ─── Room subscriptions ───────────────────────────────────────────────────────

// Map from roomPubkey → set of subscribed WebSocket clients
const roomSubscriptions = new Map<string, Set<WebSocket>>();
// Set of clients subscribed to the global new-room feed
const globalSubscriptions = new Set<WebSocket>();

function subscribeToRoom(ws: WebSocket, roomPubkey: string): void {
  if (!roomSubscriptions.has(roomPubkey)) {
    roomSubscriptions.set(roomPubkey, new Set());
  }
  roomSubscriptions.get(roomPubkey)!.add(ws);
  safeSend(ws, { type: 'subscribed', room: roomPubkey });
  logger.debug({ msg: 'WS subscribed', roomPubkey });
}

function unsubscribeFromRoom(ws: WebSocket, roomPubkey: string): void {
  roomSubscriptions.get(roomPubkey)?.delete(ws);
}

function unsubscribeAll(ws: WebSocket): void {
  for (const [, clients] of roomSubscriptions) {
    clients.delete(ws);
  }
  globalSubscriptions.delete(ws);
}

function safeSend(ws: WebSocket, data: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // Client disconnected mid-send; ignore
    }
  }
}

function broadcastToRoom(roomPubkey: string, data: object): void {
  const clients = roomSubscriptions.get(roomPubkey);
  if (!clients) return;
  for (const ws of clients) {
    safeSend(ws, { type: 'room_update', roomPubkey, ...data });
  }
}

function broadcastGlobal(data: object): void {
  for (const ws of globalSubscriptions) {
    safeSend(ws, { type: 'new_room', ...data });
  }
}

// ─── Redis Pub/Sub relay ──────────────────────────────────────────────────────

async function startRedisRelay(): Promise<void> {
  await redisSub.subscribe('room_updates', (err) => {
    if (err) {
      logger.error({ msg: 'Redis subscribe error', err });
    } else {
      logger.info('WS server subscribed to Redis room_updates channel');
    }
  });

  redisSub.on('message', (_channel: string, message: string) => {
    try {
      const payload = JSON.parse(message) as { roomPubkey: string; type: string; [k: string]: any };
      const { roomPubkey, ...rest } = payload;

      if (rest.type === 'RoomCreated') {
        broadcastGlobal({ roomPubkey, ...rest });
      }
      broadcastToRoom(roomPubkey, rest);
    } catch (err: any) {
      logger.warn({ msg: 'Failed to relay Redis message', err: err?.message });
    }
  });
}

// ─── WebSocket server ─────────────────────────────────────────────────────────

export function startWsServer(existingServer?: http.Server): WebSocketServer {
  const server = existingServer || http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    logger.info({ msg: 'WS client connected', ip });
    wsClientsGauge.set(wss.clients.size);

    // Heartbeat — clients must respond to prevent zombie connections
    let isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30_000);

    ws.on('pong', () => { isAlive = true; });

    ws.on('message', (raw) => {
      let msg: { type: string; room?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      switch (msg.type) {
        case 'subscribe':
          if (!msg.room) {
            safeSend(ws, { type: 'error', message: 'Missing room pubkey' });
          } else {
            subscribeToRoom(ws, msg.room);
          }
          break;
        case 'unsubscribe':
          if (msg.room) unsubscribeFromRoom(ws, msg.room);
          break;
        case 'subscribe_global':
          globalSubscriptions.add(ws);
          safeSend(ws, { type: 'subscribed', room: 'global' });
          break;
        case 'ping':
          safeSend(ws, { type: 'pong' });
          break;
        default:
          safeSend(ws, { type: 'error', message: `Unknown type: ${msg.type}` });
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribeAll(ws);
      wsClientsGauge.set(wss.clients.size);
      logger.debug({ msg: 'WS client disconnected', ip });
    });

    ws.on('error', (err) => {
      logger.warn({ msg: 'WS client error', ip, err: err.message });
    });
  });

  if (!existingServer) {
    server.listen(config.api.wsPort, () => {
      logger.info({ msg: 'WebSocket server listening', port: config.api.wsPort });
    });
  }

  // Start relaying Redis events to WebSocket clients
  startRedisRelay().catch((err) =>
    logger.error({ msg: 'Redis relay startup failed', err })
  );

  return wss;
}
