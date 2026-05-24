const fs = require('fs');
const path = require('path');

let libRs = fs.readFileSync('program/programs/shitmarket/src/lib.rs', 'utf8');
libRs = libRs.replace(/200 = 2%/g, '125 = 1.25%');
fs.writeFileSync('program/programs/shitmarket/src/lib.rs', libRs);

let priceRs = fs.readFileSync('program/programs/shitmarket/src/price.rs', 'utf8');
priceRs = priceRs.replace(/calc_platform_fee\(2_000_000_000, 200\)/g, 'calc_platform_fee(2_000_000_000, 125)');
priceRs = priceRs.replace(/2% of 2 SOL = 0.04 SOL/g, '1.25% of 2 SOL = 0.025 SOL');
priceRs = priceRs.replace(/assert_eq!\(fee, 40_000_000\)/g, 'assert_eq!(fee, 25_000_000)');
fs.writeFileSync('program/programs/shitmarket/src/price.rs', priceRs);

let tests = fs.readFileSync('program/tests/shitmarket.ts', 'utf8');
tests = tests.replace(/\.initialize\(200\)/g, '.initialize(125)');
tests = tests.replace(/200 bps = 2%/g, '125 bps = 1.25%');
tests = tests.replace(/assert.equal\(config.platformFeeBps, 200\)/g, 'assert.equal(config.platformFeeBps, 125)');
tests = tests.replace(/\.updateConfig\(200/g, '.updateConfig(125');
tests = tests.replace(/fee = 2% = 0.03 SOL = 30_000_000 lamports/g, 'fee = 1.25% = 0.01875 SOL = 18_750_000 lamports');
tests = tests.replace(/feeReceived, 29_000_000/g, 'feeReceived, 18_000_000');
tests = tests.replace(/~2% fee/g, '~1.25% fee');
tests = tests.replace(/fee back to 2%/g, 'fee back to 1.25%');
fs.writeFileSync('program/tests/shitmarket.ts', tests);

console.log("Updated rust and tests");
