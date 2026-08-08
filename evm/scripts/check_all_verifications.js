const axios = require("axios");

async function checkVerification(address, name) {
  const url = `https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api?module=contract&action=getsourcecode&address=${address}`;
  try {
    const res = await axios.get(url);
    const data = res.data;
    if (data.status === "1" && data.result && data.result[0] && data.result[0].SourceCode && data.result[0].SourceCode.length > 0) {
      console.log(`[VERIFIED] ${name} (${address}) - Contract Name: ${data.result[0].ContractName}`);
      return true;
    } else {
      console.log(`[NOT VERIFIED] ${name} (${address})`);
      return false;
    }
  } catch (e) {
    console.warn(`Error checking ${name}:`, e.message);
    return false;
  }
}

async function main() {
  const contracts = [
    { name: "MockUSDC", address: "0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2" },
    { name: "OracleRegistry", address: "0xD9Ea73D3c157528A133Bc610E02A6C972a62095F" },
    { name: "MarketFactory", address: "0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167" },
    { name: "ConditionalTokens", address: "0x3DBa9D7EF6B71610149daeF07bd8fcc6f5297A2A" },
    { name: "AMPoolFactory", address: "0x8634a6e6346Ba056c6Bd11DeB00C99f68Aa0DE5d" },
    { name: "PredictionRouter", address: "0x8059fDbeC0521F2b6bdCA1F99D5f978Aa9958524" },
    { name: "ShitMarketCore", address: "0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6" }
  ];

  for (const c of contracts) {
    await checkVerification(c.address, c.name);
  }
}

main().catch(console.error);
