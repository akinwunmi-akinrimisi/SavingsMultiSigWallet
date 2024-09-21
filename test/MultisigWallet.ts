import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("MultisigWallet", function () {
  // Fixture to deploy the contract and set up necessary variables
  async function deployMultisigWalletFixture() {
    const [admin, otherAccount] = await hre.ethers.getSigners();

    // Define the token addresses and Uniswap router
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC address on Ethereum
    const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";  // DAI address on Ethereum
    const uniAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";  // UNI address on Ethereum
    const linkAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA"; // LINK address on Ethereum
    const supportedTokens = [usdcAddress, daiAddress, uniAddress, linkAddress];
    const primaryToken = usdcAddress; // USDC as primary token
    const fixedMonthlyContribution = ethers.parseUnits("100", 6); // 100 USDC
    const investmentThreshold = ethers.parseUnits("200", 6); // 200 USDC
    const investmentPercentage = 50; // 50%
    const investmentReturnRate = 15; // 1.5% monthly
    const uniswapRouter = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // Uniswap V2 router address on Ethereum

    // Deploy the MultisigWallet contract with the constructor arguments
    const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");
    const multisigWallet = await MultisigWallet.deploy(
      primaryToken,
      supportedTokens,
      fixedMonthlyContribution,
      investmentThreshold,
      investmentPercentage,
      investmentReturnRate,
      uniswapRouter
    );

    return { multisigWallet, admin, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy the MultisigWallet contract correctly", async function () {
      const { multisigWallet, admin } = await loadFixture(deployMultisigWalletFixture);

      // Validate the admin is correctly set
      expect(await multisigWallet.owner()).to.equal(admin.address);
    });
  });
  
  // Test suite for the addParticipant function
  describe("addParticipant", function () {
    // Test case: Adding a participant with the zero address should revert
    it("Should revert if trying to add a participant with the zero address", async function () {
      const { multisigWallet, admin } = await loadFixture(deployMultisigWalletFixture);

      // Try adding a participant with the zero address and expect it to revert
      await expect(multisigWallet.addParticipant(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid participant address");
    });

    // Test case: Should revert if trying to add an existing participant
    it("Should revert if trying to add a participant that already exists", async function () {
      const { multisigWallet, admin, otherAccount } = await loadFixture(deployMultisigWalletFixture);

      // Add a valid participant first
      await multisigWallet.addParticipant(otherAccount.address);

      // Try adding the same participant again and expect it to revert
      await expect(multisigWallet.addParticipant(otherAccount.address))
        .to.be.revertedWith("Participant already exists");
    });
  });


  describe("swapToken", function () {
    // Test case: Should revert if trying to swap an unsupported token
    it("Should revert if trying to swap an unsupported token", async function () {
      const { multisigWallet, admin } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a token address that is not in the supportedTokens list (random address)
      const unsupportedToken = "0x0000000000000000000000000000000000000001";
  
      // Try swapping with an unsupported token and expect it to revert
      await expect(multisigWallet.swapToken(unsupportedToken, ethers.parseUnits("100", 6)))
        .to.be.revertedWith("Token is not supported");
    });
  
    // Test case: Should revert if token allowance is insufficient
    it("Should revert if the token allowance is insufficient", async function () {
      const { multisigWallet, admin, otherAccount } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a supported token (USDC in this case)
      const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  
      // Ensure no allowance is set
      const amountToSwap = ethers.parseUnits("100", 6); // 100 USDC
  
      // Try swapping without sufficient allowance and expect it to revert
      await expect(multisigWallet.swapToken(usdcAddress, amountToSwap))
        .to.be.revertedWith("Insufficient token allowance");
    });
  });
  
  
});
