import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis('redis://localhost:6379');

const mockRooms = [
  {
    roomPubkey: 'A1Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: 'DezXAZ8z7PnrnNsNzR2LsEGvC8C3yC1WwFB6bHwq7g9n',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Bonk Coin',
    tokenSymbol: 'BONK',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/DezXAZ8z7PnrnNsNzR2LsEGvC8C3yC1WwFB6bHwq7g9n?width=400',
    chainId: 'solana',
    originalAddress: 'DezXAZ8z7PnrnNsNzR2LsEGvC8C3yC1WwFB6bHwq7g9n',
    duration: 30,
    openingPrice: 150000n, // $0.00015 scaled
    expiry: new Date(Date.now() + 2 * 3600 * 1000), // 2h from now
    status: 'active',
    totalPool: 15000000000n, // 15 SOL
    moonPool: '8500000000', // 8.5 SOL
    jeetPool: '6500000000', // 6.5 SOL
  },
  {
    roomPubkey: 'B2Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Degen Token',
    tokenSymbol: 'DEGEN',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/0x4ed4e862860bed51a9570b96d89af5e1b0efefed?width=400',
    chainId: 'base',
    originalAddress: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
    duration: 15,
    openingPrice: 8000000n, // $0.008 scaled
    expiry: new Date(Date.now() + 1 * 3600 * 1000), // 1h from now
    status: 'active',
    totalPool: 8000000000n, // 8 SOL
    moonPool: '3000000000', // 3 SOL
    jeetPool: '5000000000', // 5 SOL
  },
  {
    roomPubkey: 'E3Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Lido Staked ETH',
    tokenSymbol: 'stETH',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/0xae7ab96520de3a18e5e111b5eaab095312d7fe84?width=400',
    chainId: 'ethereum',
    originalAddress: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    duration: 60,
    openingPrice: 3400000000000n, // $3400 scaled
    expiry: new Date(Date.now() + 4 * 3600 * 1000), // 4h from now
    status: 'active',
    totalPool: 25000000000n, // 25 SOL
    moonPool: '15000000000', // 15 SOL
    jeetPool: '10000000000', // 10 SOL
  },
  {
    roomPubkey: 'S4Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: 'So11111111111111111111111111111111111111112',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Solana Token',
    tokenSymbol: 'SOL',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/So11111111111111111111111111111111111111112?width=400',
    chainId: 'solana',
    originalAddress: 'So11111111111111111111111111111111111111112',
    duration: 5,
    openingPrice: 150000000000n, // $150 scaled
    expiry: new Date(Date.now() + 180 * 1000), // 3 min from now
    status: 'active',
    totalPool: 42000000000n, // 42 SOL
    moonPool: '20000000000', // 20 SOL
    jeetPool: '22000000000', // 22 SOL
  },
  {
    roomPubkey: 'B5Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: '0x532f27101965dd16442e59d406704f9e1c070282',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Brett Coin',
    tokenSymbol: 'BRETT',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/0x532f27101965dd16442e59d406704f9e1c070282?width=400',
    chainId: 'base',
    originalAddress: '0x532f27101965dd16442e59d406704f9e1c070282',
    duration: 30,
    openingPrice: 140000000n, // $0.14 scaled
    expiry: new Date(Date.now() + 20 * 60 * 1000), // 20m from now
    status: 'active',
    totalPool: 500000000n, // 0.5 SOL
    moonPool: '300000000', // 0.3 SOL
    jeetPool: '200000000', // 0.2 SOL
  },
  {
    roomPubkey: 'E6Qz1Yv5MUVWaUn64BWKRbp7Nbn6HFTaJQEThM33PsZf',
    tokenMint: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    priceFeed: '11111111111111111111111111111111',
    tokenName: 'Tether USD',
    tokenSymbol: 'USDT',
    tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/0xdac17f958d2ee523a2206206994597c13d831ec7?width=400',
    chainId: 'ethereum',
    originalAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    duration: 60,
    openingPrice: 1000000000n, // $1.00 scaled
    expiry: new Date(Date.now() + 90 * 60 * 1000), // 1.5 hours from now
    status: 'active',
    totalPool: 95000000000n, // 95 SOL
    moonPool: '40000000000', // 40 SOL
    jeetPool: '55000000000', // 55 SOL
  },
];

async function main() {
  console.log('Seeding mock active rooms in PostgreSQL...');
  for (const r of mockRooms) {
    const { moonPool, jeetPool, ...dbRoom } = r;
    await prisma.room.upsert({
      where: { roomPubkey: dbRoom.roomPubkey },
      create: {
        ...dbRoom,
        createdAt: new Date(),
      },
      update: {
        ...dbRoom,
        createdAt: new Date(),
      },
    });

    // Seed Redis cache
    const key = `room:${dbRoom.roomPubkey}`;
    await redis.hset(key, {
      status: dbRoom.status,
      tokenMint: dbRoom.tokenMint,
      tokenName: dbRoom.tokenName,
      tokenSymbol: dbRoom.tokenSymbol,
      tokenImageUrl: dbRoom.tokenImageUrl,
      openingPrice: dbRoom.openingPrice.toString(),
      moonPool,
      jeetPool,
      expiry: dbRoom.expiry.toISOString(),
      pairAddress: '',
    });
    await redis.expire(key, 24 * 3600); // 24h expiration
    console.log(`✅ Seeded room ${dbRoom.tokenSymbol} (${dbRoom.chainId})`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
