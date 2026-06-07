import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import bs58 from "bs58";


// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// We load the IDL. Because it is JSON, we can just require it or read it.
const idlPath = path.resolve(__dirname, "../src/utils/idl.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// PATCH the outdated IDL in-memory
const initInstr = idl.instructions.find((i: any) => i.name === "initialize");
if (initInstr) {
    initInstr.args = [{ name: "platformFeeBps", type: "u16" }];
}

async function main() {
    // 1. Connect to local/devnet
    const rpcUrl = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
    const connection = new Connection(rpcUrl, "confirmed");

    // 2. Load deployer wallet
    const secretKeyPath = os.homedir() + "/.config/solana/id.json";
    const secretKeyString = fs.readFileSync(secretKeyPath, "utf8");
    const secretKeyArray = JSON.parse(secretKeyString);
    const deployer = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    console.log("Using deployer wallet:", deployer.publicKey.toBase58());

    const wallet = new anchor.Wallet(deployer);
    const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
    anchor.setProvider(provider);

    // 3. Connect to program
    const programId = new PublicKey("2zW7Fj9tpVGqJ2FAMVfNY2WqkX8mH3xxV9KrfAzQjWpJ");
    const program = new anchor.Program(idl as anchor.Idl, provider);

    // 4. Derive PDA
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );
    console.log("Config PDA:", configPda.toBase58());

    // Load keeper public key from environment
    const keeperPrivateKeyBase58 = process.env.KEEPER_PRIVATE_KEY;
    if (!keeperPrivateKeyBase58) {
        throw new Error("KEEPER_PRIVATE_KEY is not defined in environment");
    }
    const keeperKeypair = Keypair.fromSecretKey(bs58.decode(keeperPrivateKeyBase58));
    const keeperPubkey = keeperKeypair.publicKey;
    console.log("Keeper wallet to authorize:", keeperPubkey.toBase58());

    // 5. Initialize
    const feeBps = 125; // 1.25%
    console.log(`Sending initialize tx... Treasury: ${deployer.publicKey.toBase58()}, Fee: ${feeBps} bps`);

    try {
        const tx = await program.methods.initialize(feeBps)
            .accounts({
                config: configPda,
                admin: deployer.publicKey,
                treasury: deployer.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([deployer])
            .rpc();

        console.log("Initialization successful! Tx:", tx);

        // Now update config to authorize the keeper wallet
        console.log("Updating platform config to authorize keeper...");
        const tx2 = await program.methods.updateConfig(
            null, // new_fee_bps
            null, // new_treasury
            keeperPubkey, // new_keeper
            null, // new_min_liquidity
            null, // new_twap_window
            null, // new_cooling_off
        ).accounts({
            config: configPda,
            admin: deployer.publicKey,
            newTreasury: null as any,
        }).signers([deployer]).rpc();
        console.log("Config update successful! Authorized keeper:", keeperPubkey.toBase58(), "Tx:", tx2);
    } catch (e: any) {
        if (e.message.includes("already in use") || String(e).includes("already in use")) {
            console.log("Contract is already initialized. Let's update the config instead.");
            const tx2 = await program.methods.updateConfig(
                feeBps, // new_fee_bps
                deployer.publicKey, // new_treasury
                keeperPubkey, // new_keeper
                null, // new_min_liquidity
                null, // new_twap_window
                null, // new_cooling_off
            ).accounts({
                config: configPda,
                admin: deployer.publicKey,
                newTreasury: deployer.publicKey as any,
            }).signers([deployer]).rpc();
            console.log("Update config successful! Authorized keeper:", keeperPubkey.toBase58(), "Tx:", tx2);
        } else {
            console.error("Error initializing:", e);
            throw e;
        }
    }
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
