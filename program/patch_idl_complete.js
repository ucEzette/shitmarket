const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const idlPaths = [
  path.join(__dirname, '../src/utils/idl.json'),
  path.join(__dirname, '../src/utils/shitmarket_idl.json'),
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
  },
  {
    name: "registerReferral",
    rustName: "register_referral",
    accounts: [
      { name: "userReferral", writable: true },
      { name: "user", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: [
      { name: "referrer", type: "pubkey" }
    ]
  },
  {
    name: "claimReferralRewards",
    rustName: "claim_referral_rewards",
    accounts: [
      { name: "referralState", writable: true },
      { name: "vault", writable: true },
      { name: "referrer", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: []
  },
  {
    name: "withdrawVaultFees",
    rustName: "withdraw_vault_fees",
    accounts: [
      { name: "config" },
      { name: "vault", writable: true },
      { name: "treasury", writable: true },
      { name: "admin", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: [
      { name: "amount", type: "u64" }
    ]
  },
  {
    name: "listPosition",
    rustName: "list_position",
    accounts: [
      { name: "room" },
      { name: "bet", writable: true },
      { name: "listing", writable: true },
      { name: "config" },
      { name: "seller", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: [
      { name: "price", type: "u64" }
    ]
  },
  {
    name: "cancelListing",
    rustName: "cancel_listing",
    accounts: [
      { name: "bet", writable: true },
      { name: "listing", writable: true },
      { name: "seller", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: []
  },
  {
    name: "buyPosition",
    rustName: "buy_position",
    accounts: [
      { name: "room" },
      { name: "bet", writable: true },
      { name: "listing", writable: true },
      { name: "seller", writable: true },
      { name: "vault", writable: true },
      { name: "config" },
      { name: "buyer", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: []
  },
  {
    name: "migrateBet",
    rustName: "migrate_bet",
    accounts: [
      { name: "bet", writable: true },
      { name: "room" },
      { name: "user", writable: true, signer: true },
      { name: "systemProgram" }
    ],
    args: [
      {
        name: "side",
        type: { defined: { name: "Side" } }
      }
    ]
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

// 3.7. Add UserReferral & ReferralState types
const userReferralType = {
  name: "UserReferral",
  type: {
    kind: "struct",
    fields: [
      { name: "user", type: "pubkey" },
      { name: "referrer", type: "pubkey" },
      { name: "bump", type: "u8" }
    ]
  }
};
const referralStateType = {
  name: "ReferralState",
  type: {
    kind: "struct",
    fields: [
      { name: "referrer", type: "pubkey" },
      { name: "unclaimedRewards", type: "u64" },
      { name: "claimedRewards", type: "u64" },
      { name: "bump", type: "u8" }
    ]
  }
};
[userReferralType, referralStateType].forEach(t => {
  const existingIdx = idl.types.findIndex(item => item.name === t.name);
  if (existingIdx >= 0) idl.types[existingIdx] = t;
  else idl.types.push(t);
});

// 3.8. Add UserReferral & ReferralState accounts
const userReferralAccount = {
  name: "userReferral",
  discriminator: getAccountDiscriminator("UserReferral")
};
const referralStateAccount = {
  name: "referralState",
  discriminator: getAccountDiscriminator("ReferralState")
};
[userReferralAccount, referralStateAccount].forEach(a => {
  const existingIdx = idl.accounts.findIndex(item => item.name === a.name);
  if (existingIdx >= 0) idl.accounts[existingIdx] = a;
  else idl.accounts.push(a);
});

// 3.9. Add Referral Event Types
const referralRegisteredType = {
  name: "ReferralRegistered",
  type: {
    kind: "struct",
    fields: [
      { name: "user", type: "pubkey" },
      { name: "referrer", type: "pubkey" }
    ]
  }
};
const referralRewardAccruedType = {
  name: "ReferralRewardAccrued",
  type: {
    kind: "struct",
    fields: [
      { name: "referrer", type: "pubkey" },
      { name: "invitee", type: "pubkey" },
      { name: "room", type: "pubkey" },
      { name: "rewardAmount", type: "u64" }
    ]
  }
};
const referralRewardsClaimedType = {
  name: "ReferralRewardsClaimed",
  type: {
    kind: "struct",
    fields: [
      { name: "referrer", type: "pubkey" },
      { name: "amount", type: "u64" }
    ]
  }
};
[referralRegisteredType, referralRewardAccruedType, referralRewardsClaimedType].forEach(t => {
  const existingIdx = idl.types.findIndex(item => item.name === t.name);
  if (existingIdx >= 0) idl.types[existingIdx] = t;
  else idl.types.push(t);
});

// 3.10. Add Referral Events
const referralRegisteredEvent = { name: "ReferralRegistered", discriminator: getEventDiscriminator("ReferralRegistered") };
const referralRewardAccruedEvent = { name: "ReferralRewardAccrued", discriminator: getEventDiscriminator("ReferralRewardAccrued") };
const referralRewardsClaimedEvent = { name: "ReferralRewardsClaimed", discriminator: getEventDiscriminator("ReferralRewardsClaimed") };
[referralRegisteredEvent, referralRewardAccruedEvent, referralRewardsClaimedEvent].forEach(e => {
  const existingIdx = idl.events.findIndex(item => item.name === e.name);
  if (existingIdx >= 0) idl.events[existingIdx] = e;
  else idl.events.push(e);
});

// 3.11. Add Listing Account Type and Listing Account definition
const listingType = {
  name: "Listing",
  type: {
    kind: "struct",
    fields: [
      { name: "room", type: "pubkey" },
      { name: "bet", type: "pubkey" },
      { name: "seller", type: "pubkey" },
      { name: "price", type: "u64" },
      { name: "bump", type: "u8" }
    ]
  }
};
const existingListingTypeIdx = idl.types.findIndex(t => t.name === listingType.name);
if (existingListingTypeIdx >= 0) {
  idl.types[existingListingTypeIdx] = listingType;
} else {
  idl.types.push(listingType);
}

const listingAccount = {
  name: "listing",
  discriminator: getAccountDiscriminator("Listing")
};
const existingListingAccountIdx = idl.accounts.findIndex(a => a.name === listingAccount.name);
if (existingListingAccountIdx >= 0) {
  idl.accounts[existingListingAccountIdx] = listingAccount;
} else {
  idl.accounts.push(listingAccount);
}

// 3.12. Add Secondary Market Event Types and Events
const positionListedType = {
  name: "PositionListed",
  type: {
    kind: "struct",
    fields: [
      { name: "room", type: "pubkey" },
      { name: "bet", type: "pubkey" },
      { name: "seller", type: "pubkey" },
      { name: "price", type: "u64" }
    ]
  }
};
const positionPurchasedType = {
  name: "PositionPurchased",
  type: {
    kind: "struct",
    fields: [
      { name: "room", type: "pubkey" },
      { name: "bet", type: "pubkey" },
      { name: "seller", type: "pubkey" },
      { name: "buyer", type: "pubkey" },
      { name: "price", type: "u64" }
    ]
  }
};
const listingCancelledType = {
  name: "ListingCancelled",
  type: {
    kind: "struct",
    fields: [
      { name: "room", type: "pubkey" },
      { name: "bet", type: "pubkey" },
      { name: "seller", type: "pubkey" }
    ]
  }
};
[positionListedType, positionPurchasedType, listingCancelledType].forEach(t => {
  const existingIdx = idl.types.findIndex(item => item.name === t.name);
  if (existingIdx >= 0) idl.types[existingIdx] = t;
  else idl.types.push(t);
});

const positionListedEvent = { name: "PositionListed", discriminator: getEventDiscriminator("PositionListed") };
const positionPurchasedEvent = { name: "PositionPurchased", discriminator: getEventDiscriminator("PositionPurchased") };
const listingCancelledEvent = { name: "ListingCancelled", discriminator: getEventDiscriminator("ListingCancelled") };
[positionListedEvent, positionPurchasedEvent, listingCancelledEvent].forEach(e => {
  const existingIdx = idl.events.findIndex(item => item.name === e.name);
  if (existingIdx >= 0) idl.events[existingIdx] = e;
  else idl.events.push(e);
});

// 3.13. Patch claimWinnings accounts to include originalBettor
const claimWinningsInstr = idl.instructions.find(i => i.name === 'claimWinnings');
if (claimWinningsInstr) {
  claimWinningsInstr.accounts = [
    { name: "room" },
    { name: "config" },
    { name: "escrow", writable: true },
    { name: "bet", writable: true },
    { name: "originalBettor" },
    { name: "user", writable: true },
    { name: "payer", writable: true, signer: true },
    { name: "systemProgram" }
  ];
}

// 3.14. Update Bet type to include currentOwner field
const betType = idl.types.find(t => t.name === "Bet" || t.name === "bet");
if (betType && betType.type && betType.type.fields) {
  const hasCurrentOwner = betType.type.fields.some(f => f.name === "currentOwner");
  if (!hasCurrentOwner) {
    // Insert currentOwner after user
    const userIdx = betType.type.fields.findIndex(f => f.name === "user");
    if (userIdx >= 0) {
      betType.type.fields.splice(userIdx + 1, 0, { name: "currentOwner", type: "pubkey" });
    } else {
      betType.type.fields.push({ name: "currentOwner", type: "pubkey" });
    }
  }
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
