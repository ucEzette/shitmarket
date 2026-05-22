const fs = require('fs');

const idlPath = '../src/utils/idl.json';
const targetDir = 'target/idl';
const targetPath = `${targetDir}/shitmarket.json`;

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Patch the initialize instruction
const initInstr = idl.instructions.find(i => i.name === 'initialize');
if (initInstr) {
    initInstr.args = [{ name: 'platformFeeBps', type: 'u16' }];
}

fs.writeFileSync(targetPath, JSON.stringify(idl, null, 2));
console.log('IDL patched and saved to', targetPath);
