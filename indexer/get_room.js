const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const room = await prisma.room.findUnique({
    where: { roomPubkey: 'GZqUgCx37PdvC5PDp8kshKvMuUi1AECfcdgiZtsaRCLP' }
  });
  console.log(room);
}
main();
