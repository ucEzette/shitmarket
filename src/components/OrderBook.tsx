'use client';

import React, { useEffect, useState } from 'react';
import { INDEXER_URL } from '@/utils/config';

interface Order {
  id: string;
  maker: string;
  roomPubkey: string;
  outcomeIndex: number;
  price: number;
  amount: string;
  filledAmount: string;
  side: 'buy' | 'sell';
}

interface OrderBookProps {
  roomId: string;
  outcomeIndex: number; // The side we are looking at (0 = MOON, 1 = JEET)
}

export function OrderBook({ roomId, outcomeIndex }: OrderBookProps) {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await fetch(`${INDEXER_URL}/api/orders/book/${roomId}`);
        const data = await res.json();
        if (data.success) {
          // Filter out orders for this specific outcome
          const outcomeBids = data.book.bids.filter((o: Order) => o.outcomeIndex === outcomeIndex);
          const outcomeAsks = data.book.asks.filter((o: Order) => o.outcomeIndex === outcomeIndex);
          
          setBids(outcomeBids.sort((a: Order, b: Order) => b.price - a.price));
          setAsks(outcomeAsks.sort((a: Order, b: Order) => a.price - b.price));
        }
      } catch (e) {
        console.error("Failed to fetch order book", e);
      }
    };
    
    fetchBook();
    const intv = setInterval(fetchBook, 5000);
    return () => clearInterval(intv);
  }, [roomId, outcomeIndex]);

  return (
    <div className="bg-trench-black border-2 border-trench-sandbag p-4 rounded-xl shadow-2xl relative overflow-hidden font-mono">
      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
      
      <div className="flex items-center justify-between border-b border-trench-sandbag pb-2 mb-3">
        <div className="flex items-center gap-2 text-neon-moon font-staatliches text-lg font-bold uppercase tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-neon-moon animate-pulse shrink-0 shadow-glow-moon" />
          <span>ORDER BOOK</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[10px]">
        {/* Bids (Buy Orders) */}
        <div>
          <div className="text-center text-green-500 font-bold mb-2 border-b border-green-500/30 pb-1">BIDS (BUY)</div>
          <div className="flex justify-between text-gray-500 mb-1 px-1">
            <span>SIZE</span>
            <span>PRICE</span>
          </div>
          {bids.length === 0 && <div className="text-center text-gray-600 mt-4 italic">No bids</div>}
          {bids.map(bid => {
            const size = (Number(bid.amount) - Number(bid.filledAmount));
            const formattedPrice = (bid.price / 1000000).toFixed(4);
            return (
              <div key={bid.id} className="flex justify-between hover:bg-green-500/10 px-1 py-0.5 rounded transition-colors cursor-pointer text-green-400">
                <span>{size}</span>
                <span>${formattedPrice}</span>
              </div>
            );
          })}
        </div>

        {/* Asks (Sell Orders) */}
        <div>
          <div className="text-center text-red-500 font-bold mb-2 border-b border-red-500/30 pb-1">ASKS (SELL)</div>
          <div className="flex justify-between text-gray-500 mb-1 px-1">
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {asks.length === 0 && <div className="text-center text-gray-600 mt-4 italic">No asks</div>}
          {asks.map(ask => {
            const size = (Number(ask.amount) - Number(ask.filledAmount));
            const formattedPrice = (ask.price / 1000000).toFixed(4);
            return (
              <div key={ask.id} className="flex justify-between hover:bg-red-500/10 px-1 py-0.5 rounded transition-colors cursor-pointer text-red-400">
                <span>${formattedPrice}</span>
                <span>{size}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
