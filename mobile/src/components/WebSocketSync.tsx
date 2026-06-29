import React, { useEffect, useRef } from 'react';
import { useAppState, mapApiRoom } from '../store/useAppState';
import { WS_URL } from '../utils/config';

export const WebSocketSync: React.FC = () => {
  const { rooms, addRoom, updateRoomPools, addMessage, settleRoom, markBetClaimed, addUserBet, fetchRooms, fetchLeaderboard, user } = useAppState();
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRooms = useRef<Set<string>>(new Set());

  // Trigger initial indexer fetch
  useEffect(() => {
    fetchRooms().catch(console.error);
    fetchLeaderboard().catch(console.error);
  }, []);

  useEffect(() => {
    let reconnectTimeout: any;

    const connect = () => {
      const wsUrl = WS_URL;
      console.log(`Connecting WebSocket to command center: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket link established with ShitMarket Indexer.');
        socket.send(JSON.stringify({ type: 'subscribe_global' }));

        // Heartbeat pings every 20s
        const pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
        (socket as any).pingInterval = pingInterval;

        // Resubscribe to all existing active rooms
        subscribedRooms.current.clear();
        rooms.forEach((r) => {
          if (r.status === 'active') {
            socket.send(JSON.stringify({ type: 'subscribe', room: r.id }));
            subscribedRooms.current.add(r.id);
          }
        });
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'new_room' || msg.type === 'RoomCreated') {
            console.log('WS Event [New Room Deployed]:', msg);
            const newRoom = mapApiRoom(msg);
            addRoom(newRoom);

            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'subscribe', room: newRoom.id }));
              subscribedRooms.current.add(newRoom.id);
            }

            addMessage({
              roomId: newRoom.id,
              side: 'all',
              user: 'COMMAND HQ',
              message: `🚨 NEW DEGEN ARENA DEPLOYED: $${newRoom.token.symbol} is ready for action! 🚨`,
              timestamp: Date.now(),
            });
          }

          else if (
            msg.type === 'room_update' ||
            msg.type === 'BetPlaced' ||
            msg.type === 'RoomActivated' ||
            msg.type === 'RoomSettled' ||
            msg.type === 'WinningsClaimed' ||
            msg.type === 'NewChatMessage'
          ) {
            const roomPubkey = msg.roomPubkey || msg.room;
            const eventType = msg.type === 'room_update' ? msg.data?.type : msg.type;
            const data = msg.type === 'room_update' ? msg.data : msg;

            if (!roomPubkey) return;

            if (eventType === 'BetPlaced') {
              const moonAmount = Number(data.moonPool) / 1e9;
              const jeetAmount = Number(data.jeetPool) / 1e9;
              updateRoomPools(roomPubkey, moonAmount, jeetAmount);

              const formattedUser = `${data.user.slice(0, 6)}...${data.user.slice(-4)}`;
              const betSol = Number(data.amount) / 1e9;

              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: 'COMMAND HQ',
                message: `💥 BATTLE UPDATE: ${formattedUser} stacked ${betSol.toFixed(2)} SOL on ${data.side.toUpperCase()}! 💥`,
                timestamp: Date.now(),
              });

              if (user && user.wallet === data.user) {
                useAppState.getState().fetchBalance();
                addUserBet({
                  id: Math.random().toString(),
                  roomId: roomPubkey,
                  user: data.user,
                  side: data.side,
                  amount: betSol,
                  claimed: false,
                  timestamp: Date.now(),
                });
              }
            }

            else if (eventType === 'NewChatMessage') {
              addMessage({
                roomId: roomPubkey,
                side: data.side,
                user: data.user,
                message: data.message,
                timestamp: data.timestamp,
              });
            }

            else if (eventType === 'RoomSettled') {
              settleRoom(roomPubkey, data.winner);
              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: 'KEEPER SYSTEM',
                message: `⚡ ARENA SETTLED! WINNER: ${data.winner.toUpperCase()} at TWAP ${Number(data.twapFinalPrice) / 1e12} USD ⚡`,
                timestamp: Date.now(),
              });
            }

            else if (eventType === 'WinningsClaimed') {
              markBetClaimed(roomPubkey, data.user);
              const formattedUser = `${data.user.slice(0, 6)}...${data.user.slice(-4)}`;
              addMessage({
                roomId: roomPubkey,
                side: 'all',
                user: 'COMMAND HQ',
                message: `💸 CLAIM ALERT: ${formattedUser} claimed their winning share from the vaults!`,
                timestamp: Date.now(),
              });
            }
          }
        } catch (e) {
          console.warn("WebSocket parsing failed:", e);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket link offline. Scheduling reconnection...');
        const pingInterval = (socket as any).pingInterval;
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (e) => {
        console.warn('WebSocket socket error:', e);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Sync subscriptions for new rooms that are active
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      rooms.forEach((r) => {
        if (r.status === 'active' && !subscribedRooms.current.has(r.id)) {
          socket.send(JSON.stringify({ type: 'subscribe', room: r.id }));
          subscribedRooms.current.add(r.id);
        }
      });
    }
  }, [rooms]);

  return null;
};
