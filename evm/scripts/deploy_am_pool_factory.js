const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const pk = "0xc8fd10b0ee69676024fb28db95374116bdeab78dbfbf439667e679b7b335ae71";
  const provider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
  const wallet = new ethers.Wallet(pk, provider);
  console.log("Deployer:", wallet.address);

  const artifactPath = path.join(__dirname, "../artifacts/contracts/AMPoolFactory.sol/AMPoolFactory.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying AMPoolFactory with manual gas limit...");
  const contract = await factory.deploy({ gasLimit: 2500000 });
  console.log("Tx hash:", contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("SUCCESS! NEW_AM_POOL_FACTORY_ADDRESS:", address);
}

main().catch(console.error);
