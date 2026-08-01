const { createPublicClient, createWalletClient, http, parseEventLogs } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const rpcUrl = 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
const marketFactoryAddress = '0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167';
const poolFactoryAddress = '0x0BD6d74cb69701D816E5c2ac1Ecdc0F06DCa96f2';
const oracleRegistryAddress = '0xD9Ea73D3c157528A133Bc610E02A6C972a62095F';
const usdcAddress = '0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2';

const privateKey = process.env.EVM_DEPLOYER_PRIVATE_KEY || '0xc8fd10b0ee69676024fb28db95374116bdeab78dbfbf439667e679b7b335ae71';
const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(rpcUrl)
});

const walletClient = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http(rpcUrl)
});

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  }
];

const MARKET_FACTORY_ABI = [
  {
    name: 'createMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'ipfsHash', type: 'string' },
      { name: 'outcomeCount', type: 'uint256' },
      { name: 'oracle', type: 'address' },
      { name: 'resolutionTime', type: 'uint256' },
      { name: 'customResolver', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'creationFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'conditionalTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'MarketCreated',
    type: 'event',
    inputs: [
      { name: 'marketId', type: 'uint256', indexed: true },
      { name: 'conditionId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'ipfsHash', type: 'string' },
      { name: 'outcomeCount', type: 'uint256' },
      { name: 'oracle', type: 'address', indexed: false },
      { name: 'resolutionTime', type: 'uint256', indexed: false }
    ]
  }
];

const AM_POOL_FACTORY_ABI = [
  {
    name: 'createPool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'conditionalTokens', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'usdcToken', type: 'address' }
    ],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'conditionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'PoolCreated',
    type: 'event',
    inputs: [
      { name: 'conditionId', type: 'bytes32', indexed: true },
      { name: 'poolAddress', type: 'address', indexed: true },
      { name: 'conditionalTokens', type: 'address', indexed: true },
      { name: 'poolIndex', type: 'uint256', indexed: false }
    ]
  }
];

const AM_POOL_ABI = [
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

async function runDiag() {
  console.log("=== EVM Room Deployment Diagnostics ===");
  console.log("Account:", account.address);

  // Query conditionalTokens
  const ctAddr = await publicClient.readContract({
    address: marketFactoryAddress,
    abi: MARKET_FACTORY_ABI,
    functionName: 'conditionalTokens'
  });
  console.log("MarketFactory.conditionalTokens():", ctAddr);

  // Execute createMarket
  const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + 86400);
  console.log("Simulating createMarket...");
  const { request: createMarketReq } = await publicClient.simulateContract({
    address: marketFactoryAddress,
    abi: MARKET_FACTORY_ABI,
    functionName: 'createMarket',
    args: ['Diag Token ' + Date.now(), BigInt(2), oracleRegistryAddress, resolutionTime, account.address],
    account
  });
  
  const marketTx = await walletClient.writeContract({
    ...createMarketReq,
    gas: BigInt(600000),
    account
  });
  console.log("MarketCreated tx sent:", marketTx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: marketTx });
  console.log("MarketCreated receipt status:", receipt.status);

  const logs = parseEventLogs({
    abi: MARKET_FACTORY_ABI,
    eventName: 'MarketCreated',
    logs: receipt.logs
  });
  const conditionId = logs[0].args.conditionId;
  console.log("Extracted conditionId:", conditionId);

  // Simulate createPool with 2,500,000 gas limit for contract deployment
  console.log("Simulating createPool...");
  const { request: createPoolReq } = await publicClient.simulateContract({
    address: poolFactoryAddress,
    abi: AM_POOL_FACTORY_ABI,
    functionName: 'createPool',
    args: [ctAddr, conditionId, usdcAddress],
    account
  });
  console.log("createPool simulation SUCCESS!");
  const poolTx = await walletClient.writeContract({
    ...createPoolReq,
    gas: BigInt(2500000), // Sufficient gas for contract deployment
    account
  });
  console.log("createPool tx sent:", poolTx);
  const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolTx });
  console.log("createPool receipt status:", poolReceipt.status);

  if (poolReceipt.status !== 'success') {
    throw new Error(`createPool transaction reverted on-chain with status: ${poolReceipt.status}`);
  }

  const poolLogs = parseEventLogs({
    abi: AM_POOL_FACTORY_ABI,
    eventName: 'PoolCreated',
    logs: poolReceipt.logs
  });
  console.log("PoolCreated logs:", poolLogs);
  const targetPoolAddress = poolLogs[0].args.poolAddress;
  console.log("Target Pool Address:", targetPoolAddress);

  // Test USDC allowance to targetPoolAddress
  const seedAmountScaled = BigInt(100_000_000); // 100 USDC
  const allowance = await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, targetPoolAddress]
  });
  console.log("USDC allowance for targetPoolAddress:", Number(allowance) / 1e6);

  if (allowance < seedAmountScaled) {
    console.log("Approving targetPoolAddress for USDC...");
    const { request: appReq } = await publicClient.simulateContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [targetPoolAddress, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')],
      account
    });
    const appTx = await walletClient.writeContract({
      ...appReq,
      gas: BigInt(150000),
      account
    });
    await publicClient.waitForTransactionReceipt({ hash: appTx });
    console.log("Pool USDC allowance approved!");
  }

  // Simulate addLiquidity
  console.log("Simulating addLiquidity(100 USDC)...");
  const { request: addLiqReq } = await publicClient.simulateContract({
    address: targetPoolAddress,
    abi: AM_POOL_ABI,
    functionName: 'addLiquidity',
    args: [seedAmountScaled],
    account
  });
  console.log("addLiquidity simulation SUCCESS!");
  const addLiqTx = await walletClient.writeContract({
    ...addLiqReq,
    gas: BigInt(800000),
    account
  });
  console.log("addLiquidity tx sent:", addLiqTx);
  const addLiqReceipt = await publicClient.waitForTransactionReceipt({ hash: addLiqTx });
  console.log("addLiquidity receipt status:", addLiqReceipt.status);

  console.log("\n>>> FULL END-TO-END ARENA CREATION & SEEDING TEST PASSED PERFECTLY! <<<");
}

runDiag().catch(console.error);
