import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TestToken } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TestToken", function () {
  let testToken: TestToken;
  let admin: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let burner: HardhatEthersSigner;
  let upgrader: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const INIT_SUPPLY = ethers.parseEther("1000000"); // 1M TST max supply

  const initParams = (overrides = {}) => ({
    admin: admin.address,
    minter: minter.address,
    burner: burner.address,
    upgrader: upgrader.address,
    name: "Test Token",
    symbol: "TST",
    maxSupply: INIT_SUPPLY,
    ...overrides,
  });

  beforeEach(async () => {
    [admin, minter, burner, upgrader, user, user2] = await ethers.getSigners();

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    testToken = await upgrades.deployProxy(TestTokenFactory, [initParams()], {
      initializer: "initialize",
      kind: "uups",
    });
    await testToken.waitForDeployment();
  });

  describe("Initialization", () => {
    it("should initialize with correct parameters", async () => {
      expect(await testToken.name()).to.equal("Test Token");
      expect(await testToken.symbol()).to.equal("TST");
      expect(await testToken.maxTotalSupply()).to.equal(INIT_SUPPLY);
      expect(await testToken.hasRole(await testToken.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await testToken.hasRole(await testToken.MINTER_ROLE(), minter.address)).to.be.true;
      expect(await testToken.hasRole(await testToken.BURNER_ROLE(), burner.address)).to.be.true;
      expect(await testToken.hasRole(await testToken.UPGRADER_ROLE(), upgrader.address)).to.be.true;
    });

    it("should revert on zero address in initializer", async () => {
      const badInit = initParams({ admin: ethers.ZeroAddress });

      const TestTokenFactory = await ethers.getContractFactory("TestToken");
      await expect(
        upgrades.deployProxy(TestTokenFactory, [badInit], {
          initializer: "initialize",
          kind: "uups",
        })
      ).to.be.revertedWithCustomError(testToken, "UnexpectedInitializeParams");
    });
  });

  describe("Minting", () => {
    it("should allow minter to mint within max supply", async () => {
      const amount = ethers.parseEther("1000");
      await testToken.connect(minter).mint(user.address, amount);
      expect(await testToken.totalSupply()).to.equal(amount);
      expect(await testToken.balanceOf(user.address)).to.equal(amount);
    });

    it("should revert if mint exceeds max supply", async () => {
      await testToken.connect(minter).mint(user.address, INIT_SUPPLY);
      await expect(testToken.connect(minter).mint(user.address, ethers.parseEther("1"))).to.be.revertedWithCustomError(
        testToken,
        "MaxSupplyOutOfBound"
      );
    });

    it("should not allow non-minter to mint", async () => {
      await expect(testToken.connect(user).mint(user.address, 1)).to.be.revertedWithCustomError(
        testToken,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Burning", () => {
    it("should allow burner to burn tokens", async () => {
      const amount = ethers.parseEther("500");
      await testToken.connect(minter).mint(user.address, amount);
      await testToken.connect(user).approve(burner.address, amount);
      await testToken.connect(burner).burn(user.address, amount);
      expect(await testToken.balanceOf(user.address)).to.equal(0);
    });

    it("should not allow non-burner to burn", async () => {
      const amount = ethers.parseEther("500");
      await testToken.connect(minter).mint(user.address, amount);
      await expect(testToken.connect(user).burn(user.address, amount)).to.be.revertedWithCustomError(
        testToken,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Max Supply", () => {
    it("admin can increase max supply", async () => {
      const newMax = INIT_SUPPLY + ethers.parseEther("1000");
      await expect(testToken.connect(admin).setMaxTotalSupply(newMax))
        .to.emit(testToken, "MaxSupplyChanged")
        .withArgs(newMax);
      expect(await testToken.maxTotalSupply()).to.equal(newMax);
    });

    it("should revert if new max supply < current total supply", async () => {
      const mintAmount = ethers.parseEther("1000");
      await testToken.connect(minter).mint(user.address, mintAmount);
      await expect(testToken.connect(admin).setMaxTotalSupply(mintAmount - 1n)).to.be.revertedWithCustomError(
        testToken,
        "CannotBeLessThanTotalSupply"
      );
    });

    it("should not allow non-admin to set max supply", async () => {
      await expect(testToken.connect(user).setMaxTotalSupply(INIT_SUPPLY + 1n)).to.be.revertedWithCustomError(
        testToken,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Blacklist", () => {
    it("should block transfers _to or _from blacklisted addresses", async () => {
      await testToken.connect(minter).mint(user.address, 100);

      await testToken.setBlacklist(user.address, true);
      await expect(testToken.connect(user).transfer(user2.address, 100)).to.be.revertedWithCustomError(testToken, "SenderIsBlacklisted");

      await testToken.setBlacklist(user.address, false);

      await testToken.setBlacklist(user2.address, true);
      await expect(testToken.connect(user).transfer(user2.address, 100)).to.be.revertedWithCustomError(testToken, "RecipientIsBlacklisted");

      await testToken.setBlacklist(user2.address, false);

      await testToken.connect(user).transfer(user2.address, 100);
      expect(await testToken.balanceOf(user2.address)).to.equal(100);
    });

    it("should emit BlacklistChanged event", async () => {
      await expect(testToken.setBlacklist(user.address, true))
        .to.emit(testToken, "BlacklistChanged")
        .withArgs(user.address, true);
    });
  });

  describe("Send Fee", () => {
    it("should apply fee on transfer", async () => {
      await testToken.setSendFee(1000); // 10%
      const amount = ethers.parseEther("100");

      await testToken.connect(minter).mint(user.address, amount);

      await testToken.connect(user).transfer(user2.address, amount);

      const expectedReceived = amount * 9000n / 10000n; // 90%
      expect(await testToken.balanceOf(user2.address)).to.equal(expectedReceived);
    });

    it("should revert if fee is > 100%", async () => {
      await expect(testToken.setSendFee(10001)).to.be.revertedWithCustomError(testToken, "SendFeeIsMoreThan100Percent");
    });

    it("should emit SendFeeChanged", async () => {
      await expect(testToken.setSendFee(500)).to.emit(testToken, "SendFeeChanged").withArgs(500);
    });

    it("should not apply fee to transferFrom", async () => {
      const amount = ethers.parseEther("100");
      await testToken.connect(user).approve(user2.address, 1000);
      await testToken.connect(minter).mint(user.address, amount);
      await testToken.connect(user2).transferFrom(user.address, user2.address, 100);
      expect(await testToken.balanceOf(user2.address)).to.equal(100);
    });
  });

  describe("Upgrades", () => {
    it("should allow upgrader role to upgrade", async () => {
      const TestTokenV2 = await ethers.getContractFactory("TestToken");
      await upgrades.upgradeProxy(await testToken.getAddress(), TestTokenV2.connect(upgrader));
    });

    it("should reject upgrades from unauthorized account", async () => {
      const TestTokenV2 = await ethers.getContractFactory("TestToken");
      await expect(
        upgrades.upgradeProxy(await testToken.getAddress(), TestTokenV2.connect(user))
      ).to.be.revertedWithCustomError(testToken, "AccessControlUnauthorizedAccount");
    });
  });
});
