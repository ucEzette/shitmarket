import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import os from "os";

// Load the IDL.
const idlPath = "../src/utils/idl.json";
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// PATCH the outdated IDL in-memory
const initInstr = idl.instructions.find((i: any) => i.name === "initialize");
if (initInstr) {
    initInstr.args = [{ name: "platformFeeBps", type: "u16" }];
}

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    const secretKeyPath = os.homedir() + "/.config/solana/id.json";
    const secretKeyString = fs.readFileSync(secretKeyPath, "utf8");
    const secretKeyArray = JSON.parse(secretKeyString);
    const deployer = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    console.log("Using deployer wallet:", deployer.publicKey.toBase58());

    const wallet = new anchor.Wallet(deployer);
    const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
    anchor.setProvider(provider);

    const programId = new PublicKey("GxkRWMoyKpKkTadmGqqqLvA473YTwvDUeSPK1iS8REim");
    const program = new anchor.Program(idl as anchor.Idl, provider);

    // Derive Config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );

    // Let's use an existing room or a dummy room address for simulation
    // Let's find an active room from the devnet or just use a dummy one to see if the deserialization is the issue.
    // Wait, if the room does not exist, the simulation will revert with "AccountNotFound" for the room account.
    // Let's see: we can create a room first in the same tx block, or we can query any active room on devnet!
    // Let's query active rooms on devnet by fetching program accounts!
    console.log("Fetching program accounts for active rooms...");
    const roomAccounts = await connection.getProgramAccounts(programId);

    console.log(`Fetched ${roomAccounts.length} program accounts:`);
    for (const acc of roomAccounts) {
        console.log(`- Address: ${acc.pubkey.toBase58()}, Size: ${acc.account.data.length}`);
    }

    const roomAcc = roomAccounts.find(acc => acc.account.data.length === 374 || acc.account.data.length === 341);
    if (!roomAcc) {
        console.log("No account with data size 341 or 374 (Room) found on devnet!");
        process.exit(0);
    }
    const activeRoom = roomAcc.pubkey;
    console.log("Found active Room account:", activeRoom.toBase58());

    const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), activeRoom.toBuffer()],
        programId
    );
    const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), activeRoom.toBuffer(), deployer.publicKey.toBuffer()],
        programId
    );

    console.log("Escrow PDA:", escrowPda.toBase58());
    console.log("Bet PDA:", betPda.toBase58());

    // We will simulate placing a bet of 0.01 SOL (10,000,000 lamports) on Moon
    console.log("Testing placeBet simulation...");

    try {
        const tx = await program.methods.placeBet(
            { moon: {} },
            new anchor.BN(10_000_000)
        ).accounts({
            room: activeRoom,
            escrow: escrowPda,
            bet: betPda,
            user: deployer.publicKey,
            reputation: programId,
            config: configPda,
            systemProgram: SystemProgram.programId,
        });

        const builtTx = await tx.transaction();
        builtTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        builtTx.feePayer = deployer.publicKey;
        
        const simResult = await connection.simulateTransaction(builtTx);
        console.log("Simulation Result:", JSON.stringify(simResult.value, null, 2));

        if (simResult.value.err) {
            console.error("Simulation failed with error:", simResult.value.err);
            console.error("Logs:", simResult.value.logs);
            process.exit(1);
        } else {
            console.log("=========================================");
            console.log("SIMULATION SUCCESSFUL! NO REVERT DETECTED!");
            console.log("=========================================");
            process.exit(0);
        }
    } catch (err) {
        console.error("Failed to build/simulate transaction:", err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
