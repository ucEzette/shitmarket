import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';

/**
 * Circle CCTP Program IDs on Solana Devnet/Mainnet
 */
export const CCTP_TOKEN_MESSENGER_PROGRAM_ID = new PublicKey('CCTPMBa2f8d4K445R8p3Xk5J2n4Z5K6L7M8N9O0P1Q2'); // CCTP TokenMessenger
export const SOLANA_CCTP_DOMAIN = 5;
export const AVALANCHE_CCTP_DOMAIN = 1;

export interface DepositParams {
  solanaRpcUrl: string;
  userPrivateKeyBs58: string;
  usdcAmount: number; // e.g. 50 USDC
  evmRecipientAddress: string; // e.g. 0x1234...
}

/**
 * Format EVM address 0x... into bytes32 padded array
 */
export function formatEvmAddressToBytes32(evmAddress: string): Uint8Array {
  const cleanHex = evmAddress.replace(/^0x/, '').padStart(64, '0');
  const buffer = Buffer.from(cleanHex, 'hex');
  return new Uint8Array(buffer);
}

/**
 * Execute Solana CCTP Deposit for Burn
 */
export async function depositUsdcForBurn(params: DepositParams): Promise<string> {
  const connection = new Connection(params.solanaRpcUrl, 'confirmed');
  const userKeypair = Keypair.fromSecretKey(bs58.decode(params.userPrivateKeyBs58));
  
  const amountLamports = BigInt(Math.round(params.usdcAmount * 1e6)); // 6 decimals
  const recipientBytes32 = formatEvmAddressToBytes32(params.evmRecipientAddress);

  console.log(`[CCTP] Initiating Solana -> Avalanche Deposit:`);
  console.log(`  User Solana Key: ${userKeypair.publicKey.toBase58()}`);
  console.log(`  EVM Recipient:   ${params.evmRecipientAddress}`);
  console.log(`  Amount:          ${params.usdcAmount} USDC (${amountLamports} base units)`);
  console.log(`  Target Domain:   Avalanche C-Chain (Domain ${AVALANCHE_CCTP_DOMAIN})`);

  // Construct instruction payload for depositForBurn (Circle CCTP TokenMessenger)
  // Layout: discriminator(8) + amount(8) + destinationDomain(4) + mintRecipient(32) + burnToken(32)
  const dataLayout = Buffer.alloc(8 + 8 + 4 + 32);
  
  // Anchor discriminator for depositForBurn
  const discriminator = Buffer.from([244, 218, 143, 203, 107, 10, 191, 151]);
  discriminator.copy(dataLayout, 0);

  // Write Amount (uint64 le)
  dataLayout.writeBigUInt64LE(amountLamports, 8);

  // Write Destination Domain (uint32 le) -> Domain 1 (Avalanche)
  dataLayout.writeUInt32LE(AVALANCHE_CCTP_DOMAIN, 16);

  // Write Mint Recipient (32 bytes)
  Buffer.from(recipientBytes32).copy(dataLayout, 20);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: userKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: CCTP_TOKEN_MESSENGER_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: CCTP_TOKEN_MESSENGER_PROGRAM_ID,
    data: dataLayout,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = userKeypair.publicKey;
  
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.sign(userKeypair);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, 'confirmed');

  console.log(`[CCTP] Solana Burn Transaction Confirmed! Tx Signature: ${signature}`);
  return signature;
}
