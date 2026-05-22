const anchor = require('@coral-xyz/anchor');
const idl = require('./src/utils/idl.json');
const patchedIdl = JSON.parse(JSON.stringify(idl));
patchedIdl.types = patchedIdl.types || [];
patchedIdl.accounts.forEach(acc => {
  const camelName = acc.name.charAt(0).toLowerCase() + acc.name.slice(1);
  if (acc.type) {
    patchedIdl.types.push({ name: camelName, type: acc.type });
  }
  acc.name = camelName;
});
try {
  const prog = new anchor.Program(patchedIdl, new anchor.web3.PublicKey(idl.address), {});
  console.log("Success! Accounts:", Object.keys(prog.account));
} catch (e) {
  console.log("Error:", e.message);
}
