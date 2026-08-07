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

    // 4. Verify ERC-1155 outcome tokens are minted to user1
    const tokenId = await shitMarketCore.getOutcomeTokenId(roomId, 0); // Moon = 0
    const userBalance = await shitMarketCore.balanceOf(user1.address, tokenId);
    expect(userBalance).to.equal(ethers.parseUnits("50", 6));
  });

  it("should burn ERC-1155 outcome tokens and distribute USDC winnings upon claim", async function () {
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

    // 2. Setup user1 (Moon bet) and user2 (Jeet bet)
    const coreAddress = await shitMarketCore.getAddress();
    await mockUSDC.connect(user1).approve(coreAddress, ethers.parseUnits("100", 6));
    await mockUSDC.connect(user2).approve(coreAddress, ethers.parseUnits("100", 6));

    await shitMarketCore.connect(user1).placeBet(roomId, 0, ethers.parseUnits("50", 6)); // Moon bet
    await shitMarketCore.connect(user2).placeBet(roomId, 1, ethers.parseUnits("50", 6)); // Jeet bet

    // 3. Settle room (Moon wins: final price $1.50 > opening price $1.00)
    // Travel to expiry
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine");

    await shitMarketCore.settleRoom(roomId, 1500000); // Settle at $1.50

    // Verify room state is Settled
    const settledRoom = await shitMarketCore.getRoom(roomId);
    expect(settledRoom.status).to.equal(1); // Settled
    expect(settledRoom.winner).to.equal(0); // Moon wins

    // 4. Claim winnings for user1 (winner)
    const tokenId = await shitMarketCore.getOutcomeTokenId(roomId, 0);
    const balanceBefore = await mockUSDC.balanceOf(user1.address);

    await shitMarketCore.connect(user1).claimWinnings(roomId, 0);

    // Verify user1's ERC-1155 winning tokens are burned
    const balanceAfterBurn = await shitMarketCore.balanceOf(user1.address, tokenId);
    expect(balanceAfterBurn).to.equal(0);

    // Verify USDC balance increased (USDC payout from pool minus fees)
    const balanceAfter = await mockUSDC.balanceOf(user1.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });
});
