const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Redis = require('ioredis');
const redis = new Redis();

async function main() {
  const roomPubkey = '7FV1aS7VVBeDzY6HESvjmw5N2gyT3wntKNzZiBUsMib7';
  const tokenMint = '2Cyjrp8kGDK8Zs9grTgyLAoJaxrUeJTTKWMkASSKj5ZZ';
  
  const cached = await redis.get(`tokenmeta:${tokenMint}`);
  console.log("Cached:", cached);
  const meta = JSON.parse(cached);
  
  await prisma.room.update({
    where: { roomPubkey },
    data: {
      tokenSymbol: meta.symbol,
      tokenImageUrl: meta.imageUrl,
      chainId: meta.chainId,
      originalAddress: meta.originalAddress
    }
  });
  console.log("Updated room in DB.");
}
main();
