const fs = require('fs');

const files = [
  '/Users/adam/Documents/shitmarket/program/target/idl/shitmarket.json',
  '/Users/adam/Documents/shitmarket/program/target/types/shitmarket.json',
  '/Users/adam/Documents/shitmarket/indexer/src/utils/idl.json',
  '/Users/adam/Documents/shitmarket/src/utils/idl.json',
  '/Users/adam/Documents/shitmarket/src/utils/shitmarket_idl.json'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`Processing file: ${file}`);
    let content = fs.readFileSync(file, 'utf8');
    let json = JSON.parse(content);
    
    const settleRoomInst = json.instructions.find(inst => inst.name === 'settleRoom');
    if (settleRoomInst) {
      const treasuryAcc = settleRoomInst.accounts.find(acc => acc.name === 'treasury');
      if (treasuryAcc) {
        console.log(`  Renaming account 'treasury' to 'vault' in settleRoom`);
        treasuryAcc.name = 'vault';
      }
    }
    
    fs.writeFileSync(file, JSON.stringify(json, null, 2), 'utf8');
    console.log(`  Saved successfully.`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
