import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Truncating all database tables...");
    
    // Disable triggers and truncate in cascade
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "chat_messages", "payouts", "referral_payouts", "bets", "rooms", "processed_txs", "reputations", "user_profiles", "price_samples" CASCADE;`);
    
    console.log("All tables truncated successfully!");
}

main()
    .catch((e) => {
        console.error("Error clearing DB:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
