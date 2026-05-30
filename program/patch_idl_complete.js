const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const idlPaths = [
  path.join(__dirname, '../src/utils/idl.json'),
  path.join(__dirname, '../indexer/src/utils/idl.json'),
  path.join(__dirname, 'target/idl/shitmarket.json')
];

function getInstructionDiscriminator(rustName) {
  const hash = crypto.createHash('sha256').update(`global:${rustName}`).digest();
  return Array.from(hash.subarray(0, 8));
}

function getAccountDiscriminator(rustTypeName) {
  const hash = crypto.createHash('sha256').update(`account:${rustTypeName}`).digest();
  return Array.from(hash.subarray(0, 8));
}

function getEventDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`event:${name}`).digest();
  return Array.from(hash.subarray(0, 8));
}

// Load the newly built IDL from target/idl/shitmarket.json as template
let idl;
const buildPath = idlPaths[1];
const fallbackPath = idlPaths[0];
if (fs.existsSync(buildPath)) {
  idl = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
} else if (fs.existsSync(fallbackPath)) {
  idl = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
} else {
  console.error("Template IDL not found");
  process.exit(1);
}

// 1. Add instructions if they do not exist
const newInstructions = [
  {
    name: "createLimitOrder",
    rustName: "create_limit_order",
    accounts: [
      { name: "limitOrder", writable: true },
      { name: "room" },
      { name: "user", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: [
      {
        name: "side",
        type: { defined: { name: "Side" } }
      },
      { name: "amount", type: "u64" },
      { name: "limitPrice", type: "i64" },
      { name: "triggerDirection", type: "u8" },
      { name: "nonce", type: "u8" },
      { name: "maxSlippageBps", type: "u16" }
    ]
  },
  {
    name: "executeLimitOrder",
    rustName: "execute_limit_order",
    accounts: [
      { name: "limitOrder", writable: true },
      { name: "room", writable: true },
      { name: "escrow", writable: true },
      { name: "bet", writable: true },
      { name: "priceFeed" },
      { name: "relayer", writable: true, signer: true },
      { name: "config" },
      { name: "user", writable: true },
      { name: "systemProgram" }
    ],
    args: []
  },
  {
    name: "cancelLimitOrder",
    rustName: "cancel_limit_order",
    accounts: [
      { name: "limitOrder", writable: true },
      { name: "room" },
      { name: "user", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: []
  }
];

newInstructions.forEach(instr => {
  const existingIndex = idl.instructions.findIndex(i => i.name === instr.name);
  const formatted = {
    name: instr.name,
    discriminator: getInstructionDiscriminator(instr.rustName),
    accounts: instr.accounts,
    args: instr.args
  };
  if (existingIndex >= 0) {
    idl.instructions[existingIndex] = formatted;
  } else {
    idl.instructions.push(formatted);
  }
});

// 2. Add struct to types array
const limitOrderType = {
  name: "limitOrder",
  type: {
    kind: "struct",
    fields: [
      { name: "user", type: "pubkey" },
      { name: "room", type: "pubkey" },
      { name: "side", type: { defined: { name: "Side" } } },
      { name: "amount", type: "u64" },
      { name: "limitPrice", type: "i64" },
      { name: "triggerDirection", type: "u8" },
      { name: "nonce", type: "u8" },
      { name: "status", type: "u8" },
      { name: "maxSlippageBps", type: "u16" },
      { name: "bump", type: "u8" }
    ]
  }
};

const existingTypeIndex = idl.types.findIndex(t => t.name === limitOrderType.name);
if (existingTypeIndex >= 0) {
  idl.types[existingTypeIndex] = limitOrderType;
} else {
  idl.types.push(limitOrderType);
}

// 3. Add to accounts array
const limitOrderAccount = {
  name: "limitOrder",
  discriminator: getAccountDiscriminator("LimitOrder")
};

const existingAccountIndex = idl.accounts.findIndex(a => a.name === limitOrderAccount.name);
if (existingAccountIndex >= 0) {
  idl.accounts[existingAccountIndex] = limitOrderAccount;
} else {
  idl.accounts.push(limitOrderAccount);
}

// 3.5. Add RoomActivated to types array
const roomActivatedType = {
  name: "RoomActivated",
  type: {
    kind: "struct",
    fields: [
      { name: "room", type: "pubkey" },
      { name: "openingPrice", type: "i64" },
      { name: "expiryTimestamp", type: "i64" }
    ]
  }
};
const existingRoomActivatedTypeIndex = idl.types.findIndex(t => t.name === roomActivatedType.name);
if (existingRoomActivatedTypeIndex >= 0) {
  idl.types[existingRoomActivatedTypeIndex] = roomActivatedType;
} else {
  idl.types.push(roomActivatedType);
}

// 3.6. Add RoomActivated to events array
if (!idl.events) {
  idl.events = [];
}
const roomActivatedEvent = {
  name: "RoomActivated",
  discriminator: getEventDiscriminator("RoomActivated")
};
const existingRoomActivatedEventIndex = idl.events.findIndex(e => e.name === roomActivatedEvent.name);
if (existingRoomActivatedEventIndex >= 0) {
  idl.events[existingRoomActivatedEventIndex] = roomActivatedEvent;
} else {
  idl.events.push(roomActivatedEvent);
}

// 4. Save patched IDL back to all destinations
idlPaths.forEach(p => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(idl, null, 2));
  console.log("Patched IDL successfully saved to", p);
});
