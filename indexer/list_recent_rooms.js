const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    where: {
      createdAt: {
        gte: new Date('2026-06-13T03:25:00.000Z')
      }
    }
  });
  const serialized = rooms.map(r => {
    const copy = { ...r };
    for (const k in copy) {
      if (typeof copy[k] === 'bigint') {
        copy[k] = copy[k].toString();
      }
    }
    return copy;
  });
  console.log("Rooms created after 05:25 local time:", JSON.stringify(serialized, null, 2));
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
