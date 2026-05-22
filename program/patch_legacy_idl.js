const fs = require('fs');
const idlPath = 'target/idl/shitmarket.json';
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

if (!idl.events) idl.events = [];
if (!idl.constants) idl.constants = [];

fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log('IDL patched for missing arrays');
