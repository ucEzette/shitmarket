const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(rooms);
}
main();
