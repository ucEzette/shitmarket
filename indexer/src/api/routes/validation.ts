import { Router } from 'express';
import axios from 'axios';
import { PublicKey } from '@solana/web3.js';
import { config } from '../../config';
import { redis } from '../../redis';

export const validationRouter = Router();

validationRouter.get('/validate', async (req, res) => {
  try {
    const { mint } = req.query;
    if (!mint || typeof mint !== 'string') {
      return res.status(400).json({ valid: false, reason: 'Missing or invalid token mint' });
    }

    const dexscreenerUrl = `${config.external.dexscreenerUrl}/tokens/${mint}`;
    const { data } = await axios.get(dexscreenerUrl, { timeout: 5000 });
    
    if (!data || !data.pairs || data.pairs.length === 0) {
      return res.status(404).json({ valid: false, reason: 'Token not found on DexScreener or no pairs available' });
    }

    // Sort pairs by liquidity to find the main pair
    const pairs = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const mainPair = pairs[0];

    // Market cap can be read from fdv or marketCap field
    const marketCap = mainPair.marketCap || mainPair.fdv || 0;
    const pairCreatedAt = mainPair.pairCreatedAt || 0; // ms timestamp
    
    const minMarketCap = config.validation.minimumMarketCap;
    const minAgeMinutes = config.validation.minimumTokenAgeMinutes;

    if (marketCap < minMarketCap) {
      return res.status(200).json({ 
        valid: false, 
        reason: `Market cap is too low ($${marketCap.toLocaleString()}). Must be at least $${minMarketCap.toLocaleString()}.`
      });
    }

    const now = Date.now();
    const ageMinutes = (now - pairCreatedAt) / (1000 * 60);

    if (ageMinutes < minAgeMinutes) {
      return res.status(200).json({ 
        valid: false, 
        reason: `Token is too new (${Math.floor(ageMinutes)} mins old). Must be at least ${minAgeMinutes} mins old.`
      });
    }

    // Compute equivalent Solana Pubkey for EVM/non-base58 addresses
    let pubkeyStr = mint;
    try {
      new PublicKey(mint);
    } catch {
      let hex = mint.replace('0x', '');
      if (hex.length % 2 !== 0) hex = '0' + hex;
      const buffer = Buffer.alloc(32);
      Buffer.from(hex, 'hex').copy(buffer, 0);
      pubkeyStr = new PublicKey(buffer).toBase58();
    }

    // Save metadata so eventListener can construct the Room later
    await redis.set(`tokenmeta:${pubkeyStr}`, JSON.stringify({
      name: mainPair.baseToken?.name,
      symbol: mainPair.baseToken?.symbol,
      imageUrl: mainPair.info?.imageUrl || '',
      chainId: mainPair.chainId || 'solana',
      originalAddress: mint,
      priceUsd: mainPair.priceUsd ? mainPair.priceUsd : undefined,
    }), 'EX', 86400);

    return res.status(200).json({ 
      valid: true, 
      marketCap, 
      ageMinutes: Math.floor(ageMinutes), 
      pubkeyStr, 
      priceUsd: mainPair.priceUsd 
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    return res.status(500).json({ valid: false, reason: 'Internal validation error' });
  }
});

validationRouter.post('/cache-meta', async (req, res) => {
  try {
    const { mint, name, symbol, imageUrl, chainId, priceUsd } = req.body;
    if (!mint) return res.status(400).json({ success: false });

    let pubkeyStr = mint;
    try {
      new PublicKey(mint);
    } catch {
      let hex = mint.replace('0x', '');
      if (hex.length % 2 !== 0) hex = '0' + hex;
      const buffer = Buffer.alloc(32);
      Buffer.from(hex, 'hex').copy(buffer, 0);
      pubkeyStr = new PublicKey(buffer).toBase58();
    }

    await redis.set(`tokenmeta:${pubkeyStr}`, JSON.stringify({
      name,
      symbol,
      imageUrl: imageUrl || '',
      chainId: chainId || 'solana',
      originalAddress: mint,
      priceUsd
    }), 'EX', 86400);

    return res.json({ success: true, pubkeyStr });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});
