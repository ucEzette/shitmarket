const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function getRoomPda(programId, tokenMint, creator, nonce) {
    return PublicKey.findProgramAddressSync([Buffer.from("room"), tokenMint.toBuffer(), creator.toBuffer(), Buffer.from([nonce])], programId)[0];
}
function getPlatformConfigPda(programId) {
    return PublicKey.findProgramAddressSync([Buffer.from("platform_config")], programId)[0];
}
function getEscrowPda(programId, room) {
    return PublicKey.findProgramAddressSync([Buffer.from("escrow"), room.toBuffer()], programId)[0];
}
function getBetPda(programId, room, user, side) {
    return PublicKey.findProgramAddressSync([Buffer.from("bet"), room.toBuffer(), user.toBuffer(), Buffer.from(side)], programId)[0];
}

async function run() {
    console.log("🚀 STARTING FULL E2E TRENCH BATTLE TEST");
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const idl = JSON.parse(fs.readFileSync("../program/target/idl/shitmarket.json", "utf8"));
    const programId = new PublicKey(idl.metadata.address);
    const deployerKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf8")))
    );
    const wallet = new anchor.Wallet(deployerKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    const program = new anchor.Program(idl, provider);

    const tokenMint = new PublicKey("So11111111111111111111111111111111111111112");
    const creator = deployerKeypair;

    let chosenNonce = 0;
    let roomPda = null;
    for (let i = 0; i < 256; i++) {
        const pda = getRoomPda(programId, tokenMint, creator.publicKey, i);
        const info = await connection.getAccountInfo(pda);
        if (!info) {
            chosenNonce = i;
            roomPda = pda;
            break;
        }
    }
    console.log(`[1] Found clean room nonce: ${chosenNonce}, PDA: ${roomPda.toBase58()}`);

    const configPda = getPlatformConfigPda(programId);
    const escrowPda = getEscrowPda(programId, roomPda);
    const priceFeed = anchor.web3.SystemProgram.programId;

    console.log("[2] Launching Prediction Arena...");
    await program.methods.createRoom(
        new anchor.BN(1), // 1 minute
        new anchor.BN(150000000), 
        chosenNonce
    ).accounts({
        room: roomPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        priceFeed: priceFeed,
        switchboardFeed: priceFeed,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId
    }).rpc();
    console.log("✅ Arena Launched!");

    console.log("[3] Seeding the trenches...");
    const moonBetPda = getBetPda(programId, roomPda, creator.publicKey, "moon");
    await program.methods.placeBet({ moon: {} }, new anchor.BN(0.1 * 1e9))
        .accounts({
            room: roomPda,
            bet: moonBetPda,
            escrow: escrowPda,
            user: creator.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            config: configPda,
            reputation: anchor.web3.SystemProgram.programId
        }).rpc();
    console.log("✅ Moon seeded with 0.1 SOL");

    const jeetBettor = Keypair.generate();
    await connection.requestAirdrop(jeetBettor.publicKey, 1 * 1e9);
    await delay(2000);

    const jeetProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(jeetBettor), { commitment: "confirmed" });
    const jeetProgram = new anchor.Program(idl, jeetProvider);
    const jeetBetPda = getBetPda(programId, roomPda, jeetBettor.publicKey, "jeet");
    
    await jeetProgram.methods.placeBet({ jeet: {} }, new anchor.BN(0.1 * 1e9))
        .accounts({
            room: roomPda,
            bet: jeetBetPda,
            escrow: escrowPda,
            user: jeetBettor.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            config: configPda,
            reputation: anchor.web3.SystemProgram.programId
        }).rpc();
    console.log("✅ Jeet seeded with 0.1 SOL");

    console.log("[4] Arena is live. Settlement and Referrals will execute automatically in ~1 minute via the running indexer.");
}
run().catch(console.error);
