const hre = require("hardhat");

/**
 * Script to deploy TimelockController (24-hour delay) and transfer ownership of ShitMarketCore.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address);

  const coreAddress = process.env.CORE_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CORE_CONTRACT_ADDRESS;
  if (!coreAddress) {
    throw new Error("Missing CORE_CONTRACT_ADDRESS in environment");
  }

  console.log("Target Core Contract Address:", coreAddress);

  // 1. Configure Timelock parameters (24 hour delay = 86400 seconds)
  const minDelaySeconds = 86400; // 24 hours
  const proposers = [deployer.address]; // Multi-sig signers or admin council
  const executors = [deployer.address]; // Anyone or automated relayer
  const admin = deployer.address;

  console.log(`[1/3] Deploying TimelockController (24h delay: ${minDelaySeconds}s)...`);
  const TimelockController = await hre.ethers.getContractFactory("TimelockController");
  
  // Note: OpenZeppelin TimelockController constructor: (minDelay, proposers, executors, admin)
  const timelock = await TimelockController.deploy(
    minDelaySeconds,
    proposers,
    executors,
    admin
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("TimelockController deployed at:", timelockAddress);

  // 2. Attach to ShitMarketCore
  const ShitMarketCore = await hre.ethers.getContractFactory("ShitMarketCore");
  const coreContract = ShitMarketCore.attach(coreAddress);

  console.log(`[2/3] Transferring ShitMarketCore ownership to TimelockController (${timelockAddress})...`);
  const tx = await coreContract.transferOwnership(timelockAddress);
  await tx.wait();

  console.log("[3/3] Ownership transfer complete!");
  console.log(`ShitMarketCore (${coreAddress}) is now governed by TimelockController (${timelockAddress}) with a 24-hour delay on admin calls.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
