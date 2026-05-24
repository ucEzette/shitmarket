import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { prisma } from "../src/db";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function getRoomPda(programId: PublicKey, tokenMint: PublicKey, creator: PublicKey, nonce: number) {
    return PublicKey.findProgramAddressSync([Buffer.from("room"), tokenMint.toBuffer(), creator.toBuffer(), Buffer.from([nonce])], programId)[0];
}
export function getPlatformConfigPda(programId: PublicKey) {
    return PublicKey.findProgramAddressSync([Buffer.from("platform_config")], programId)[0];
}
export function getEscrowPda(programId: PublicKey, room: PublicKey) {
    return PublicKey.findProgramAddressSync([Buffer.from("escrow"), room.toBuffer()], programId)[0];
}
export function getBetPda(programId: PublicKey, room: PublicKey, user: PublicKey, side: "moon" | "jeet") {
    // Note: the contract maps "moon" to a side byte 0 and "jeet" to 1
    const sideByte = side === "moon" ? 0 : 1;
    return PublicKey.findProgramAddressSync([Buffer.from("bet"), room.toBuffer(), user.toBuffer(), Buffer.from([sideByte])], programId)[0];
}

async function run() {
    console.log("🚀 STARTING E2E 5-MINUTE ROOM TEST");

    // 1. Setup Solana Connection and Program
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const idlPath = path.resolve(__dirname, "../src/utils/idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    const programId = new PublicKey("GxkRWMoyKpKkTadmGqqqLvA473YTwvDUeSPK1iS8REim");
    
    const deployerKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf8")))
    );
    const wallet = new anchor.Wallet(deployerKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    
    // Cast IDL with address
    const idlWithAddress = { ...idl, address: programId.toBase58() };
    const program = new anchor.Program(idlWithAddress as any, provider);

    // 2. Generate E2E Test Wallets
    const moonBettor = Keypair.generate();
    const jeetBettor = Keypair.generate();
    const referrer = Keypair.generate();

    console.log(`\n🔑 Key Actor Wallets:`);
    console.log(`  - Deployer/Creator (Admin): ${deployerKeypair.publicKey.toBase58()}`);
    console.log(`  - Moon Bettor:             ${moonBettor.publicKey.toBase58()}`);
    console.log(`  - Jeet Bettor:             ${jeetBettor.publicKey.toBase58()}`);
    console.log(`  - Referrer (Inviter):      ${referrer.publicKey.toBase58()}`);

    // 3. Establish Referrals in Postgres Database
    console.log("\n💾 Linking referral records in Postgres database...");
    await prisma.userProfile.upsert({
        where: { userPubkey: moonBettor.publicKey.toBase58() },
        create: {
            userPubkey: moonBettor.publicKey.toBase58(),
            referredBy: referrer.publicKey.toBase58(),
            referralCode: "E2E_M_" + moonBettor.publicKey.toBase58().slice(0, 10),
        },
        update: {
            referredBy: referrer.publicKey.toBase58(),
        }
    });

    await prisma.userProfile.upsert({
        where: { userPubkey: jeetBettor.publicKey.toBase58() },
        create: {
            userPubkey: jeetBettor.publicKey.toBase58(),
            referredBy: referrer.publicKey.toBase58(),
            referralCode: "E2E_J_" + jeetBettor.publicKey.toBase58().slice(0, 10),
        },
        update: {
            referredBy: referrer.publicKey.toBase58(),
        }
    });
    console.log("✅ Referral mapping successfully established in database.");

    // 4. Request Airdrops for Actors
    console.log("\n🪂 Funding wallets via airdrop...");
    const airdropSigs = await Promise.all([
        connection.requestAirdrop(moonBettor.publicKey, 3 * 1e9),
        connection.requestAirdrop(jeetBettor.publicKey, 3 * 1e9),
        connection.requestAirdrop(referrer.publicKey, 0.05 * 1e9)
    ]);
    
    // Confirm airdrops
    await Promise.all(airdropSigs.map(sig => connection.confirmTransaction(sig, "confirmed")));
    console.log("✅ Airdrops confirmed!");

    // Log actor starting balances
    const initialMoonBal = await connection.getBalance(moonBettor.publicKey);
    const initialJeetBal = await connection.getBalance(jeetBettor.publicKey);
    const initialRefBal = await connection.getBalance(referrer.publicKey);
    const initialTreasuryBal = await connection.getBalance(deployerKeypair.publicKey); // Treasury is deployer in local config

    console.log(`\n💰 Starting Balances:`);
    console.log(`  - Moon Bettor starting balance: ${(initialMoonBal / 1e9).toFixed(4)} SOL`);
    console.log(`  - Jeet Bettor starting balance: ${(initialJeetBal / 1e9).toFixed(4)} SOL`);
    console.log(`  - Referrer starting balance:    ${(initialRefBal / 1e9).toFixed(4)} SOL`);
    console.log(`  - Treasury starting balance:    ${(initialTreasuryBal / 1e9).toFixed(4)} SOL`);

    // 5. Select a Clean Nonce and Derive Room PDAs
    const tokenMint = new PublicKey("So11111111111111111111111111111111111111112"); // WSOL
    let chosenNonce = 0;
    let roomPda: PublicKey | null = null;
    for (let i = 0; i < 256; i++) {
        const pda = getRoomPda(programId, tokenMint, deployerKeypair.publicKey, i);
        const info = await connection.getAccountInfo(pda);
        if (!info) {
            chosenNonce = i;
            roomPda = pda;
            break;
        }
    }

    if (!roomPda) {
        throw new Error("Could not find a clean nonce!");
    }

    const configPda = getPlatformConfigPda(programId);
    const escrowPda = getEscrowPda(programId, roomPda);

    console.log(`\n🏛️ Derived PDA Accounts:`);
    console.log(`  - Room PDA:    ${roomPda.toBase58()} (nonce: ${chosenNonce})`);
    console.log(`  - Config PDA:  ${configPda.toBase58()}`);
    console.log(`  - Escrow PDA:  ${escrowPda.toBase58()}`);

    // 6. Deploy Room (Duration: 5 Minutes)
    // Note: in local development, SECONDS_PER_MINUTE is set to 1 in the contract,
    // so a duration of 300 "minutes" is exactly 300 seconds (5 minutes) on-chain.
    const durationMins = 300; 
    const openingPrice = new anchor.BN(150_000_000); // $150.00
    
    console.log(`\n⚔️ Launching prediction room for ${durationMins} minutes (300 seconds)...`);
    const createTx = await (program as any).methods.createRoom(
        tokenMint,
        "Wrapped SOL",
        durationMins,
        null,
        openingPrice,
        chosenNonce
    ).accounts({
        room: roomPda,
        escrow: escrowPda,
        creator: deployerKeypair.publicKey,
        priceFeed: anchor.web3.SystemProgram.programId,
        switchboardFeed: anchor.web3.SystemProgram.programId,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId
    }).rpc();
    
    console.log(`🚀 Room deployed successfully!`);
    console.log(`👉 Tx Proof: ${createTx}`);

    // Fetch and debug timestamps
    try {
        const roomAccount = await (program.account as any).room.fetch(roomPda);
        const slot = await connection.getSlot();
        const blockTime = await connection.getBlockTime(slot);
        console.log(`🔍 Timestamp Debugging:`);
        console.log(`  - Room Opening Timestamp: ${roomAccount.openingTimestamp.toString()}`);
        console.log(`  - Room Expiry Timestamp:  ${roomAccount.expiryTimestamp.toString()}`);
        console.log(`  - Current Block Time:     ${blockTime}`);
        console.log(`  - Duration Minutes:       ${roomAccount.durationMinutes}`);
        console.log(`  - Status:                 ${JSON.stringify(roomAccount.status)}`);
    } catch (err) {
        console.error("Failed to fetch room account:", err);
    }

    // Wait a brief moment to allow indexer to record the room creation
    console.log("\n⏳ Waiting 1 second for slot progression...");
    await delay(1000);

    // 7. Place Bets on Both Sides
    const betAmount = 0.2; // 0.2 SOL each
    const betAmountLamports = new anchor.BN(betAmount * 1e9);

    console.log(`\n🎲 Placing bets (0.2 SOL on Moon and 0.2 SOL on Jeet)...`);
    
    // Moon Bet
    const moonBetPda = getBetPda(programId, roomPda, moonBettor.publicKey, "moon");
    const moonProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(moonBettor), { commitment: "confirmed" });
    const moonProgram = new anchor.Program(idlWithAddress as any, moonProvider);
    
    console.log("  - Placing bet for Moon...");
    const moonBetTx = await (moonProgram as any).methods.placeBet({ moon: {} }, betAmountLamports)
        .accounts({
            room: roomPda,
            bet: moonBetPda,
            escrow: escrowPda,
            user: moonBettor.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            config: configPda,
            reputation: null
        }).rpc();
    console.log(`  ✅ Moon Bet Placed! Tx: ${moonBetTx}`);

    // Jeet Bet
    const jeetBetPda = getBetPda(programId, roomPda, jeetBettor.publicKey, "jeet");
    const jeetProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(jeetBettor), { commitment: "confirmed" });
    const jeetProgram = new anchor.Program(idlWithAddress as any, jeetProvider);

    console.log("  - Placing bet for Jeet...");
    const jeetBetTx = await (jeetProgram as any).methods.placeBet({ jeet: {} }, betAmountLamports)
        .accounts({
            room: roomPda,
            bet: jeetBetPda,
            escrow: escrowPda,
            user: jeetBettor.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            config: configPda,
            reputation: null
        }).rpc();
    console.log(`  ✅ Jeet Bet Placed! Tx: ${jeetBetTx}`);

    console.log("\n⏳ Waiting 5 seconds for indexer to capture bets...");
    await delay(5000);

    // 8. Sleep for the 5-Minute Room Duration
    const sleepDurationSeconds = 300; // 5 minutes
    const bufferSeconds = 15; // 15 seconds buffer to ensure expiration
    const totalSleepSeconds = sleepDurationSeconds + bufferSeconds;

    console.log(`\n⏳ SLEEPING FOR ${totalSleepSeconds} SECONDS (5m 15s) TO ELAPSE PREDICTION ARENA COUNTDOWN...`);
    console.log("The indexer settlement keeper will automatically fire, settle, and payout winners + referrers on-chain!");

    for (let elapsed = 0; elapsed < totalSleepSeconds; elapsed += 30) {
        const remaining = totalSleepSeconds - elapsed;
        console.log(`   ⏱️ Elapsed: ${elapsed}s / Total: ${totalSleepSeconds}s | Remaining: ${remaining}s`);
        await delay(30000);
    }
    
    // Final remaining seconds delay
    const finalSeconds = totalSleepSeconds % 30;
    if (finalSeconds > 0) {
        await delay(finalSeconds * 1000);
    }

    console.log("\n⏰ Countdown complete! Waiting 15 seconds for keeper settlement execution & payouts to confirm...");
    await delay(15000);

    // 9. Fetch Final Balances & Compute Changes
    console.log("\n📊 E2E TEST RESULTS & BALANCE AUDIT");
    const finalMoonBal = await connection.getBalance(moonBettor.publicKey);
    const finalJeetBal = await connection.getBalance(jeetBettor.publicKey);
    const finalRefBal = await connection.getBalance(referrer.publicKey);
    const finalTreasuryBal = await connection.getBalance(deployerKeypair.publicKey);

    const moonDiff = (finalMoonBal - initialMoonBal) / 1e9;
    const jeetDiff = (finalJeetBal - initialJeetBal) / 1e9;
    const refDiff = (finalRefBal - initialRefBal) / 1e9;
    const treasuryDiff = (finalTreasuryBal - initialTreasuryBal) / 1e9;

    console.log(`\n📈 Final Balances & Diffs:`);
    console.log(`  - Moon Bettor final balance: ${(finalMoonBal / 1e9).toFixed(4)} SOL (change: ${moonDiff >= 0 ? "+" : ""}${moonDiff.toFixed(4)} SOL)`);
    console.log(`  - Jeet Bettor final balance: ${(finalJeetBal / 1e9).toFixed(4)} SOL (change: ${jeetDiff >= 0 ? "+" : ""}${jeetDiff.toFixed(4)} SOL)`);
    console.log(`  - Referrer final balance:    ${(finalRefBal / 1e9).toFixed(4)} SOL (change: ${refDiff >= 0 ? "+" : ""}${refDiff.toFixed(4)} SOL)`);
    console.log(`  - Treasury final balance:    ${(finalTreasuryBal / 1e9).toFixed(4)} SOL (change: ${treasuryDiff >= 0 ? "+" : ""}${treasuryDiff.toFixed(4)} SOL)`);

    // 10. Query Database to get exact Settlement Proofs
    const dbRoom = await prisma.room.findUnique({
        where: { roomPubkey: roomPda.toBase58() },
        include: { bets: true }
    });

    console.log(`\n📁 Database Record Audit (Room: ${roomPda.toBase58()}):`);
    if (!dbRoom) {
        console.log("❌ CRITICAL: Room was not found in Postgres database!");
    } else {
        console.log(`  - Status:       ${dbRoom.status}`);
        console.log(`  - Winner:       ${dbRoom.winner?.toUpperCase()}`);
        console.log(`  - Total Pool:   ${Number(dbRoom.totalPool) / 1e9} SOL`);
        console.log(`  - Platform Fee: ${Number(dbRoom.platformFee) / 1e9} SOL`);
        console.log(`  - Bets Count:   ${dbRoom.bets.length}`);
        
        // Find referral payouts
        const dbRefPayouts = await prisma.referralPayout.findMany({
            where: { roomPubkey: roomPda.toBase58() }
        });
        
        console.log(`\n💸 Referral Payout Ledger:`);
        if (dbRefPayouts.length === 0) {
            console.log("  ⚠️ No referral payouts recorded in database.");
        } else {
            dbRefPayouts.forEach(p => {
                console.log(`  - Referrer: ${p.referrer}`);
                console.log(`    Invitee:  ${p.invitee}`);
                console.log(`    Bet:      ${Number(p.betAmount) / 1e9} SOL`);
                console.log(`    Cut:      ${Number(p.rewardAmount) / 1e9} SOL`);
                console.log(`    Tx Hash:  ${p.txSig}`);
            });
        }

        // Find on-chain winner claim signature or payout record in DB
        const winningSide = dbRoom.winner;
        const winnerPubkey = winningSide === "moon" ? moonBettor.publicKey.toBase58() : jeetBettor.publicKey.toBase58();
        console.log(`\n🏆 Winner: ${winningSide?.toUpperCase()} (${winnerPubkey})`);
    }

    console.log("\n🏁 E2E 5-MINUTE ROOM TEST COMPLETE!");
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("E2E Test Failed with error:", err);
        process.exit(1);
    });
