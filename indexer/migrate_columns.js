const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Starting database column length migration ===');

  const statements = [
    // rooms table
    `ALTER TABLE "rooms" ALTER COLUMN "room_pubkey" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "token_mint" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "price_feed" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "switchboard_feed" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "creator" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "dispute_challenger" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "oracle_address" TYPE VARCHAR(255)`,
    `ALTER TABLE "rooms" ALTER COLUMN "resolution_criteria" TYPE VARCHAR(500)`,

    // bets table
    `ALTER TABLE "bets" ALTER COLUMN "room_pubkey" TYPE VARCHAR(255)`,
    `ALTER TABLE "bets" ALTER COLUMN "user_pubkey" TYPE VARCHAR(255)`,

    // payouts table
    `ALTER TABLE "payouts" ALTER COLUMN "room_pubkey" TYPE VARCHAR(255)`,
    `ALTER TABLE "payouts" ALTER COLUMN "user_pubkey" TYPE VARCHAR(255)`,

    // referral_payouts table
    `ALTER TABLE "referral_payouts" ALTER COLUMN "room_pubkey" TYPE VARCHAR(255)`,

    // chat_messages table
    `ALTER TABLE "chat_messages" ALTER COLUMN "room_pubkey" TYPE VARCHAR(255)`,
    `ALTER TABLE "chat_messages" ALTER COLUMN "user" TYPE VARCHAR(255)`,

    // reputations table
    `ALTER TABLE "reputations" ALTER COLUMN "user_pubkey" TYPE VARCHAR(255)`,

    // user_profiles table (Note: user_pubkey is the primary key and referred_by is a varchar)
    `ALTER TABLE "user_profiles" ALTER COLUMN "user_pubkey" TYPE VARCHAR(255)`,
    `ALTER TABLE "user_profiles" ALTER COLUMN "referred_by" TYPE VARCHAR(255)`
  ];

  for (const sql of statements) {
    try {
      console.log(`Executing: ${sql}`);
      await prisma.$executeRawUnsafe(sql);
      console.log('Success.');
    } catch (err) {
      console.error(`Failed: ${err.message}`);
    }
  }

  console.log('=== Column length migration complete ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
