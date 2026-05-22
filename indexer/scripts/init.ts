import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import os from "os";

// We load the IDL. Because it is JSON, we can just require it or read it.
const idlPath = "../src/utils/idl.json";
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// PATCH the outdated IDL in-memory
const initInstr = idl.instructions.find((i: any) => i.name === "initialize");
if (initInstr) {
    initInstr.args = [{ name: "platformFeeBps", type: "u16" }];
}

async function main() {
    // 1. Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

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
    const programId = new PublicKey("GxkRWMoyKpKkTadmGqqqLvA473YTwvDUeSPK1iS8REim");
    const program = new anchor.Program(idl as anchor.Idl, provider);

    // 4. Derive PDA
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );
    console.log("Config PDA:", configPda.toBase58());

    // 5. Initialize
    const feeBps = 200; // 2%
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
    } catch (e: any) {
        if (e.message.includes("already in use") || String(e).includes("already in use")) {
            console.log("Contract is already initialized. Let's update the config instead.");
            const tx2 = await program.methods.updateConfig(
                deployer.publicKey, // new_treasury
                null, // new_keeper
                feeBps, // new_fee_bps
                null, // new_min_liquidity
                null, // new_twap_window
            ).accounts({
                config: configPda,
                admin: deployer.publicKey,
            }).signers([deployer]).rpc();
            console.log("Update config successful! Tx:", tx2);
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
