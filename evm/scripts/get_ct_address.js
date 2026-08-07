const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167";
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const factory = MarketFactory.attach(factoryAddress);
  const ctAddress = await factory.conditionalTokens();
  console.log("Deployed ConditionalTokens Address:", ctAddress);
}

main().catch(console.error);
