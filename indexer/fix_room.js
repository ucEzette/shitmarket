const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.room.updateMany({
    where: {
      tokenMint: 'rvGzkjZ3qn7bgyPaPw4mCkEa8xB8ZP4GdCapp6R7Edu'
    },
    data: {
      originalAddress: '0x0CC9B2e2AcD7BACfF79eb7dB48F5662B622E7777',
      chainId: 'monad',
      tokenName: 'MONI',
      tokenSymbol: 'MONI',
      tokenImageUrl: 'https://cdn.dexscreener.com/cms/images/HCpGndFYBc2I0v0H?width=800&height=800&quality=95&format=auto'
    }
  });
  console.log("Updated:", updated.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
