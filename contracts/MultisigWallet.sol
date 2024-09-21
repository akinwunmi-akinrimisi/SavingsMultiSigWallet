// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import necessary OpenZeppelin contracts for security and ERC20 token functionality
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol"; // Import Uniswap V2 router

contract MultisigWallet is Ownable {
    // Core state variables
    struct Participant {
        address participantAddress;
        uint256 balance; // Balance in primary token
        uint256 missedContributions; // Tracks how much was missed in contributions
        uint256 lastContributionTimestamp; // Last time they contributed
        uint256 investmentEarnings; // Interest/earnings from investment
        uint256 withdrawalTimestamp; // Last time they made a withdrawal
        uint256 investmentStartTimestamp; // When the participant's investment started
        bool isInvested; // True if the participant has locked funds in investment
        uint256 investedAmount; // The amount of principal invested
        uint256 nextInterestTimestamp; // When the next interest payout is due
        uint256 interestEarned; // Total interest earned over the investment period
    }

    struct Approval {
        mapping(address => bool) hasApproved;
        uint256 approvedCount;
    }

    mapping(address => Approval) public approvals;
    mapping(address => Participant) public participants;
    uint256 public participantCount;
    uint256 public fixedMonthlyContribution; // Fixed amount to contribute monthly
    IERC20 public primaryToken; // The token in which savings are stored (e.g., USDC)
    address[] public participantAddresses;

    // Supported tokens and swap functionality
    mapping(address => bool) public supportedTokenAddresses; // Mapping to check supported tokens
    address public uniswapRouter; // Address of the Uniswap V2 router
    uint256 public slippageTolerance = 100; // 1% slippage tolerance

    // Investment and interest
    uint256 public investmentThreshold; // Minimum balance required for investment
    uint256 public investmentPercentage; // Percentage of total savings to invest
    uint256 public investmentReturnRate; // Monthly interest rate (e.g., 2%)
    uint256 public investmentBalance; // Funds allocated for investment
    uint256 public lastInterestDistributionTimestamp; // Timestamp of last interest payout
    uint256 public monthlyInterestRate = 15; // Representing 1.5% (15 per thousand)


    // Withdrawals
    uint256 public withdrawalFee = 5; // Standard withdrawal fee (5%)
    uint256 public emergencyWithdrawalFee = 10; // Emergency withdrawal fee (10%)
    mapping(address => uint256) public withdrawalTimestamps;

    // Voting and quorum mechanism
    struct Proposal {
        uint256 proposalId;
        string proposalType; // "withdrawal", "investment", etc.
        address initiator;
        uint256 voteCount;
        uint256 timestamp;
        bool approved;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public votes; // Tracks votes for each proposal
    uint256 public quorum; // Quorum for votes

    // Transaction logs
    struct TransactionLog {
        uint256 amount;
        string transactionType; // "deposit", "swap", "withdrawal", etc.
        uint256 timestamp;
    }

    mapping(address => TransactionLog[]) public transactionLogs; // Logs each participant's transactions

    // General contract parameters
    uint256 public totalSavings; // Total amount saved in the wallet
    uint256 public totalParticipants; // Total active participants
    bool public active = true; // Whether the contract is active

    // Events
    event ContributionMade(address indexed participant, uint256 amount);
    event WithdrawalMade(address indexed participant, uint256 amount, uint256 fee);
    event EmergencyWithdrawal(address indexed participant, uint256 amount, uint256 fee);
    event InvestmentMade(uint256 amount);
    event InterestDistributed(uint256 amount);
    event ParticipantAdded(address indexed participant, uint256 timestamp);
    event SwapCompleted(address indexed participant, address tokenIn, uint256 amountIn, uint256 amountOut);
    event InvestmentStarted(address indexed participant, uint256 amount);
    // Event for when a participant makes an emergency withdrawal
    event EmergencyWithdrawal(address indexed participant, uint256 amountWithdrawn, uint256 fee);

    // Event for when a participant withdraws both their principal and interest after investment
    event PrincipalAndInterestWithdrawn(address indexed participant, uint256 totalWithdrawAmount);
    // Event for when a participant makes a regular withdrawal (non-invested participants)
    event WithdrawalMade(address indexed participant, uint256 amountWithdrawn, uint256 fee);

    // Event for when a participant approves a withdrawal
    event WithdrawalApproved(address indexed participant, address indexed approver);

    // Event for updating the fixed monthly contribution
    event MonthlyContributionUpdated(uint256 newContribution);

    // Event for updating the withdrawal fee
    event WithdrawalFeeUpdated(uint256 newWithdrawalFee);

    // Event for updating the interest rate
    event InterestRateUpdated(uint256 newInterestRate);


    modifier onlyWhenActive() {
        require(active, "Contract is not active");
        _;
    }

    // Constructor to initialize the primary token, supported tokens, and Uniswap router
    constructor(
        address _primaryToken,
        address[] memory _supportedTokens,
        uint256 _fixedMonthlyContribution,
        uint256 _investmentThreshold,
        uint256 _investmentPercentage,
        uint256 _investmentReturnRate,
        address _uniswapRouter // Uniswap V2 router address
    ) {
        primaryToken = IERC20(_primaryToken);

        // Add supported tokens to the mapping
        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            supportedTokenAddresses[_supportedTokens[i]] = true; // Mark token as supported
        }

        fixedMonthlyContribution = _fixedMonthlyContribution;
        investmentThreshold = _investmentThreshold;
        investmentPercentage = _investmentPercentage;
        investmentReturnRate = _investmentReturnRate;
        lastInterestDistributionTimestamp = block.timestamp;
        uniswapRouter = _uniswapRouter; // Set the Uniswap V2 router address
    }

    // Function to add participants (must be owner/admin)
    function addParticipant(address _participant) external onlyOwner {
        require(_participant != address(0), "Invalid participant address");
        require(participants[_participant].participantAddress == address(0), "Participant already exists");

        participants[_participant].participantAddress = _participant;
        participants[_participant].balance = 0;
        participants[_participant].missedContributions = 0;
        participants[_participant].lastContributionTimestamp = block.timestamp;
        participants[_participant].investmentEarnings = 0;
        participants[_participant].withdrawalTimestamp = 0;

        participantAddresses.push(_participant);
        participantCount++;
        totalParticipants++;

        emit ParticipantAdded(_participant, block.timestamp);
    }

    // Function to deposit tokens (either the primary token or supported tokens)
    function depositToken(address _token, uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        require(supportedTokenAddresses[_token], "Unsupported token");

        // Calculate missed contribution cycles and required contribution
        uint256 lastContributionTime = participants[msg.sender].lastContributionTimestamp;
        uint256 missedCycles = (block.timestamp - lastContributionTime) / 30 days;
        uint256 requiredContribution = fixedMonthlyContribution * (missedCycles + 1);

        // Ensure the deposit amount covers missed contributions
        require(_amount >= requiredContribution, "Insufficient amount to cover missed contributions");

        // Handle primary token deposit
        if (_token == address(primaryToken)) {
            // Transfer USDC to the contract
            require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

            // Update the participant's balance and reset missed contributions
            participants[msg.sender].balance += _amount;
            participants[msg.sender].missedContributions = 0;
            participants[msg.sender].lastContributionTimestamp = block.timestamp;

            // Emit the contribution event
            emit ContributionMade(msg.sender, _amount);


        } else {
            // Swap non-primary token into USDC
            swapToken(_token, _amount);
        }
    }


    // Function to swap tokens to the primary token (USDC)
    function swapToken(address _token, uint256 _amount) internal {
        require(supportedTokenAddresses[_token], "Token is not supported");
        require(IERC20(_token).allowance(msg.sender, address(this)) >= _amount, "Insufficient token allowance");

        // Transfer the tokens from the user to the contract
        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        // Approve Uniswap router to spend the tokens
        IERC20(_token).approve(uniswapRouter, _amount);

        // Define the swap path (token -> USDC)
        address[] memory path = new address[](2);
        path[0] = _token; // Input token (DAI, UNI, or LINK)
        path[1] = address(primaryToken); // Output token (USDC)

        // Calculate minimum amount of USDC to accept based on slippage tolerance
        uint256 amountOutMin = getAmountOutMin(_token, _amount);

        // Perform the swap on Uniswap
        IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            _amount, // Amount of input tokens
            amountOutMin, // Minimum amount of USDC to receive (after slippage)
            path, // Path for the swap
            address(this), // Recipient is the contract
            block.timestamp + 300 // Deadline (5 minutes from now)
        );

        // Get the balance of USDC after the swap
        uint256 usdcBalanceAfterSwap = IERC20(primaryToken).balanceOf(address(this));

        // Update the participant's balance with the received USDC
        participants[msg.sender].balance += usdcBalanceAfterSwap;
        participants[msg.sender].lastContributionTimestamp = block.timestamp;

        // Emit a swap completion event
        emit SwapCompleted(msg.sender, _token, _amount, usdcBalanceAfterSwap);
    }

    // Helper function to calculate the minimum amount of USDC based on slippage
    function getAmountOutMin(address _token, uint256 _amount) internal view returns (uint256) {
        // Get the current exchange rates from Uniswap
        uint256[] memory amounts = IUniswapV2Router02(uniswapRouter).getAmountsOut(_amount, getPathForTokenToUSDC(_token));

        // Calculate minimum amount of USDC, considering slippage tolerance
        return amounts[1] - (amounts[1] * slippageTolerance / 10000);
    }

    // Helper function to define the swap path for Uniswap (token -> USDC)
    function getPathForTokenToUSDC(address _token) internal view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = _token; // Input token
        path[1] = address(primaryToken); // Output token (USDC)
        return path;
    }

    function invest() external {
        Participant storage participant = participants[msg.sender];
        // Check if the participant is already invested
        require(!participant.isInvested, "Active investment exists. Withdraw first before reinvesting.");
        require(participant.balance >= 2 * fixedMonthlyContribution, "Insufficient balance to invest");

        // Use the participant's total balance for investing
        uint256 amountToInvest = participant.balance;

        // Mark the participant as invested and lock the funds
        participant.isInvested = true;
        participant.investmentStartTimestamp = block.timestamp;
        participant.investedAmount = amountToInvest;
        participant.nextInterestTimestamp = block.timestamp + 30 days;

        // Emit an event for investment start
        emit InvestmentStarted(msg.sender, amountToInvest);
    }

    function withdraw() external {
        Participant storage participant = participants[msg.sender];
        require(participant.balance > 0, "No balance to withdraw");

        // Check if the participant is invested
        if (participant.isInvested) {
            // Ensure the 3-month lock period has passed
            require(block.timestamp >= participant.investmentStartTimestamp + 90 days, "Investment lock period has not ended");

            // Ensure quorum approval is met before proceeding with withdrawal
            require(approvals[msg.sender].approvedCount >= totalParticipants - 1, "Quorum approval not met");

            // Calculate interest based on how many months have passed since investment start
            uint256 monthsInvested = (block.timestamp - participant.investmentStartTimestamp) / 30 days;
            uint256 totalInterest = (participant.investedAmount * monthlyInterestRate * monthsInvested) / 1000;

            // Calculate total withdrawal amount (principal + interest)
            uint256 totalWithdrawAmount = participant.investedAmount + totalInterest;

            // Reset investment details
            participant.isInvested = false;
            participant.investedAmount = 0;
            participant.interestEarned = 0;
            participant.investmentStartTimestamp = 0;
            participant.nextInterestTimestamp = 0;

            // Transfer the total withdrawal amount to the participant
            require(IERC20(primaryToken).transfer(msg.sender, totalWithdrawAmount), "Transfer failed");

            // Emit withdrawal event
            emit PrincipalAndInterestWithdrawn(msg.sender, totalWithdrawAmount);
        } else {
            // For non-investors, allow regular withdrawal with a 5% fee
            require(approvals[msg.sender].approvedCount >= totalParticipants - 1, "Quorum approval not met");

            uint256 amountToWithdraw = participant.balance;
            uint256 fee = (amountToWithdraw * withdrawalFee) / 100;
            uint256 finalWithdrawAmount = amountToWithdraw - fee;

            // Reset the participant's balance
            participant.balance = 0;

            // Transfer the final amount to the participant
            require(IERC20(primaryToken).transfer(msg.sender, finalWithdrawAmount), "Transfer failed");

            // Emit withdrawal event
            emit WithdrawalMade(msg.sender, finalWithdrawAmount, fee);
        }

            // Reset approval count after successful withdrawal
            approvals[msg.sender].approvedCount = 0;
    }


    // Function for participants to approve a withdrawal request
    function approveWithdrawal(address participant) external {
        require(participant != msg.sender, "You cannot approve your own withdrawal");
        require(participants[msg.sender].participantAddress != address(0), "Only participants can approve");

        // Ensure the participant hasn't already approved this withdrawal
        require(!approvals[participant].hasApproved[msg.sender], "You have already approved this withdrawal");

        // Mark the participant as having approved
        approvals[participant].hasApproved[msg.sender] = true;
        approvals[participant].approvedCount++;

        // Emit an event for the approval
        emit WithdrawalApproved(participant, msg.sender);
    }


    function emergencyWithdraw() external {
        Participant storage participant = participants[msg.sender];

        // Check if the participant has a balance or is invested
        if (participant.isInvested) {
            // The participant is still within the lock period but wants to withdraw early
            require(block.timestamp < participant.investmentStartTimestamp + 90 days, "Cannot use emergency withdrawal after the lock period");
            require(participant.investedAmount > 0, "No invested balance to withdraw");

            // Calculate interest earned up to this point
            uint256 monthsInvested = (block.timestamp - participant.investmentStartTimestamp) / 30 days;
            uint256 totalInterest = (participant.investedAmount * monthlyInterestRate * monthsInvested) / 1000;

            // Calculate the total amount to withdraw (principal + interest)
            uint256 totalWithdrawAmount = participant.investedAmount + totalInterest;

            // Apply emergency withdrawal fee (10%)
            uint256 fee = (totalWithdrawAmount * emergencyWithdrawalFee) / 100;
            uint256 finalWithdrawAmount = totalWithdrawAmount - fee;

            // Reset the participant's investment status
            participant.isInvested = false;
            participant.investedAmount = 0;
            participant.interestEarned = 0;
            participant.investmentStartTimestamp = 0;
            participant.nextInterestTimestamp = 0;

            // Transfer the final withdrawal amount to the participant
            require(IERC20(primaryToken).transfer(msg.sender, finalWithdrawAmount), "Transfer failed");

            // Emit an event for emergency withdrawal
            emit EmergencyWithdrawal(msg.sender, finalWithdrawAmount, fee);
        } else {
            // For non-invested participants, check if they have a balance
            require(participant.balance > 0, "No balance to withdraw");

            // Apply the emergency withdrawal fee (10%)
            uint256 amountToWithdraw = participant.balance;
            uint256 fee = (amountToWithdraw * emergencyWithdrawalFee) / 100;
            uint256 finalWithdrawAmount = amountToWithdraw - fee;

            // Reset the participant's balance
            participant.balance = 0;

            // Transfer the final amount to the participant
            require(IERC20(primaryToken).transfer(msg.sender, finalWithdrawAmount), "Transfer failed");

            // Emit an event for emergency withdrawal
            emit EmergencyWithdrawal(msg.sender, finalWithdrawAmount, fee);
        }
    }

    function updateMonthlyContribution(uint256 _newContribution) external onlyOwner {
        require(_newContribution > 0, "Contribution must be greater than zero");
        fixedMonthlyContribution = _newContribution;

        emit MonthlyContributionUpdated(_newContribution);
    }

    function updateWithdrawalFee(uint256 _newWithdrawalFee) external onlyOwner {
        require(_newWithdrawalFee >= 0 && _newWithdrawalFee <= 100, "Fee must be between 0 and 100");
        withdrawalFee = _newWithdrawalFee;

        emit WithdrawalFeeUpdated(_newWithdrawalFee);
    }


    function updateInterestRate(uint256 _newInterestRate) external onlyOwner {
        require(_newInterestRate >= 0, "Interest rate must be non-negative");
        monthlyInterestRate = _newInterestRate;

        emit InterestRateUpdated(_newInterestRate);
    }


    function checkBalance() external view returns (uint256) {
        Participant storage participant = participants[msg.sender];
        return participant.balance;
    }

    function checkInterestEarned() external view returns (uint256) {
        Participant storage participant = participants[msg.sender];
        
        if (!participant.isInvested) {
            return 0; // No interest earned if not invested
        }

        // Calculate interest earned so far
        uint256 monthsInvested = (block.timestamp - participant.investmentStartTimestamp) / 30 days;
        uint256 totalInterest = (participant.investedAmount * monthlyInterestRate * monthsInvested) / 1000;

        return totalInterest;
    }

    function timeLeftToWithdraw() external view returns (uint256) {
        Participant storage participant = participants[msg.sender];
        
        if (!participant.isInvested) {
            return 0; // No time left if not invested
        }

        // Calculate the time left before the 3-month lock period ends
        uint256 timeSinceInvestment = block.timestamp - participant.investmentStartTimestamp;
        if (timeSinceInvestment >= 90 days) {
            return 0; // Lock period has ended
        }

        return (90 days - timeSinceInvestment);
    }


}
