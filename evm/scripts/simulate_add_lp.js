const { ethers } = require("hardhat");

async function main() {
  const poolAddress = "0xDB17048529A0A44483D5750551CFC010DBFF9608";
  const userAddress = "0xC0218F5894591B7B08EA186DA3AD2A5E69E40B67";
  
  const AMPool = await ethers.getContractFactory("AMPool");
  const pool = AMPool.attach(poolAddress);
  
  const usdcAddress = await pool.usdcToken();
  const ctAddress = await pool.conditionalTokens();
  const condId = await pool.conditionId();
  
  console.log("Pool details:");
  console.log("- USDC token:", usdcAddress);
  console.log("- ConditionalTokens:", ctAddress);
  console.log("- Condition ID:", condId);
  
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(usdcAddress);
  
  const userBalance = await usdc.balanceOf(userAddress);
  const userAllowance = await usdc.allowance(userAddress, poolAddress);
  
  console.log("\nUser stats:");
  console.log("- USDC Balance:", ethers.formatUnits(userBalance, 6));
  console.log("- Pool Allowance:", ethers.formatUnits(userAllowance, 6));
  
  // Encode function call addLiquidity(200 USDC)
  const data = pool.interface.encodeFunctionData("addLiquidity", [ethers.parseUnits("200", 6)]);
  
  console.log("\nSimulating addLiquidity(200.00 USDC) via direct eth_call from User...");
  try {
    const rawResult = await ethers.provider.call({
      to: poolAddress,
      from: userAddress,
      data: data
    });
    
    // Decode result
    const decoded = pool.interface.decodeFunctionResult("addLiquidity", rawResult);
    console.log("Simulation succeeded! Returned LP Mint Amount:", ethers.formatUnits(decoded[0], 18));
  } catch (err) {
    console.error("Simulation failed!");
    console.error(err);
  }
}

main().catch(console.error);
