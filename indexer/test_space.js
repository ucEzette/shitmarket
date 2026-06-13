let mint = "0x11ed3B12D99D508F926c870Fb44F472001842c96 ";
let hex = mint.replace('0x', '');
if (hex.length % 2 !== 0) hex = '0' + hex;
console.log(Buffer.from(hex, 'hex').toString('hex'));
