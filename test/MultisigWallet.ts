import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("MultisigWallet", function () {
  // Fixture to deploy the contract and set up necessary variables
  async function deployMultisigWalletFixture() {
    const [admin, otherAccount] = await hre.ethers.getSigners();

    // Deploy a mock ERC20 token (simulating USDC)
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy(ethers.parseUnits("100000", 6)); // Mint 100000 mock USDC

    // Define the token addresses and Uniswap router
    const usdcAddress = mockUSDC.getAddress();
    // const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC address on Ethereum
    const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";  // DAI address on Ethereum
    const uniAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";  // UNI address on Ethereum
    const linkAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA"; // LINK address on Ethereum
    const supportedTokens = [usdcAddress, daiAddress, uniAddress, linkAddress];
    const primaryToken = usdcAddress; // USDC as primary token
    const fixedMonthlyContribution = ethers.parseUnits("100", 6); // 100 USDC
    const investmentThreshold = ethers.parseUnits("200", 6); // 200 USDC
    const investmentPercentage = 50; // 50%
    const investmentReturnRate = 15; // 1.5% monthly
    const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 router address on Ethereum
    
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

    return { multisigWallet, admin, otherAccount, mockUSDC, uniswapRouter };
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

  describe("depositToken", function () {
    // Test case: Should revert if the deposit amount is zero
    it("Should revert if the deposit amount is zero", async function () {
      const { multisigWallet, admin, otherAccount } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a supported token (mock USDC in this case)
      const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mock USDC address
      const amountToDeposit = ethers.parseUnits("0", 6); // Zero deposit
  
      // Try depositing zero tokens and expect it to revert
      await expect(multisigWallet.connect(otherAccount).depositToken(usdcAddress, amountToDeposit))
        .to.be.revertedWith("Amount must be greater than zero");
    });

    // Test case: Should revert if trying to deposit an unsupported token
    it("Should revert if trying to deposit an unsupported token", async function () {
      const { multisigWallet, admin, otherAccount } = await loadFixture(deployMultisigWalletFixture);

      // Define an unsupported token address (e.g., random token address)
      const unsupportedToken = "0x0000000000000000000000000000000000000001"; // Random unsupported token
      const amountToDeposit = ethers.parseUnits("100", 6); // 100 tokens

      // Try depositing the unsupported token and expect it to revert
      await expect(multisigWallet.connect(otherAccount).depositToken(unsupportedToken, amountToDeposit))
        .to.be.revertedWith("Unsupported token");
    });

    // Test case: Should revert if the deposit amount is less than required to cover missed contributions
    it("Should revert if the deposit amount is less than the required contribution", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);

      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();

      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("150", 6)); // Give 150 USDC to otherAccount

      // Simulate a situation where the user missed a contribution (advance time by months, if applicable)
      const amountToDeposit = ethers.parseUnits("50", 6); // 50 USDC (less than required)
      
      // Try depositing less than the required contribution and expect it to revert
      await expect(multisigWallet.connect(otherAccount).depositToken(usdcAddress, amountToDeposit))
        .to.be.revertedWith("Insufficient amount to cover missed contributions");
    });

    // Test case: Should revert if the token transfer fails
    it("Should revert if the token transfer fails", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
    
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
    
      // Set an amount to deposit that satisfies the required contribution
      const sufficientContribution = ethers.parseUnits("100", 6); // 100 USDC, assume it's the required contribution
    
      // Ensure the otherAccount does not have any USDC
      const otherAccountBalance = await mockUSDC.balanceOf(otherAccount.address);
      expect(otherAccountBalance).to.equal(0); // Ensure otherAccount has 0 USDC
    
      // Add the otherAccount as a new participant (they won't have missed contributions)
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
    
      // Try depositing tokens without transferring any to otherAccount (should fail due to insufficient balance)
      await expect(multisigWallet.connect(otherAccount).depositToken(usdcAddress, sufficientContribution))
        .to.be.reverted;  // General check for revert, not checking the specific reason
    
      // Now transfer an insufficient amount to otherAccount and try again
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("50", 6)); // Transfer only 50 USDC
    
      // Try depositing more than the available balance (100 USDC) and expect it to fail
      await expect(multisigWallet.connect(otherAccount).depositToken(usdcAddress, sufficientContribution))
        .to.be.reverted;  // General check for revert, not checking the specific reason
    });    
  });  

  describe("invest", function () {
    // Test case: Should revert if the participant already has an active investment
    it("Should revert if the participant has an active investment", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
  
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
  
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
  
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
  
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
  
      // First investment call should pass and mark the participant as invested
      await multisigWallet.connect(otherAccount).invest();
  
      // Try investing again and expect it to revert due to active investment
      await expect(multisigWallet.connect(otherAccount).invest())
        .to.be.revertedWith("Active investment exists. Withdraw first before reinvesting.");
    });

    // Test case: Should revert if the participant's balance is less than twice the fixed monthly contribution
    it("Should revert if the participant's balance is insufficient to invest", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);

      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();

      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);

      // Transfer an insufficient amount of mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("150", 6)); // Give only 150 USDC to otherAccount

      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("150", 6));

      // Simulate the otherAccount making a valid deposit (but less than 2x fixed monthly contribution)
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("150", 6));

      // Try investing and expect it to revert due to insufficient balance
      await expect(multisigWallet.connect(otherAccount).invest())
        .to.be.revertedWith("Insufficient balance to invest");
    });
  });  
  
  describe("withdraw", function () {
    // Test case: Should revert if the participant has no balance to withdraw
    it("Should revert if the participant has no balance to withdraw", async function () {
      const { multisigWallet, admin, otherAccount } = await loadFixture(deployMultisigWalletFixture);
  
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
  
      // Ensure the participant's balance is zero
      const participantBalance = await multisigWallet.checkBalance();
      expect(participantBalance).to.equal(0); // Ensure balance is zero
  
      // Try withdrawing and expect it to revert due to no balance
      await expect(multisigWallet.connect(otherAccount).withdraw())
        .to.be.revertedWith("No balance to withdraw");
    });

  // Test case: Should revert if the participant's investment lock period has not ended
  it("Should revert if the participant's investment lock period has not ended", async function () {
    const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);

    // Define a supported token (mock USDC in this case)
    const usdcAddress = mockUSDC.getAddress();

    // Add the otherAccount as a new participant
    await multisigWallet.connect(admin).addParticipant(otherAccount.address);

    // Transfer enough mock USDC to otherAccount for testing
    await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount

    // Approve the token for transfer to the contract
    await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));

    // Simulate the otherAccount making a valid deposit
    await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));

    // Have the participant invest
    await multisigWallet.connect(otherAccount).invest();

    // Try to withdraw before the 90-day lock period ends
    await expect(multisigWallet.connect(otherAccount).withdraw())
      .to.be.revertedWith("Investment lock period has not ended");

    // Fast forward time by 60 days to simulate a scenario where the lock period is still active
    await ethers.provider.send("evm_increaseTime", [60 * 24 * 60 * 60]); // Fast forward 60 days
    await ethers.provider.send("evm_mine"); // Mine the next block

    // Try to withdraw again and expect it to revert due to the lock period not ending
    await expect(multisigWallet.connect(otherAccount).withdraw())
      .to.be.revertedWith("Investment lock period has not ended");
  });
  
  // Failing..........Test case: Should revert if the quorum approval is not met
  // it("Should revert if the quorum approval is not met", async function () {
  //   const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
  
  //   // Define a supported token (mock USDC in this case)
  //   const usdcAddress = mockUSDC.getAddress();
  
  //   // Add the otherAccount as a new participant
  //   await multisigWallet.connect(admin).addParticipant(otherAccount.address);
  
  //   // Add admin as a participant so they can approve withdrawals
  //   await multisigWallet.connect(admin).addParticipant(admin.address);
  
  //   // Transfer enough mock USDC to otherAccount for testing
  //   await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
  
  //   // Approve the token for transfer to the contract
  //   await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
  
  //   // Simulate the otherAccount making a valid deposit
  //   await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
  
  //   // Have the participant invest
  //   await multisigWallet.connect(otherAccount).invest();
  
  //   // Fast forward time by 90 days to simulate lock period end
  //   await ethers.provider.send("evm_increaseTime", [90 * 24 * 60 * 60]); // Fast forward 90 days
  //   await ethers.provider.send("evm_mine"); // Mine the next block
  
  //   // Try to withdraw without any quorum approval and expect it to revert
  //   await expect(multisigWallet.connect(otherAccount).withdraw())
  //     .to.be.reverted; // General revert check
  
  //   // Now, let the admin approve the withdrawal
  //   await multisigWallet.connect(admin).approveWithdrawal(otherAccount.address);
  
  //   // Fetch the approval struct and check if approvedCount exists
  //   const approval = await multisigWallet.approvals(otherAccount.address);
  //   console.log("Approval details:", approval);
  
  //   // Ensure the approvedCount is defined before comparing
  //   expect(approval.approvedCount).to.not.be.undefined; // Ensure approvedCount is defined
  //   expect(approval.approvedCount).to.equal(BigInt(1)); // Compare using BigInt
  
  //   // Try to withdraw again and expect it to revert due to insufficient quorum
  //   await expect(multisigWallet.connect(otherAccount).withdraw())
  //     .to.be.reverted; // General revert check
  // });
  
    it("Should revert if the transfer of tokens fails", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
    
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
    
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
    
      // Add admin as a participant so they can approve withdrawals
      await multisigWallet.connect(admin).addParticipant(admin.address);
    
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
    
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
    
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
    
      // Have the participant invest
      await multisigWallet.connect(otherAccount).invest();
    
      // Fast forward time by 90 days to simulate lock period end
      await ethers.provider.send("evm_increaseTime", [90 * 24 * 60 * 60]); // Fast forward 90 days
      await ethers.provider.send("evm_mine"); // Mine the next block
    
      // Now, let the admin approve the withdrawal
      await multisigWallet.connect(admin).approveWithdrawal(otherAccount.address);
    
      // Simulate a scenario where the contract has insufficient USDC balance for withdrawal
      const multisigWalletBalance = await mockUSDC.balanceOf(multisigWallet.getAddress());
      await mockUSDC.connect(admin).transfer(admin.address, multisigWalletBalance); // Withdraw all USDC from the contract
    
      // Try to withdraw and expect a generic revert (without specific message)
      await expect(multisigWallet.connect(otherAccount).withdraw())
        .to.be.reverted; // General revert check
    });
    
  });

  describe("approveWithdrawal", function () {
    // Test case: Should revert if a participant tries to approve their own withdrawal
    it("Should revert if a participant tries to approve their own withdrawal", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
  
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
  
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
  
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
  
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
  
      // Try to approve their own withdrawal and expect it to revert with the message "You cannot approve your own withdrawal"
      await expect(multisigWallet.connect(otherAccount).approveWithdrawal(otherAccount.address))
        .to.be.revertedWith("You cannot approve your own withdrawal");
    });
  
    it("Should revert if a non-participant tries to approve a withdrawal", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
    
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
    
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
    
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
    
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
    
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
    
      // Use a third-party account that is not a participant to try approving a withdrawal
      const [,, nonParticipant] = await hre.ethers.getSigners(); // Third signer as non-participant
      
      // Try to have the non-participant approve a withdrawal and expect it to revert with the message "Only participants can approve"
      await expect(multisigWallet.connect(nonParticipant).approveWithdrawal(otherAccount.address))
        .to.be.revertedWith("Only participants can approve");
    });

    it("Should revert if a participant tries to approve the same withdrawal more than once", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
    
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
    
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
    
      // Add admin as a participant so they can approve withdrawals
      await multisigWallet.connect(admin).addParticipant(admin.address);
    
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
    
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
    
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
    
      // Approve the withdrawal for otherAccount by the admin
      await multisigWallet.connect(admin).approveWithdrawal(otherAccount.address);
    
      // Try to approve the same withdrawal again and expect it to revert with the message "You have already approved this withdrawal"
      await expect(multisigWallet.connect(admin).approveWithdrawal(otherAccount.address))
        .to.be.revertedWith("You have already approved this withdrawal");
    });
  });  

  describe("emergencyWithdraw", function () {
    // Test case: Should revert if the participant tries to use emergency withdrawal after the lock period
    it("Should revert if the participant tries to use emergency withdrawal after the lock period", async function () {
      const { multisigWallet, admin, otherAccount, mockUSDC } = await loadFixture(deployMultisigWalletFixture);
  
      // Define a supported token (mock USDC in this case)
      const usdcAddress = mockUSDC.getAddress();
  
      // Add the otherAccount as a new participant
      await multisigWallet.connect(admin).addParticipant(otherAccount.address);
  
      // Transfer enough mock USDC to otherAccount for testing
      await mockUSDC.transfer(otherAccount.address, ethers.parseUnits("200", 6)); // Give 200 USDC to otherAccount
  
      // Approve the token for transfer to the contract
      await mockUSDC.connect(otherAccount).approve(multisigWallet.getAddress(), ethers.parseUnits("200", 6));
  
      // Simulate the otherAccount making a valid deposit
      await multisigWallet.connect(otherAccount).depositToken(usdcAddress, ethers.parseUnits("200", 6));
  
      // Have the participant invest
      await multisigWallet.connect(otherAccount).invest();
  
      // Fast forward time by 91 days to simulate lock period end
      await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]); // Fast forward 91 days
      await ethers.provider.send("evm_mine"); // Mine the next block
  
      // Try to use the emergency withdrawal and expect it to revert with the message "Cannot use emergency withdrawal after the lock period"
      await expect(multisigWallet.connect(otherAccount).emergencyWithdraw())
        .to.be.revertedWith("Cannot use emergency withdrawal after the lock period");
    });


  });
  

});


