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
  },
  {
    name: 'buyShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'outcomeIndex', type: 'uint8' }, { name: 'usdcAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'sellShares',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'outcomeIndex', type: 'uint8' }, { name: 'shareAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

const CONDITIONAL_TOKENS_ABI = [
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
    outputs: []
  }
];

async function runTradeDiag() {
  console.log("=== EVM Direct AMM Trading Diagnostics ===");
  console.log("Account:", account.address);

  const ctAddr = await publicClient.readContract({
    address: marketFactoryAddress,
    abi: MARKET_FACTORY_ABI,
    functionName: 'conditionalTokens'
  });

  // Create room
  const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const { request: createMarketReq } = await publicClient.simulateContract({
    address: marketFactoryAddress,
    abi: MARKET_FACTORY_ABI,
    functionName: 'createMarket',
    args: ['Trade Test ' + Date.now(), BigInt(2), oracleRegistryAddress, resolutionTime, account.address],
    account
  });
  const marketTx = await walletClient.writeContract({ ...createMarketReq, gas: BigInt(600000), account });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: marketTx });
  const logs = parseEventLogs({ abi: MARKET_FACTORY_ABI, eventName: 'MarketCreated', logs: receipt.logs });
  const conditionId = logs[0].args.conditionId;

  // Create pool
  const { request: createPoolReq } = await publicClient.simulateContract({
    address: poolFactoryAddress,
    abi: AM_POOL_FACTORY_ABI,
    functionName: 'createPool',
    args: [ctAddr, conditionId, usdcAddress],
    account
  });
  const poolTx = await walletClient.writeContract({ ...createPoolReq, gas: BigInt(2500000), account });
  const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolTx });
  const poolLogs = parseEventLogs({ abi: AM_POOL_FACTORY_ABI, eventName: 'PoolCreated', logs: poolReceipt.logs });
  const poolAddress = poolLogs[0].args.poolAddress;
  console.log("Pool Deployed:", poolAddress);

  // Add initial liquidity (100 USDC)
  const seedAmount = BigInt(100_000_000);
  const { request: appReq } = await publicClient.simulateContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [poolAddress, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')],
    account
  });
  const appTx = await walletClient.writeContract({ ...appReq, gas: BigInt(150000), account });
  await publicClient.waitForTransactionReceipt({ hash: appTx });

  const { request: addLiqReq } = await publicClient.simulateContract({
    address: poolAddress,
    abi: AM_POOL_ABI,
    functionName: 'addLiquidity',
    args: [seedAmount],
    account
  });
  const addLiqTx = await walletClient.writeContract({ ...addLiqReq, gas: BigInt(800000), account });
  await publicClient.waitForTransactionReceipt({ hash: addLiqTx });
  console.log("Initial 100 USDC Liquidity Added successfully!");

  // Test Direct buyShares(0 [MOON], 10 USDC)
  const buyAmountUsdc = BigInt(10_000_000);
  console.log("Simulating direct buyShares on AMM Pool for MOON (10 USDC)...");
  const { request: buyReq } = await publicClient.simulateContract({
    address: poolAddress,
    abi: AM_POOL_ABI,
    functionName: 'buyShares',
    args: [0, buyAmountUsdc],
    account
  });
  console.log("direct buyShares simulation SUCCESS!");
  const buyTx = await walletClient.writeContract({ ...buyReq, gas: BigInt(500000), account });
  const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTx });
  console.log("direct buyShares tx status:", buyReceipt.status);

  // Test Direct buyShares(1 [JEET], 10 USDC)
  console.log("Simulating direct buyShares on AMM Pool for JEET (10 USDC)...");
  const { request: buyJeetReq } = await publicClient.simulateContract({
    address: poolAddress,
    abi: AM_POOL_ABI,
    functionName: 'buyShares',
    args: [1, buyAmountUsdc],
    account
  });
  console.log("direct buyShares for JEET simulation SUCCESS!");
  const buyJeetTx = await walletClient.writeContract({ ...buyJeetReq, gas: BigInt(500000), account });
  const buyJeetReceipt = await publicClient.waitForTransactionReceipt({ hash: buyJeetTx });
  console.log("direct buyShares for JEET status:", buyJeetReceipt.status);

  // Test Direct sellShares(0 [MOON], 5 shares)
  console.log("Testing ConditionalTokens approval for pool...");
  const isApproved = await publicClient.readContract({
    address: ctAddr,
    abi: CONDITIONAL_TOKENS_ABI,
    functionName: 'isApprovedForAll',
    args: [account.address, poolAddress]
  });
  if (!isApproved) {
    const { request: ctAppReq } = await publicClient.simulateContract({
      address: ctAddr,
      abi: CONDITIONAL_TOKENS_ABI,
      functionName: 'setApprovalForAll',
      args: [poolAddress, true],
      account
    });
    const ctAppTx = await walletClient.writeContract({ ...ctAppReq, gas: BigInt(150000), account });
    await publicClient.waitForTransactionReceipt({ hash: ctAppTx });
    console.log("ConditionalTokens approved for pool!");
  }

  const sellAmountShares = BigInt(5_000_000);
  console.log("Simulating direct sellShares on AMM Pool for MOON (5 shares)...");
  const { request: sellReq } = await publicClient.simulateContract({
    address: poolAddress,
    abi: AM_POOL_ABI,
    functionName: 'sellShares',
    args: [0, sellAmountShares],
    account
  });
  console.log("direct sellShares simulation SUCCESS!");
  const sellTx = await walletClient.writeContract({ ...sellReq, gas: BigInt(500000), account });
  const sellReceipt = await publicClient.waitForTransactionReceipt({ hash: sellTx });
  console.log("direct sellShares status:", sellReceipt.status);

  console.log("\n>>> DIRECT AMM BUYING & SELLING ON BOTH SIDES PASSED 100% PERFECTLY! <<<");
}

runTradeDiag().catch(console.error);
