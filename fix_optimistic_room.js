const fs = require('fs');
let storeTsx = fs.readFileSync('src/store/useAppState.ts', 'utf8');

storeTsx = storeTsx.replace(
  "      console.log(\"Room created successfully on-chain! Tx:\", tx);\n      \n      // Force refreshing the rooms list in the background\n      await get().fetchRooms();",
  "      console.log(\"Room created successfully on-chain! Tx:\", tx);\n      \n      // Optimistically inject the new room into local state to prevent 'TRENCH RUGGED' 404s before indexer syncs\n      const optimisticRoom = { ...room, id: roomPda.toBase58() };\n      set((state) => ({ rooms: [optimisticRoom, ...state.rooms] }));\n      \n      // Force refreshing the rooms list in the background\n      get().fetchRooms();"
);

fs.writeFileSync('src/store/useAppState.ts', storeTsx);
console.log("Added optimistic room injection.");
