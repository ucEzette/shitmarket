const { PublicKey } = require('@solana/web3.js');
let mint = "0x11ed3B12D99D508F926c870Fb44F472001842c96";
let hex = mint.replace('0x', '');
if (hex.length % 2 !== 0) hex = '0' + hex;
const buffer = Buffer.alloc(32);
Buffer.from(hex, 'hex').copy(buffer, 0);
let pubkeyStr = new PublicKey(buffer).toBase58();
console.log("Derived Base58:", pubkeyStr);
