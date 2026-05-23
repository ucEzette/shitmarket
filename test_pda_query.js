const { Connection, PublicKey } = require('@solana/web3.js');
const idlJson = require('./src/utils/idl.json');

const PROGRAM_ID = new PublicKey(idlJson.address);
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

const getPlatformConfigPda = () => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );
  return pda;
};

async function main() {
  const configPda = getPlatformConfigPda();
  console.log("Derived PlatformConfig PDA:", configPda.toBase58());
  const info = await connection.getAccountInfo(configPda);
  console.log("Account Info:", info);
}

main().catch(console.error);

