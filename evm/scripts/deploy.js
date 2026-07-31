const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying prediction market contracts with the account:", deployer.address);
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

  // 2. Deploy OracleRegistry
  console.log("Deploying OracleRegistry...");
  const OracleRegistry = await hre.ethers.getContractFactory("OracleRegistry");
  const oracleRegistry = await OracleRegistry.deploy(usdcAddress);
  await oracleRegistry.waitForDeployment();
  const oracleRegistryAddress = await oracleRegistry.getAddress();
  console.log("OracleRegistry deployed to:", oracleRegistryAddress);

  // 3. Deploy MarketFactory (deploys ConditionalTokens internally)
  console.log("Deploying MarketFactory...");
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactory.deploy(usdcAddress, deployer.address);
  await marketFactory.waitForDeployment();
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log("MarketFactory deployed to:", marketFactoryAddress);

  const conditionalTokensAddress = await marketFactory.conditionalTokens();
  console.log("ConditionalTokens deployed internally to:", conditionalTokensAddress);

  // 4. Deploy AMPoolFactory
  console.log("Deploying AMPoolFactory...");
  const AMPoolFactory = await hre.ethers.getContractFactory("AMPoolFactory");
  const amPoolFactory = await AMPoolFactory.deploy();
  await amPoolFactory.waitForDeployment();
  const amPoolFactoryAddress = await amPoolFactory.getAddress();
  console.log("AMPoolFactory deployed to:", amPoolFactoryAddress);

  // 5. Deploy PredictionRouter
  console.log("Deploying PredictionRouter...");
  const PredictionRouter = await hre.ethers.getContractFactory("PredictionRouter");
  const predictionRouter = await PredictionRouter.deploy(usdcAddress);
  await predictionRouter.waitForDeployment();
  const predictionRouterAddress = await predictionRouter.getAddress();
  console.log("PredictionRouter deployed to:", predictionRouterAddress);

  console.log("\n--- Deployment Completed ---");
  console.log("MockUSDC:", usdcAddress);
  console.log("OracleRegistry:", oracleRegistryAddress);
  console.log("MarketFactory:", marketFactoryAddress);
  console.log("ConditionalTokens:", conditionalTokensAddress);
  console.log("AMPoolFactory:", amPoolFactoryAddress);
  console.log("PredictionRouter:", predictionRouterAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
