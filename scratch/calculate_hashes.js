const { keccak256, toBytes, stringToBytes } = require("viem");

const signatures = [
  "MarketCreated(uint256,bytes32,address,string,uint256,address,uint256)",
  "MarketResolved(uint256,uint256)",
  "PoolCreated(bytes32,address,address,uint256)",
  "Swap(address,uint8,uint256,uint256,uint256,uint256)",
  "OutcomeReported(uint256,address,uint256)",
  "OutcomeChallenged(uint256,address,uint256,uint256)",
  "DisputeSettled(uint256,uint256,bool)"
];

for (const sig of signatures) {
  const hash = keccak256(Buffer.from(sig));
  console.log(`${sig.split("(")[0]}: "${hash}",`);
}
