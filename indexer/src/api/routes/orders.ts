import express from 'express';
import { prisma } from '../../db';

export const ordersRouter = express.Router();

// ─── Submit a Limit Order ──────────────────────────────────────────────────
ordersRouter.post('/', async (req, res) => {
  try {
    const {
      maker,
      roomPubkey,
      outcomeIndex,
      price,
      amount,
      side,
      nonce,
      expiration,
      signature
    } = req.body;

    if (!maker || !roomPubkey || outcomeIndex === undefined || !price || !amount || !side || !nonce || !expiration || !signature) {
      return res.status(400).json({ success: false, error: 'Missing required order fields' });
    }

    // Convert amount, nonce, expiration to BigInt
    const order = await prisma.limitOrder.create({
      data: {
        maker,
        roomPubkey,
        outcomeIndex,
        price: Number(price),
        amount: BigInt(amount),
        side,
        nonce: BigInt(nonce),
        expiration: BigInt(expiration),
        signature,
        status: 'open'
      }
    });

    return res.json({
      success: true,
      order: {
        ...order,
        amount: order.amount.toString(),
        filledAmount: order.filledAmount.toString(),
        nonce: order.nonce.toString(),
        expiration: order.expiration.toString(),
      }
    });
  } catch (err: any) {
    console.error('Error creating limit order:', err);
    res.status(500).json({ success: false, error: 'Failed to create limit order' });
  }
});

// ─── Get Order Book for Room ────────────────────────────────────────────────
ordersRouter.get('/book/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const orders = await prisma.limitOrder.findMany({
      where: {
        roomPubkey: roomId,
        status: 'open'
      },
      orderBy: [
        { price: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    const formatted = orders.map(o => ({
      ...o,
      amount: o.amount.toString(),
      filledAmount: o.filledAmount.toString(),
      nonce: o.nonce.toString(),
      expiration: o.expiration.toString(),
    }));

    // Group by outcomeIndex and side to build the book
    const book = {
      bids: formatted.filter(o => o.side === 'buy'),
      asks: formatted.filter(o => o.side === 'sell')
    };

    return res.json({ success: true, book });
  } catch (err: any) {
    console.error('Error fetching order book:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch order book' });
  }
});

// ─── Cancel Order ───────────────────────────────────────────────────────────
ordersRouter.delete('/:nonce', async (req, res) => {
  try {
    const { nonce } = req.params;
    // In a real app we would verify the signature of the cancellation request
    // or just let the smart contract handle cancellation.
    // For this migration, we'll mark it cancelled in the DB.

    await prisma.limitOrder.updateMany({
      where: {
        nonce: BigInt(nonce),
        status: 'open'
      },
      data: {
        status: 'cancelled'
      }
    });

    return res.json({ success: true, message: 'Order cancelled' });
  } catch (err: any) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});
