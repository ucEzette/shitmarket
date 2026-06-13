const { PublicKey } = require('@solana/web3.js');

const mint = "9HjnCvPRqou82V4gpMnMUjcKR1xTGHpVNqtN2jSwhMgT";
try {
  const pubkey = new PublicKey(mint);
  const buffer = pubkey.toBuffer();
  console.log("Buffer length:", buffer.length);
  console.log("Buffer hex:", buffer.toString('hex'));
  
  let evmCheck = true;
  for (let i = 20; i < 32; i++) {
    if (buffer[i] !== 0) {
      evmCheck = false;
    }
  }
  console.log("Is EVM check passed?:", evmCheck);
  const derivedAddress = '0x' + buffer.slice(0, 20).toString('hex');
  console.log("Derived EVM Address:", derivedAddress);
} catch (e) {
  console.error("Error:", e);
}
