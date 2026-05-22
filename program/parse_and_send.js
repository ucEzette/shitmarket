const web3 = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
  const secretKeyString = fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8');
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = web3.Keypair.fromSecretKey(secretKey);
  
  const logContent = fs.readFileSync('tx.log', 'utf8');
  // Find all [Transaction #N] blocks and extract the base64 string following it
  const regex = /\[Transaction #\d+\]\n([A-Za-z0-9+/=]+)/g;
  const txs = [];
  let match;
  while ((match = regex.exec(logContent)) !== null) {
    txs.push(match[1]);
  }

  if (txs.length === 0) {
    console.error("No transactions found in tx.log");
    return;
  }

  console.log(`Found ${txs.length} transactions to send.`);

  for (let i = 0; i < txs.length; i++) {
    const txBuffer = Buffer.from(txs[i], 'base64');
    const tx = web3.VersionedTransaction.deserialize(txBuffer);
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    tx.message.recentBlockhash = blockhash;
    tx.sign([keypair]);
    
    console.log(`Sending transaction ${i+1}/${txs.length}...`);
    try {
      const signature = await connection.sendTransaction(tx, { maxRetries: 5 });
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`Success: ${signature}`);
    } catch (e) {
      console.error(`Failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
