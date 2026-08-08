const { ethers } = require("ethers");

async function main() {
  const rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const addresses = {
    USDC: "0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2",
    ORACLE_REGISTRY: "0xD9Ea73D3c157528A133Bc610E02A6C972a62095F",
    MARKET_FACTORY: "0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167",
    CONDITIONAL_TOKENS: "0x3DBa9D7EF6B71610149daeF07bd8fcc6f5297A2A",
    AM_POOL_FACTORY: "0x8634a6e6346Ba056c6Bd11DeB00C99f68Aa0DE5d",
    PREDICTION_ROUTER: "0x8059fDbeC0521F2b6bdCA1F99D5f978Aa9958524",
    CORE_CONTRACT: "0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6"
  };

  console.log("=== CHECKING ON-CHAIN CONTRACT STATES ON AVALANCHE FUJI ===");

  for (const [name, addr] of Object.entries(addresses)) {
    const code = await provider.getCode(addr);
    const isDeployed = code && code !== "0x" && code.length > 2;
    console.log(`\n${name} (${addr}): Deployed = ${isDeployed} (Bytecode size = ${code ? code.length / 2 : 0} bytes)`);
  }

  // Check MarketFactory specifics
  const mfAbi = [
    "function creationFee() view returns (uint256)",
    "function owner() view returns (address)",
    "function treasury() view returns (address)",
    "function conditionalTokens() view returns (address)",
    "function marketCount() view returns (uint256)"
  ];
  try {
    const mf = new ethers.Contract(addresses.MARKET_FACTORY, mfAbi, provider);
    const fee = await mf.creationFee();
    const owner = await mf.owner();
    const treasury = await mf.treasury();
    const ct = await mf.conditionalTokens();
    const count = await mf.marketCount();
    console.log("\n[MarketFactory Details]");
    console.log("- Creation Fee:", ethers.formatUnits(fee, 6), "USDC (raw:", fee.toString(), ")");
    console.log("- Owner:", owner);
    console.log("- Treasury:", treasury);
    console.log("- Conditional Tokens:", ct);
    console.log("- Total Markets Created:", count.toString());
  } catch (e) {
    console.warn("Error querying MarketFactory:", e.message);
  }

  // Check Core specifics
  const coreAbi = [
    "function platformTreasury() view returns (address)",
    "function totalPlatformFeesAccrued() view returns (uint256)",
    "function roomCounter() view returns (uint256)"
  ];
  try {
    const core = new ethers.Contract(addresses.CORE_CONTRACT, coreAbi, provider);
    const pt = await core.platformTreasury();
    const rc = await core.roomCounter();
    console.log("\n[ShitMarketCore Details]");
    console.log("- Platform Treasury:", pt);
    console.log("- Total Rooms Counter:", rc.toString());
  } catch (e) {
    console.warn("Error querying ShitMarketCore:", e.message);
  }
}

main().catch(console.error);
