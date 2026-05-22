const fs = require('fs');

const idlPath = 'target/idl/shitmarket.json';
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

function downgradeDefined(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(downgradeDefined);
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      if (key === 'defined' && typeof obj[key] === 'object' && obj[key].name) {
        obj[key] = obj[key].name;
      } else {
        downgradeDefined(obj[key]);
      }
    }
  }
}

downgradeDefined(idl);

// Anchor 0.29 also didn't have `metadata` at the root, but leaving it is fine.
// Ensure root arrays
if (!idl.events) idl.events = [];
if (!idl.errors) idl.errors = [];
if (!idl.constants) idl.constants = [];

fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log('IDL completely downgraded to 0.29 strict format');
