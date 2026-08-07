const { ethers } = require("hardhat");

async function main() {
  const poolAddress = "0xDB17048529A0A44483D5750551CFC010DBFF9608";
  const userAddress = "0xC0218F5894591B7B08EA186DA3AD2A5E69E40B67";
  
  const AMPool = await ethers.getContractFactory("AMPool");
  const pool = AMPool.attach(poolAddress);
  
  const condId = await pool.conditionId();
  const ctAddress = await pool.conditionalTokens();
  
  const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
  const ct = ConditionalTokens.attach(ctAddress);
  
  const tokenId0 = await pool.getTokenId(0);
  const tokenId1 = await pool.getTokenId(1);
  
  const userBal0 = await ct.balanceOf(userAddress, tokenId0);
  const userBal1 = await ct.balanceOf(userAddress, tokenId1);
  const poolBal0 = await ct.balanceOf(poolAddress, tokenId0);
  const poolBal1 = await ct.balanceOf(poolAddress, tokenId1);
  
  console.log("Outcome Token Balances:");
  console.log(`- Token 0 (YES):`);
  console.log(`  * User: ${ethers.formatUnits(userBal0, 6)}`);
  console.log(`  * Pool: ${ethers.formatUnits(poolBal0, 6)}`);
  console.log(`- Token 1 (NO):`);
  console.log(`  * User: ${ethers.formatUnits(userBal1, 6)}`);
  console.log(`  * Pool: ${ethers.formatUnits(poolBal1, 6)}`);
  
  const isApproved = await ct.isApprovedForAll(userAddress, poolAddress);
  console.log(`\n- User Approved For All Pool: ${isApproved}`);
  
  // Try to simulate selling 5 YES tokens (5 * 1e6)
  const data = pool.interface.encodeFunctionData("sellShares", [0, ethers.parseUnits("5", 6)]);
  
  console.log("\nSimulating sellShares(5 YES) via eth_call from User...");
  try {
    const rawResult = await ethers.provider.call({
      to: poolAddress,
      from: userAddress,
      data: data
    });
    console.log("Simulation succeeded!");
  } catch (err) {
    console.error("Simulation failed!");
    console.error(err);
  }
}

main().catch(console.error);
