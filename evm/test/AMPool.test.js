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
  let conditionId;

  beforeEach(async function () {
    [owner, lpProvider, swapper] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy MarketFactory (which deploys ConditionalTokens)
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    factory = await MarketFactory.deploy(await mockUSDC.getAddress(), owner.address);
    await factory.waitForDeployment();

    const conditionalTokensAddress = await factory.conditionalTokens();
    const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
    conditionalTokens = ConditionalTokens.attach(conditionalTokensAddress);

    // 3. Deploy AMPoolFactory
    const AMPoolFactory = await ethers.getContractFactory("AMPoolFactory");
    poolFactory = await AMPoolFactory.deploy();
    await poolFactory.waitForDeployment();

    // 4. Distribute USDC
    await mockUSDC.mint(lpProvider.address, ethers.parseUnits("1000", 6));
    await mockUSDC.mint(swapper.address, ethers.parseUnits("1000", 6));

    // 5. Create a Prediction Market to generate conditionId
    const ipfsHash = "QmTest";
    const outcomeCount = 2;
    const oracle = owner.address;
    const resolutionTime = Math.floor(Date.now() / 1000) + 3600;

    await mockUSDC.approve(await factory.getAddress(), ethers.parseUnits("5", 6)); // pay creation fee
    const tx = await factory.createMarket(ipfsHash, outcomeCount, oracle, resolutionTime, ethers.ZeroAddress);
    const receipt = await tx.wait();
    const event = receipt.logs.find(x => x.fragment && x.fragment.name === "MarketCreated");
    conditionId = event.args[1];

    // 6. Deploy AMPool via poolFactory
    const poolTx = await poolFactory.createPool(
      await conditionalTokens.getAddress(),
      conditionId,
      await mockUSDC.getAddress()
    );
    const poolReceipt = await poolTx.wait();
    const poolEvent = poolReceipt.logs.find(x => x.fragment && x.fragment.name === "PoolCreated");
    const poolAddress = poolEvent.args[1];

    const AMPool = await ethers.getContractFactory("AMPool");
    pool = AMPool.attach(poolAddress);
  });

  it("should deploy correctly and initialize attributes", async function () {
    expect(await pool.conditionalTokens()).to.equal(await conditionalTokens.getAddress());
    expect(await pool.conditionId()).to.equal(conditionId);
    expect(await pool.usdcToken()).to.equal(await mockUSDC.getAddress());
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

  it("should allow swapping USDC for YES outcome shares", async function () {
    const lpAddress = await pool.getAddress();
    
    // Seed pool liquidity
    await mockUSDC.connect(lpProvider).approve(lpAddress, ethers.parseUnits("100", 6));
    await pool.connect(lpProvider).addLiquidity(ethers.parseUnits("100", 6));

    // Swapper buys YES shares (outcomeIndex 0)
    await mockUSDC.connect(swapper).approve(lpAddress, ethers.parseUnits("10", 6));
    
    const buyTx = await pool.connect(swapper).buyShares(0, ethers.parseUnits("10", 6));
    const buyReceipt = await buyTx.wait();

    // Verify swap event emitted
    const swapEvent = buyReceipt.logs.find(x => x.fragment && x.fragment.name === "Swap");
    expect(swapEvent).to.not.be.undefined;
    expect(swapEvent.args[1]).to.equal(0); // outcomeIndex YES
    
    // Swapper should receive some YES shares
    const tokenId0 = await pool.getTokenId(0);
    const swapperShares = await conditionalTokens.balanceOf(swapper.address, tokenId0);
    expect(swapperShares).to.be.gt(0);
  });

  it("should allow selling YES outcome shares back to pool", async function () {
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

    // Sell shares back to pool
    const balanceBefore = await mockUSDC.balanceOf(swapper.address);
    await pool.connect(swapper).sellShares(0, sharesOwned);
    const balanceAfter = await mockUSDC.balanceOf(swapper.address);

    expect(balanceAfter).to.be.gt(balanceBefore);
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
