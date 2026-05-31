import { expect } from "chai";
import { ethers } from "hardhat";

describe("ArcShieldFactory", function () {
  let owner: any;
  let agent: any;
  let factory: any;
  let usdc: any;

  const SIX_DECIMALS = 1_000_000;
  const DAILY_LIMIT = 200 * SIX_DECIMALS;
  const MAX_TX_AMOUNT = 50 * SIX_DECIMALS;

  beforeEach(async function () {
    [owner, agent] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy ArcShieldFactory
    const ArcShieldFactory = await ethers.getContractFactory("ArcShieldFactory");
    factory = await ArcShieldFactory.deploy();
    await factory.waitForDeployment();
  });

  it("Should deploy a new shield and set the correct parameters", async function () {
    const usdcAddress = await usdc.getAddress();

    // Create shield using factory
    const tx = await factory.createShield(
      agent.address,
      usdcAddress,
      DAILY_LIMIT,
      MAX_TX_AMOUNT
    );

    const receipt = await tx.wait();

    // Find ShieldCreated event
    const event = receipt.logs
      .map((log: any) => {
        try {
          return factory.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((parsedLog: any) => parsedLog && parsedLog.name === "ShieldCreated");

    expect(event).to.not.be.null;
    const shieldAddress = event.args.shieldAddress;

    expect(event.args.owner).to.equal(owner.address);
    expect(event.args.agent).to.equal(agent.address);
    expect(event.args.usdc).to.equal(usdcAddress);
    expect(event.args.dailyLimit).to.equal(DAILY_LIMIT);
    expect(event.args.maxTxAmount).to.equal(MAX_TX_AMOUNT);

    // Verify mappings inside factory
    expect(await factory.getShieldsCount()).to.equal(1);
    const ownerShields = await factory.getOwnerShields(owner.address);
    expect(ownerShields.length).to.equal(1);
    expect(ownerShields[0]).to.equal(shieldAddress);

    // Verify state on the deployed Shield contract itself
    const shieldContract = await ethers.getContractAt("ArcShield", shieldAddress);
    expect(await shieldContract.owner()).to.equal(owner.address);
    expect(await shieldContract.agent()).to.equal(agent.address);
    expect(await shieldContract.usdc()).to.equal(usdcAddress);
    expect(await shieldContract.dailyLimit()).to.equal(DAILY_LIMIT);
    expect(await shieldContract.maxTxAmount()).to.equal(MAX_TX_AMOUNT);
  });
});
