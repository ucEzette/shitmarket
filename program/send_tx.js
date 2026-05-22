const web3 = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  const connection = new web3.Connection('https://api.devnet.solana.com', 'confirmed');
  const secretKeyString = fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8');
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const keypair = web3.Keypair.fromSecretKey(secretKey);
  
  const txs = [
    "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAEBh4dUT8puwUH+uEUaW/d/dn97EWSUJy77K8dnHJyR9AKKmHjL6YyocxjJInvPzkLneWbkRRLLcavBCYqAdz+aJ+hZM2XiSYaR2/Vxio4iDsZlSUtRXr6KJCt9NC2FoIrVwMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAA7SdYrVSTNFncy/8bJwewfU8smaz41vkXYB1B9IDDSloF2xeewz6T+UvDIVcH5PsEdD7Jr6hKG6BvaHaL9mU4iaasv0ZzxjlGCdWhWfrtS+TpXJC11W8P8X2tYg2uyNKJAgMACQOghgEAAAAAAAUFAQAEAgABBgA="
  ];

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
