const fs = require('fs');

let tests = fs.readFileSync('indexer/tests/integration.test.ts', 'utf8');
tests = tests.replace(/toBe\(125\)/g, 'toBe(200)'); // Revert all to 200
tests = tests.replace(/expect\(configAccount\.platformFeeBps\)\.toBe\(200\)/g, 'expect(configAccount.platformFeeBps).toBe(125)'); // Set only fee to 125
fs.writeFileSync('indexer/tests/integration.test.ts', tests);

console.log("Reverted HTTP status codes and properly set fee assertions");
