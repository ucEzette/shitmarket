import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

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
    const sideByte = side === "moon" ? 0 : 1;
    return PublicKey.findProgramAddressSync([Buffer.from("bet"), room.toBuffer(), user.toBuffer(), Buffer.from([sideByte])], programId)[0];
}

async function customRpc(methodsBuilder: any, connection: Connection) {
    const tx = await methodsBuilder.transaction();
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    tx.feePayer = provider.wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    
    const signedTx = await provider.wallet.signTransaction(tx);
    const rawTx = signedTx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, { skipPreflight: false });
    
    console.log(`Transaction sent: ${signature}. Waiting for confirmation...`);
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const result = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }, "confirmed");
    
    if (result.value.err) {
        console.error("❌ On-chain transaction error:", result.value.err);
        try {
            const txDetails = await connection.getTransaction(signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
            });
            if (txDetails?.meta?.logMessages) {
                console.error("📜 Transaction Logs:");
                console.error(txDetails.meta.logMessages.join("\n"));
            }
        } catch (fetchErr) {
            console.error("Could not fetch on-chain logs:", fetchErr);
        }
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
    }
    
    return signature;
}

async function run() {
    console.log("🚀 STARTING ONE-SIDED ROOM REFUND E2E TEST (CUSTOM RPC)");
    
    // 1. Setup
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const idl = JSON.parse(fs.readFileSync("../program/target/idl/shitmarket.json", "utf8"));
    const programId = new PublicKey(idl.address);
    const deployerKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf8")))
    );
    const wallet = new anchor.Wallet(deployerKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    const program = new anchor.Program(idl as any, provider) as any;

    const tokenMint = Keypair.generate().publicKey; // Random mint to ensure fresh room
    const creator = deployerKeypair;

    let chosenNonce = 0;
    let roomPda = getRoomPda(programId, tokenMint, creator.publicKey, chosenNonce);
    console.log(`[1] Using room PDA: ${roomPda.toBase58()}`);

    const durationMins = 5; // 5 seconds in localnet because SECONDS_PER_MINUTE = 1
    const configPda = getPlatformConfigPda(programId);
    const escrowPda = getEscrowPda(programId, roomPda);
    const priceFeed = anchor.web3.SystemProgram.programId;

    const openingPrice = new anchor.BN(150_000_000);

    console.log("[2] Launching One-Sided Prediction Arena...");
    const createRoomBuilder = program.methods.createRoom(
        tokenMint,                  // token_mint (Pubkey)
        "Bull",                     // token_name (String)
        durationMins,               // duration_minutes (u32)
        null,                       // switchboard_feed (Option<Pubkey>)
        openingPrice,               // opening_price_param (Option<i64>)
        chosenNonce                 // nonce (u8)
    ).accounts({
        room: roomPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        priceFeed: priceFeed,
        switchboardFeed: priceFeed,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId
    });
    await customRpc(createRoomBuilder, connection);
    console.log("✅ One-Sided Arena Launched!");

    const roomStateBefore = await (program.account as any).room.fetch(roomPda);
    console.log("🔍 CREATED ROOM STATE:", {
        openingTimestamp: roomStateBefore.openingTimestamp.toString(),
        expiryTimestamp: roomStateBefore.expiryTimestamp.toString(),
        durationMinutes: roomStateBefore.durationMinutes,
        status: roomStateBefore.status,
        now: (await connection.getBlockTime(await connection.getSlot("confirmed"))) || "unknown"
    });

    console.log("[3] Seeding only the Moon side (one-sided)...");
    const moonBetPda = getBetPda(programId, roomPda, creator.publicKey, "moon");
    
    const balanceBeforeBet = await connection.getBalance(creator.publicKey);

    const [reputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), creator.publicKey.toBuffer()],
        programId
    );
    const repAccountInfo = await connection.getAccountInfo(reputationPda);
    const reputationAccount = repAccountInfo ? reputationPda : programId;

    const placeBetBuilder = program.methods.placeBet({ moon: {} }, new anchor.BN(0.5 * 1e9))
        .accounts({
            room: roomPda,
            bet: moonBetPda,
            escrow: escrowPda,
            user: creator.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            config: configPda,
            reputation: reputationAccount
        });
    await customRpc(placeBetBuilder, connection);
    console.log("✅ Moon seeded with 0.5 SOL. Opposing (Jeet) side left at 0 SOL.");

    console.log("[4] Waiting 7 seconds for the arena to expire...");
    await delay(7000);

    console.log("[5] Settling the one-sided expired room...");
    const settleRoomBuilder = program.methods.settleRoom(null)
        .accounts({
            room: roomPda,
            escrow: escrowPda,
            treasury: creator.publicKey,
            priceFeed: priceFeed,
            switchboardFeed: priceFeed,
            config: configPda,
            keeper: creator.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId
        });
    await customRpc(settleRoomBuilder, connection);
    console.log("✅ Room settled successfully! Checked one-sided and voided it.");

    // Fetch the room state
    const roomState = await (program.account as any).room.fetch(roomPda);
    console.log("Room Winner (should be null/None):", roomState.winner);
    console.log("Room Status (should be Settled/1):", roomState.status);

    console.log("[6] Claiming refund...");
    const balanceBeforeClaim = await connection.getBalance(creator.publicKey);
    
    const claimWinningsBuilder = program.methods.claimWinnings()
        .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: moonBetPda,
            user: creator.publicKey,
            payer: creator.publicKey,
            config: configPda,
            systemProgram: anchor.web3.SystemProgram.programId
        });
    await customRpc(claimWinningsBuilder, connection);

    const balanceAfterClaim = await connection.getBalance(creator.publicKey);
    const recovered = (balanceAfterClaim - balanceBeforeClaim) / 1e9;
    console.log(`✅ Claim executed! Funds recovered: ${recovered} SOL`);
    console.log("Difference relative to exact stake (should be extremely close to 0.5 SOL):", recovered);
}

run().catch((err) => {
    console.error("❌ Test failed with error:", err);
});
