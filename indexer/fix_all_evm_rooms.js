const { PrismaClient } = require('@prisma/client');
const { PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const Redis = require('ioredis');

const prisma = new PrismaClient();
const redis = new Redis('redis://localhost:6379');

async function fetchTokenMeta(mintAddress) {
  try {
    let lookupAddress = mintAddress;
    let isEvm = false;
    try {
      const pubkey = new PublicKey(mintAddress);
      const buffer = pubkey.toBuffer();
      let evmCheck = true;
      for (let i = 20; i < 32; i++) {
        if (buffer[i] !== 0) {
          evmCheck = false;
          break;
        }
      }
      if (evmCheck) {
        lookupAddress = '0x' + buffer.slice(0, 20).toString('hex');
        isEvm = true;
      }
    } catch {
      if (mintAddress.startsWith('0x')) {
        isEvm = true;
      }
    }

    if (!isEvm) {
      return null;
    }

    const url = `https://api.dexscreener.com/latest/dex/tokens/${lookupAddress}`;
    console.log(`Fetching DexScreener metadata for EVM token ${lookupAddress} (mint: ${mintAddress})...`);
    const { data } = await axios.get(url, { timeout: 8000 });
    const pairs = data?.pairs ?? [];
    if (!pairs.length) {
      console.log(`No pairs found for ${lookupAddress}`);
      return { isEvm, lookupAddress };
    }
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return {
      isEvm,
      lookupAddress,
      name: best.baseToken?.name,
      symbol: best.baseToken?.symbol,
      imageUrl: best.info?.imageUrl || '',
      chainId: best.chainId || 'monad',
      pairAddress: best.pairAddress,
      priceUsd: best.priceUsd
    };
  } catch (err) {
    console.error(`Error fetching meta for ${mintAddress}:`, err.message);
    return null;
  }
}

async function main() {
  const rooms = await prisma.room.findMany();
  console.log(`Found ${rooms.length} rooms in database. Checking for EVM tokens...`);

  let fixCount = 0;
  for (const room of rooms) {
    const meta = await fetchTokenMeta(room.tokenMint);
    if (!meta) {
      // Solana or regular token, skip
      continue;
    }

    console.log(`\nRoom ${room.roomPubkey}:`);
    console.log(`- Token Mint: ${room.tokenMint}`);
    console.log(`- EVM Address: ${meta.lookupAddress}`);
    console.log(`- DexScreener Chain: ${meta.chainId}`);
    console.log(`- Ticker: ${meta.symbol}`);
    console.log(`- Name: ${meta.name}`);

    if (meta.symbol) {
      // Update DB
      await prisma.room.update({
        where: { roomPubkey: room.roomPubkey },
        data: {
          originalAddress: meta.lookupAddress,
          chainId: meta.chainId,
          tokenName: meta.name ?? room.tokenName,
          tokenSymbol: meta.symbol,
          tokenImageUrl: meta.imageUrl || null
        }
      });

      // Update Redis Token Meta Cache
      const metaCacheData = {
        name: meta.name,
        symbol: meta.symbol,
        imageUrl: meta.imageUrl,
        chainId: meta.chainId,
        originalAddress: meta.lookupAddress,
        priceUsd: meta.priceUsd
      };
      await redis.set(`tokenmeta:${room.tokenMint}`, JSON.stringify(metaCacheData), 'EX', 86400);
      await redis.set(`tokenmeta:${meta.lookupAddress}`, JSON.stringify(metaCacheData), 'EX', 86400);

      // Update Redis Room Cache
      const roomCacheKey = `room:${room.roomPubkey}`;
      const cachedRoomRaw = await redis.get(roomCacheKey);
      if (cachedRoomRaw) {
        const cachedRoom = JSON.parse(cachedRoomRaw);
        cachedRoom.tokenName = meta.name ?? cachedRoom.tokenName;
        cachedRoom.tokenSymbol = meta.symbol;
        cachedRoom.tokenImageUrl = meta.imageUrl;
        cachedRoom.pairAddress = meta.pairAddress || cachedRoom.pairAddress || '';
        await redis.set(roomCacheKey, JSON.stringify(cachedRoom));
        console.log(`- Redis room cache updated for ${room.roomPubkey}`);
      }

      console.log(`Successfully updated room ${room.roomPubkey} with metadata.`);
      fixCount++;
    } else {
      console.log(`No ticker found/updated for room ${room.roomPubkey}.`);
    }
  }

  console.log(`\nCompleted. Fixed ${fixCount} EVM rooms.`);
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    redis.disconnect();
  });
