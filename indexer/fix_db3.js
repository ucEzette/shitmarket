const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const update = await prisma.room.updateMany({
    where: { tokenMint: '3HHLxppcp4Qxog979Lc7h1h7WQtSxDyVreCyMeFB2oyH' },
    data: {
      tokenSymbol: 'BOB',
      tokenName: 'BOB',
      tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/db826a7bc3b3012c6aff349a0159a6ca88f5c04010dd84b6fb1ae6316be47b50?width=800&height=800&quality=95&format=auto',
      chainId: 'bsc',
      originalAddress: '0x245c386dCFeD896f5c346107596141e5EDcBFFfF'
    }
  });
  console.log("Updated rooms:", update.count);
}
main();
