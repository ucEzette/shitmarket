import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const idlPath = path.resolve(__dirname, "../src/utils/idl.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

async function main() {
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const programId = new PublicKey("2zW7Fj9tpVGqJ2FAMVfNY2WqkX8mH3xxV9KrfAzQjWpJ");
    
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new anchor.Program(idl as anchor.Idl, provider);

    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        programId
    );

    console.log("Config PDA:", configPda.toBase58());
    try {
        const accountInfo = await connection.getAccountInfo(configPda);
        if (!accountInfo) {
            throw new Error("PlatformConfig account not found");
        }
        let data = accountInfo.data;
        const expectedLen = 162;
        if (data.length < expectedLen) {
            const padded = Buffer.alloc(expectedLen);
            data.copy(padded);
            data = padded;
        }
        const configAccount: any = program.coder.accounts.decode("platformConfig", data);
        console.log("On-chain Platform Config:");
        console.log("  admin:", configAccount.admin.toBase58());
        console.log("  treasury:", configAccount.treasury.toBase58());
        console.log("  keeper:", configAccount.keeper.toBase58());
        console.log("  platformFeeBps:", configAccount.platformFeeBps);
        console.log("  paused:", configAccount.paused);
    } catch (err: any) {
        console.error("Error fetching config:", err.message);
    }
}

main().catch(console.error);
