const fs = require('fs');

// 1. Enforce seeding in create-room/page.tsx
let pageTsx = fs.readFileSync('src/app/create-room/page.tsx', 'utf8');
pageTsx = pageTsx.replace(
  "    if (seedSide !== 'none' && user) {",
  "    if (seedSide === 'none' || seedAmount <= 0) {\n      alert('YOU MUST SEED THE ARENA (MOON OR JEET) TO CREATE A ROOM!');\n      return;\n    }\n\n    if (user) {"
);
fs.writeFileSync('src/app/create-room/page.tsx', pageTsx);

// 2. Allow concurrent active rooms in useAppState.ts by removing alreadyExists logic
let storeTsx = fs.readFileSync('src/store/useAppState.ts', 'utf8');
storeTsx = storeTsx.replace(
  "          if (!isExpired && roomData.status.active !== undefined) {\n            // There is still a valid active room running for this token. Block duplicate creation.\n            roomPda = currentPda;\n            chosenNonce = n;\n            alreadyExists = true;\n            break;\n          }",
  "          if (!isExpired && roomData.status.active !== undefined) {\n            // Previously we blocked duplicate creation here. Now we let it continue to find the next clean nonce!\n            continue;\n          }"
);
fs.writeFileSync('src/store/useAppState.ts', storeTsx);

console.log("Fixed seeding requirements and concurrent room creation limits.");
