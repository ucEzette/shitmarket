const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { PublicKey } = require('@solana/web3.js');
const Redis = require('ioredis');
const redis = new Redis();

async function main() {
  const mint = '0x1001fF13bf368Aa4fa85F21043648079F00E1001';
  let hex = mint.replace('0x', '');
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const buffer = Buffer.alloc(32);
  Buffer.from(hex, 'hex').copy(buffer, 0);
  let pubkeyStr = new PublicKey(buffer).toBase58();
  
  const cached = await redis.get(`tokenmeta:${pubkeyStr}`);
  console.log("Cached:", cached);
  
  let meta = {};
  if (cached) {
    meta = JSON.parse(cached);
  } else {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await res.json();
    const pairs = data?.pairs ?? [];
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    if (best) {
      meta = {
        name: best.baseToken?.name,
        symbol: best.baseToken?.symbol,
        imageUrl: best.info?.imageUrl ?? '',
        chainId: best.chainId ?? 'solana',
        originalAddress: mint
      };
    }
  }
  
  const update = await prisma.room.updateMany({
    where: { tokenMint: pubkeyStr },
    data: {
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      tokenImageUrl: meta.imageUrl,
      chainId: meta.chainId,
      originalAddress: meta.originalAddress
    }
  });
  console.log("Updated rooms:", update.count);
}
main();
