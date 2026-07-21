const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShitMarketCore", function () {
  let mockUSDC;
  let shitMarketCore;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy ShitMarketCore
    const ShitMarketCore = await ethers.getContractFactory("ShitMarketCore");
    shitMarketCore = await ShitMarketCore.deploy(
      await mockUSDC.getAddress(),
      owner.address,
      200 // 2%
    );
    await shitMarketCore.waitForDeployment();

    // 3. Distribute USDC to users
    await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6));
    await mockUSDC.mint(user2.address, ethers.parseUnits("1000", 6));
  });

  it("should deploy with correct USDC address", async function () {
    expect(await shitMarketCore.usdcToken()).to.equal(await mockUSDC.getAddress());
  });

  it("should allow creating a prediction room", async function () {
    const tokenMint = ethers.zeroPadValue(ethers.hexlify(ethers.randomBytes(20)), 32);
    const tokenName = "Degen Token";
    const chainId = "solana";
    const durationMinutes = 60;
    const openingPrice = 1000000; // $1.00 scaled to 6 decimals
    const oracle = ethers.ZeroAddress;
    const oracleFeeAmount = 0;

    const tx = await shitMarketCore.createRoom(
      tokenMint,
      tokenName,
      chainId,
      durationMinutes,
      openingPrice,
      oracle,
      oracleFeeAmount
    );
    
    // Get transaction receipt to read events
    const receipt = await tx.wait();
    
    // Check Event emitted
    const roomCreatedEvent = receipt.logs.find(
      x => x.fragment && x.fragment.name === "RoomCreated"
    );
    expect(roomCreatedEvent).to.not.be.undefined;
  });

  it("should allow placing bets and pooling wagers", async function () {
    // 1. Create room
    const tokenMint = ethers.zeroPadValue(ethers.hexlify(ethers.randomBytes(20)), 32);
    const tx = await shitMarketCore.createRoom(
      tokenMint,
      "Test Token",
      "solana",
      60,
      1000000,
      ethers.ZeroAddress,
      0
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(x => x.fragment && x.fragment.name === "RoomCreated");
    const roomId = event.args[0];

    // 2. Approve ShitMarketCore to spend user1's USDC
    const coreAddress = await shitMarketCore.getAddress();
    await mockUSDC.connect(user1).approve(coreAddress, ethers.parseUnits("100", 6));

    // 3. Place bet
    await shitMarketCore.connect(user1).placeBet(roomId, 0, ethers.parseUnits("50", 6)); // Moon bet

    const room = await shitMarketCore.getRoom(roomId);
    expect(room.moonPool).to.equal(ethers.parseUnits("50", 6));
  });
});
