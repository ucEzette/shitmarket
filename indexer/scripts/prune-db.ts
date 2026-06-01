import { connectDb, disconnectDb } from '../src/db';
import { runPruner } from '../src/utils/dbPruner';

async function main() {
    console.log("🚀 INITIALIZING MANUAL DATABASE SPACE PRUNER & CHAT BACKUP");
    
    // Connect to database
    await connectDb();
    
    try {
        const results = await runPruner();
        
        console.log("\n==============================================");
        console.log("✅ SPACE PRESERVATION & BACKUP ROUTINE COMPLETE");
        console.log("==============================================");
        console.log(`- Chat Backup File:  ${results.backupPath || 'N/A (No chats to backup)'}`);
        console.log(`- Pruned Old Chats:  ${results.prunedChatsCount} records`);
        console.log(`- Pruned Price Data: ${results.prunedSamplesCount} records`);
        console.log(`- Pruned Tx Logs:    ${results.prunedTxsCount} records`);
        console.log("==============================================\n");
        
    } catch (error) {
        console.error("❌ Pruner script execution failed:", error);
        process.exit(1);
    } finally {
        // Disconnect DB connection safely
        await disconnectDb();
    }
}

main();
