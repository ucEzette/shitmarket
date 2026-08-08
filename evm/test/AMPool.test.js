const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMPool & AMPoolFactory", function () {
  let mockUSDC;
  let factory;
  let conditionalTokens;
  let poolFactory;
  let pool;
  let owner;
  let lpProvider;
  let swapper;
  let treasury;
  let conditionId;

  beforeEach(async function () {
    [owner, lpProvider, swapper, treasury] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy MarketFactory (which deploys ConditionalTokens)
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    factory = await MarketFactory.deploy(await mockUSDC.getAddress(), treasury.address);
    await factory.waitForDeployment();

    const conditionalTokensAddress = await factory.conditionalTokens();
    const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = ConditionalTokens.attach(conditionalTokensAddress);

    // 3. Deploy AMPoolFactory
    const AMPoolFactory = await ethers.getContractFactory("AMPoolFactory");
    poolFactory = await AMPoolFactory.deploy();
    await poolFactory.waitForDeployment();

    // 4. Distribute USDC
    await mockUSDC.mint(owner.address, ethers.parseUnits("1000", 6));
    await mockUSDC.mint(lpProvider.address, ethers.parseUnits("1000", 6));
    await mockUSDC.mint(swapper.address, ethers.parseUnits("1000", 6));

    // 5. Create a Prediction Market to generate conditionId ($3 creation fee)
    const ipfsHash = "QmTest";
    const outcomeCount = 2;
    const oracle = owner.address;
    const resolutionTime = Math.floor(Date.now() / 1000) + 3600;

    await mockUSDC.approve(await factory.getAddress(), ethers.parseUnits("3", 6)); // pay 3 USDC creation fee
    const tx = await factory.createMarket(ipfsHash, outcomeCount, oracle, resolutionTime, ethers.ZeroAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(x => x.fragment && x.fragment.name === "MarketCreated");
    conditionId = event.args[1];

    // 6. Deploy AMPool via poolFactory with treasury
    const poolTx = await poolFactory.createPool(
      await conditionalTokens.getAddress(),
      conditionId,
      await mockUSDC.getAddress(),
      treasury.address
    );
    const poolReceipt = await poolTx.wait();
    const poolEvent = poolReceipt.logs.find(x => x.fragment && x.fragment.name === "PoolCreated");
    const poolAddress = poolEvent.args[1];

    const AMPool = await ethers.getContractFactory("AMPool");
    pool = AMPool.attach(poolAddress);
  });

  it("should deploy correctly with $3 creation fee and 0.10% fee parameters", async function () {
    expect(await factory.creationFee()).to.equal(ethers.parseUnits("3", 6));
    expect(await pool.conditionalTokens()).to.equal(await conditionalTokens.getAddress());
    expect(await pool.conditionId()).to.equal(conditionId);
    expect(await pool.usdcToken()).to.equal(await mockUSDC.getAddress());
    expect(await pool.treasury()).to.equal(treasury.address);
    expect(await pool.TOTAL_FEE_BPS()).to.equal(10); // 0.10%
    expect(await pool.LP_FEE_BPS()).to.equal(7);      // 0.07%
    expect(await pool.TREASURY_FEE_BPS()).to.equal(3); // 0.03%
  });

  it("should allow adding initial liquidity and subsequent liquidity", async function () {
    const lpAddress = await pool.getAddress();
    
    // LP Provider approves pool to spend USDC
    await mockUSDC.connect(lpProvider).approve(lpAddress, ethers.parseUnits("200", 6));

    // Add initial liquidity
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("100", 6));

    // Verify reserves are equal for YES and NO outcomes
    expect(await pool.reserves(0)).to.equal(ethers.parseUnits("100", 6));
    expect(await pool.reserves(1)).to.equal(ethers.parseUnits("100", 6));
    expect(await pool.balanceOf(lpProvider.address)).to.equal(ethers.parseUnits("100", 6));

    // Add subsequent liquidity
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("100", 6));
    expect(await pool.reserves(0)).to.equal(ethers.parseUnits("150", 6));
    expect(await pool.reserves(1)).to.equal(ethers.parseUnits("150", 6));
  });

  it("should route 0.03% to treasury and accumulate 0.07% claimable fee for LPs on swaps", async function () {
    const lpAddress = await pool.getAddress();
    
    // Seed pool liquidity (100 USDC)
    await mockUSDC.connect(lpProvider).approve(lpAddress, ethers.parseUnits("100", 6));
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("100", 6));

    const treasuryBefore = await mockUSDC.balanceOf(treasury.address);

    // Swapper spends 100 USDC on YES shares
    await mockUSDC.connect(swapper).approve(lpAddress, ethers.parseUnits("100", 6));
    await pool.connect(swapper).buyShares(0, ethers.parseUnits("100", 6));

    // Total fee on 100 USDC = 0.10 USDC = 100,000 micro-USDC
    // Treasury portion (0.03%) = 0.03 USDC = 30,000 micro-USDC
    // LP portion (0.07%) = 0.07 USDC = 70,000 micro-USDC
    const treasuryAfter = await mockUSDC.balanceOf(treasury.address);
    expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseUnits("0.03", 6));

    // LP should have 0.07 USDC in claimable fees
    const claimable = await pool.getClaimableFees(lpProvider.address);
    expect(claimable).to.equal(ethers.parseUnits("0.07", 6));

    // LP claims fee without removing liquidity
    const lpBalBefore = await mockUSDC.balanceOf(lpProvider.address);
    await pool.connect(lpProvider).claimFees();
    const lpBalAfter = await mockUSDC.balanceOf(lpProvider.address);

    expect(lpBalAfter - lpBalBefore).to.equal(ethers.parseUnits("0.07", 6));
    expect(await pool.getClaimableFees(lpProvider.address)).to.equal(0);
    // Principal LP balance is completely untouched
    expect(await pool.balanceOf(lpProvider.address)).to.equal(ethers.parseUnits("100", 6));
  });

  it("should allow selling YES outcome shares and accrue 0.07% LP fees and 0.03% treasury fee", async function () {
    const lpAddress = await pool.getAddress();

    // Seed pool
    await mockUSDC.connect(lpProvider).approve(lpAddress, ethers.parseUnits("200", 6));
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("200", 6));

    // Swapper buys YES shares
    await mockUSDC.connect(swapper).approve(lpAddress, ethers.parseUnits("50", 6));
    await pool.connect(swapper).buyShares(0, ethers.parseUnits("50", 6));

    const tokenId0 = await pool.getTokenId(0);
    const sharesOwned = await conditionalTokens.balanceOf(swapper.address, tokenId0);

    // Swapper approves pool to manage outcome shares
    await conditionalTokens.connect(swapper).setApprovalForAll(lpAddress, true);

    const treasuryBefore = await mockUSDC.balanceOf(treasury.address);

    // Sell shares back to pool
    await pool.connect(swapper).sellShares(0, sharesOwned);

    const treasuryAfter = await mockUSDC.balanceOf(treasury.address);
    expect(treasuryAfter).to.be.gt(treasuryBefore);

    // Claimable fees for LP should be positive
    const claimable = await pool.getClaimableFees(lpProvider.address);
    expect(claimable).to.be.gt(0);
  });

  it("should allow removing liquidity and reclaiming USDC", async function () {
    const lpAddress = await pool.getAddress();

    // Seed pool
    await mockUSDC.connect(lpProvider).approve(lpAddress, ethers.parseUnits("100", 6));
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("100", 6));

    const lpShares = await pool.balanceOf(lpProvider.address);

    // Remove liquidity
    await pool.connect(lpProvider).removeLiquidity(lpShares);

    expect(await pool.balanceOf(lpProvider.address)).to.equal(0);
    expect(await pool.reserves(0)).to.equal(0);
    expect(await pool.reserves(1)).to.equal(0);
  });
});
