const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", hre.network.name);

  let usdcAddress = process.env.USDC_TOKEN_ADDRESS;

  if (!usdcAddress || hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // 1. Deploy Mock USDC for testing
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", usdcAddress);
  } else {
    console.log("Using existing USDC Token at:", usdcAddress);
  }

  // 2. Deploy ShitMarketCore
  const ShitMarketCore = await hre.ethers.getContractFactory("ShitMarketCore");
  const platformFeeBps = 200; // 2%
  const shitMarketCore = await ShitMarketCore.deploy(
    usdcAddress,
    deployer.address, // Deployer acts as treasury
    platformFeeBps
  );
  await shitMarketCore.waitForDeployment();
  const shitMarketCoreAddress = await shitMarketCore.getAddress();
  console.log("ShitMarketCore deployed to:", shitMarketCoreAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
