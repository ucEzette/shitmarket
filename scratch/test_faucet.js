const { createPublicClient, createWalletClient, http, parseEther, parseUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const rpcUrl = process.env.AVALANCHE_RPC_URL || 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2';
const relayerKey = process.env.EVM_RELAYER_PRIVATE_KEY || '0xc8fd10b0ee69676024fb28db95374116bdeab78dbfbf439667e679b7b335ae71';

async function testFaucet() {
  const account = privateKeyToAccount(relayerKey);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

  const targetAddress = '0xc0218f5894591b7b08ea186da3ad2a5e69e40b67';
  const amountUSDC = parseUnits('1000', 6);

  console.log("Testing writeContract WITH explicit gas...");
  const tx = await walletClient.writeContract({
    address: usdcAddress,
    abi: [{
      type: 'function',
      name: 'mint',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [],
      stateMutability: 'nonpayable'
    }],
    functionName: 'mint',
    args: [targetAddress, amountUSDC],
    gas: BigInt(200000)
  });
  console.log("Tx sent:", tx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("Tx Receipt status:", receipt.status, "Gas Used:", receipt.gasUsed.toString());
}

testFaucet();
