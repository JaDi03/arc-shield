import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("ArcShield Contract", function () {
  let owner: any;
  let agent: any;
  let allowedRecipient: any;
  let blockedRecipient: any;
  let safeWallet: any;
  
  let usdc: any;
  let shield: any;

  const SIX_DECIMALS = 1_000_000;
  const DAILY_LIMIT = 100 * SIX_DECIMALS; // 100 USDC
  const MAX_TX_AMOUNT = 50 * SIX_DECIMALS; // 50 USDC

  beforeEach(async function () {
    [owner, agent, allowedRecipient, blockedRecipient, safeWallet] = await ethers.getSigners();

    // Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy ArcShield
    const ArcShield = await ethers.getContractFactory("ArcShield");
    shield = await ArcShield.deploy(
      owner.address,
      agent.address,
      await usdc.getAddress(),
      DAILY_LIMIT,
      MAX_TX_AMOUNT
    );
    await shield.waitForDeployment();

    // Fund the ArcShield contract with 500 USDC
    const fundAmount = 500 * SIX_DECIMALS;
    await usdc.mint(await shield.getAddress(), fundAmount);

    // Set up initial allowlist
    await shield.setAllowlist(allowedRecipient.address, true);
  });

  describe("Deployment", function () {
    it("Should set the correct roles and configuration", async function () {
      expect(await shield.owner()).to.equal(owner.address);
      expect(await shield.agent()).to.equal(agent.address);
      expect(await shield.usdc()).to.equal(await usdc.getAddress());
      expect(await shield.dailyLimit()).to.equal(DAILY_LIMIT);
      expect(await shield.maxTxAmount()).to.equal(MAX_TX_AMOUNT);
      expect(await shield.isLocked()).to.be.false;
    });
  });

  describe("Agent Executing Actions", function () {
    it("Should allow agent to transfer USDC to allowlisted recipient within limits", async function () {
      const txAmount = 30 * SIX_DECIMALS;
      
      const balanceBefore = await usdc.balanceOf(allowedRecipient.address);
      
      // Execute transfer via agent
      await expect(shield.connect(agent).executeAction(allowedRecipient.address, txAmount, "0x"))
        .to.emit(shield, "ActionExecuted")
        .withArgs(allowedRecipient.address, txAmount, "0x");

      const balanceAfter = await usdc.balanceOf(allowedRecipient.address);
      expect(balanceAfter - balanceBefore).to.equal(txAmount);
      expect(await shield.dailySpent()).to.equal(txAmount);
    });

    it("Should revert if caller is not the authorized agent", async function () {
      const txAmount = 10 * SIX_DECIMALS;
      await expect(
        shield.connect(owner).executeAction(allowedRecipient.address, txAmount, "0x")
      ).to.be.revertedWith("Caller is not the authorized agent");
    });

    it("Should revert if recipient is not allowlisted", async function () {
      const txAmount = 10 * SIX_DECIMALS;
      await expect(
        shield.connect(agent).executeAction(blockedRecipient.address, txAmount, "0x")
      ).to.be.revertedWith("ArcShield: Target not in allowlist");
    });

    it("Should revert if single transaction amount exceeds maximum size", async function () {
      const txAmount = 51 * SIX_DECIMALS; // Max is 50
      await expect(
        shield.connect(agent).executeAction(allowedRecipient.address, txAmount, "0x")
      ).to.be.revertedWith("ArcShield: Exceeds transaction limit");
    });

    it("Should revert if daily cumulative limit is exceeded", async function () {
      // First transaction: 40 USDC (OK)
      await shield.connect(agent).executeAction(allowedRecipient.address, 40 * SIX_DECIMALS, "0x");
      // Second transaction: 40 USDC (OK)
      await shield.connect(agent).executeAction(allowedRecipient.address, 40 * SIX_DECIMALS, "0x");
      
      // Third transaction: 30 USDC (Total 110 USDC, Limit is 100) -> Reverts
      await expect(
        shield.connect(agent).executeAction(allowedRecipient.address, 30 * SIX_DECIMALS, "0x")
      ).to.be.revertedWith("ArcShield: Exceeds daily spending limit");
    });

    it("Should reset daily spent limit after 24 hours", async function () {
      // Spend 90 USDC
      await shield.connect(agent).executeAction(allowedRecipient.address, 45 * SIX_DECIMALS, "0x");
      await shield.connect(agent).executeAction(allowedRecipient.address, 45 * SIX_DECIMALS, "0x");

      expect(await shield.dailySpent()).to.equal(90 * SIX_DECIMALS);

      // Increase block timestamp by 24 hours + 1 second
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Spend another 30 USDC -> should succeed and reset dailySpent to 30
      await expect(shield.connect(agent).executeAction(allowedRecipient.address, 30 * SIX_DECIMALS, "0x"))
        .to.not.be.reverted;

      expect(await shield.dailySpent()).to.equal(30 * SIX_DECIMALS);
    });
  });

  describe("Administrative & Emergency Functions", function () {
    it("Should allow owner to lock and unlock the guard, halting agent execution", async function () {
      // Lock contract
      await expect(shield.connect(owner).setEmergencyLock(true))
        .to.emit(shield, "EmergencyLocked")
        .withArgs(true);

      expect(await shield.isLocked()).to.be.true;

      // Try executing action as agent -> should revert
      await expect(
        shield.connect(agent).executeAction(allowedRecipient.address, 10 * SIX_DECIMALS, "0x")
      ).to.be.revertedWith("ArcShield: Emergency lock is active");

      // Unlock contract
      await shield.connect(owner).setEmergencyLock(false);
      expect(await shield.isLocked()).to.be.false;

      // Try executing again -> should succeed
      await expect(
        shield.connect(agent).executeAction(allowedRecipient.address, 10 * SIX_DECIMALS, "0x")
      ).to.not.be.reverted;
    });

    it("Should allow owner to withdraw all funds in an emergency", async function () {
      const contractBalanceBefore = await usdc.balanceOf(await shield.getAddress());
      expect(contractBalanceBefore).to.equal(500 * SIX_DECIMALS);

      const recipientBalanceBefore = await usdc.balanceOf(safeWallet.address);

      // Withdraw all USDC to safeWallet
      await expect(shield.connect(owner).withdrawFunds(safeWallet.address))
        .to.emit(shield, "FundsWithdrawn")
        .withArgs(safeWallet.address, contractBalanceBefore);

      const contractBalanceAfter = await usdc.balanceOf(await shield.getAddress());
      const recipientBalanceAfter = await usdc.balanceOf(safeWallet.address);

      expect(contractBalanceAfter).to.equal(0);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(contractBalanceBefore);
    });

    it("Should allow owner to update spending limits and agent keys", async function () {
      const NEW_DAILY_LIMIT = 200 * SIX_DECIMALS;
      const NEW_MAX_TX = 100 * SIX_DECIMALS;

      await expect(shield.connect(owner).updateDailyLimit(NEW_DAILY_LIMIT))
        .to.emit(shield, "LimitUpdated")
        .withArgs(DAILY_LIMIT, NEW_DAILY_LIMIT);

      await expect(shield.connect(owner).updateMaxTxAmount(NEW_MAX_TX))
        .to.emit(shield, "MaxTxAmountUpdated")
        .withArgs(MAX_TX_AMOUNT, NEW_MAX_TX);

      expect(await shield.dailyLimit()).to.equal(NEW_DAILY_LIMIT);
      expect(await shield.maxTxAmount()).to.equal(NEW_MAX_TX);
    });
  });
});
