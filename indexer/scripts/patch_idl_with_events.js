const fs = require('fs');
const path = require('path');

const idlPath = path.resolve(__dirname, '../../src/utils/idl.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// 1. Define event types to append to idl.types
const eventTypes = [
  {
    "name": "RoomCreated",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "room", "type": "pubkey" },
        { "name": "creator", "type": "pubkey" },
        { "name": "tokenMint", "type": "pubkey" },
        { "name": "tokenName", "type": "string" },
        { "name": "priceFeed", "type": "pubkey" },
        { "name": "openingPrice", "type": "i64" },
        { "name": "durationMinutes", "type": "u8" },
        { "name": "expiryTimestamp", "type": "i64" }
      ]
    }
  },
  {
    "name": "BetPlaced",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "room", "type": "pubkey" },
        { "name": "user", "type": "pubkey" },
        { "name": "side", "type": "u8" },
        { "name": "amount", "type": "u64" },
        { "name": "moonPool", "type": "u64" },
        { "name": "jeetPool", "type": "u64" }
      ]
    }
  },
  {
    "name": "RoomSettled",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "room", "type": "pubkey" },
        { "name": "winner", "type": "u8" },
        { "name": "openingPrice", "type": "i64" },
        { "name": "finalPrice", "type": "i64" },
        { "name": "twapFinalPrice", "type": "i64" },
        { "name": "totalPool", "type": "u64" },
        { "name": "platformFee", "type": "u64" }
      ]
    }
  },
  {
    "name": "WinningsClaimed",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "room", "type": "pubkey" },
        { "name": "user", "type": "pubkey" },
        { "name": "amount", "type": "u64" }
      ]
    }
  },
  {
    "name": "PlatformPaused",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "paused", "type": "bool" }
      ]
    }
  },
  {
    "name": "ReputationUpdated",
    "type": {
      "kind": "struct",
      "fields": [
        { "name": "user", "type": "pubkey" },
        { "name": "tier", "type": "u8" },
        { "name": "totalBets", "type": "u64" },
        { "name": "totalWins", "type": "u64" }
      ]
    }
  }
];

// Append to types if they don't already exist
if (!idl.types) {
  idl.types = [];
}
eventTypes.forEach(et => {
  if (!idl.types.some(t => t.name === et.name)) {
    idl.types.push(et);
  }
});

// Patch updateConfig instruction args if it exists
const updateConfigInstr = idl.instructions.find(i => i.name === 'updateConfig');
if (updateConfigInstr) {
  updateConfigInstr.args = [
    {
      "name": "newFeeBps",
      "type": { "option": "u16" }
    },
    {
      "name": "newTreasury",
      "type": { "option": "pubkey" }
    },
    {
      "name": "newKeeper",
      "type": { "option": "pubkey" }
    },
    {
      "name": "newMinimumLiquidity",
      "type": { "option": "u64" }
    },
    {
      "name": "newTwapWindow",
      "type": { "option": "i64" }
    }
  ];
}

// 2. Define events array
idl.events = [
  {
    "name": "RoomCreated",
    "discriminator": [9, 177, 128, 166, 26, 19, 14, 243]
  },
  {
    "name": "BetPlaced",
    "discriminator": [88, 88, 145, 226, 126, 206, 32, 0]
  },
  {
    "name": "RoomSettled",
    "discriminator": [139, 64, 121, 102, 137, 174, 165, 105]
  },
  {
    "name": "WinningsClaimed",
    "discriminator": [187, 184, 29, 196, 54, 117, 70, 150]
  },
  {
    "name": "PlatformPaused",
    "discriminator": [110, 72, 152, 13, 0, 222, 149, 129]
  },
  {
    "name": "ReputationUpdated",
    "discriminator": [26, 36, 187, 150, 235, 90, 106, 89]
  }
];

fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
console.log('Successfully patched IDL in src/utils/idl.json with events and types.');
