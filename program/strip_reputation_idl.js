const fs = require('fs');
const path = require('path');

const idlPaths = [
  path.join(__dirname, '../src/utils/idl.json'),
  path.join(__dirname, 'target/idl/shitmarket.json')
];

idlPaths.forEach(idlPath => {
  if (!fs.existsSync(idlPath)) {
    console.log('Skipping (not found):', idlPath);
    return;
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

  // 1. Remove 'reputation' account from placeBet instruction accounts
  if (idl.instructions) {
    idl.instructions = idl.instructions.filter(instr => {
      // Remove initializeReputation and updateReputation instructions entirely
      return instr.name !== 'initializeReputation' && instr.name !== 'updateReputation';
    });

    // Remove 'reputation' account from placeBet instruction
    const placeBet = idl.instructions.find(i => i.name === 'placeBet');
    if (placeBet && placeBet.accounts) {
      placeBet.accounts = placeBet.accounts.filter(a => a.name !== 'reputation');
    }
  }

  // 2. Remove 'reputation' from accounts array
  if (idl.accounts) {
    idl.accounts = idl.accounts.filter(a => a.name !== 'reputation');
  }

  // 3. Remove reputation-related types (reputation struct, ReputationTier enum)
  if (idl.types) {
    idl.types = idl.types.filter(t => 
      t.name !== 'reputation' && t.name !== 'ReputationTier'
    );
  }

  // 4. Remove reputation-related events (ReputationUpdated)
  if (idl.events) {
    idl.events = idl.events.filter(e => e.name !== 'ReputationUpdated');
  }

  // 5. Remove reputation-related error codes (BetAmountExceedsLimit, ReputationAlreadyInitialized)
  if (idl.errors) {
    idl.errors = idl.errors.filter(e => 
      e.name !== 'BetAmountExceedsLimit' && e.name !== 'ReputationAlreadyInitialized'
    );
  }

  fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
  console.log('Stripped reputation from:', idlPath);
});

console.log('Done! All reputation artifacts removed from IDL.');
