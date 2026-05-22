const anchor = require('@coral-xyz/anchor');
const idl = require('./src/utils/idl.json');
const coder = new anchor.BorshInstructionCoder(idl);
try {
  const ix = coder.encode('createRoom', {
    tokenMint: new anchor.web3.PublicKey("7GCihgDB8fe6KNjn2MYtkzNc8oV1VfF7L4y3L5gF7VxL"),
    tokenName: "Test",
    durationMinutes: 15,
    switchboardFeed: null
  });
  console.log("Success encoding createRoom");
} catch(e) {
  console.log("Error encoding:", e.message);
}
