const { ethers } = require("ethers");

async function main() {
  const pk = "0xc8fd10b0ee69676024fb28db95374116bdeab78dbfbf439667e679b7b335ae71";
  const provider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
  const wallet = new ethers.Wallet(pk, provider);
  const factoryAddress = "0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167";

  const mfAbi = [
    "function setCreationFee(uint256 _fee) external",
    "function creationFee() view returns (uint256)",
    "function owner() view returns (address)"
  ];

  const mf = new ethers.Contract(factoryAddress, mfAbi, wallet);
  console.log("Current creation fee:", (await mf.creationFee()).toString());
  console.log("Updating creation fee to 3 USDC (3,000,000)...");
  
  const tx = await mf.setCreationFee(3000000, { gasLimit: 100000 });
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  
  const newFee = await mf.creationFee();
  console.log("SUCCESS! Updated on-chain creation fee to:", newFee.toString(), "(3 USDC)");
}

main().catch(console.error);
