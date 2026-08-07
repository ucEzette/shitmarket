const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UmaOracleAdapter", function () {
  let mockUMA;
  let umaAdapter;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // 1. Deploy Mock UMA OOv3
    const MockUMA = await ethers.getContractFactory("MockOptimisticOracleV3");
    mockUMA = await MockUMA.deploy();
    await mockUMA.waitForDeployment();

    // 2. Deploy UmaOracleAdapter
    const UmaOracleAdapter = await ethers.getContractFactory("UmaOracleAdapter");
    umaAdapter = await UmaOracleAdapter.deploy(await mockUMA.getAddress());
    await umaAdapter.waitForDeployment();
  });

  it("should assert an outcome correctly", async function () {
    const marketId = 12345;
    const proposedOutcome = 0; // Moon/YES
    const claimStr = "pepe token is above $1.00 at expiry";

    const tx = await umaAdapter.assertOutcome(marketId, proposedOutcome, claimStr);
    const receipt = await tx.wait();

    // Verify AssertionMade event from Mock UMA
    const assertionEvent = receipt.logs.find(
      x => x.fragment && x.fragment.name === "MarketOutcomeAsserted"
    );
    expect(assertionEvent).to.not.be.undefined;
    expect(assertionEvent.args[0]).to.equal(marketId);
    expect(assertionEvent.args[2]).to.equal(proposedOutcome);
  });

  it("should resolve correctly when UMA confirms assertion is true", async function () {
    const marketId = 999;
    const proposedOutcome = 0;
    const claimStr = "pepe is above $1.00";

    const tx = await umaAdapter.assertOutcome(marketId, proposedOutcome, claimStr);
    const receipt = await tx.wait();
    const event = receipt.logs.find(x => x.fragment && x.fragment.name === "MarketOutcomeAsserted");
    const assertionId = event.args[1];

    // Simulate UMA resolving the assertion as true
    await mockUMA.resolveAssertion(assertionId, true);

    // Verify outcomes mapping
    const outcome = await umaAdapter.getOutcome(marketId);
    expect(outcome.ready).to.be.true;
    expect(outcome.outcomeIndex).to.equal(proposedOutcome);
  });

  it("should resolve to opposite side when UMA overturns assertion as false", async function () {
    const marketId = 777;
    const proposedOutcome = 0; // proposed Moon/YES (0)
    const claimStr = "pepe is above $1.00";

    const tx = await umaAdapter.assertOutcome(marketId, proposedOutcome, claimStr);
    const receipt = await tx.wait();
    const event = receipt.logs.find(x => x.fragment && x.fragment.name === "MarketOutcomeAsserted");
    const assertionId = event.args[1];

    // Simulate UMA resolving the assertion as false (overturned)
    await mockUMA.resolveAssertion(assertionId, false);

    // Verify outcomes mapping resolved to opposite outcome side (1)
    const outcome = await umaAdapter.getOutcome(marketId);
    expect(outcome.ready).to.be.true;
    expect(outcome.outcomeIndex).to.equal(1); // Jeet/NO
  });
});
