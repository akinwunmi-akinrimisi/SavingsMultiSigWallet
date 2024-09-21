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
    }

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

        // If the token is the primary saving token (USDC), directly deposit
        if (_token == address(primaryToken)) {
            // Transfer USDC to the contract
            require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

            // Update the participant's balance
            participants[msg.sender].balance += _amount;
            participants[msg.sender].lastContributionTimestamp = block.timestamp;

            // Emit the event
            emit ContributionMade(msg.sender, _amount);
        } else {
            // If the token is not USDC, call the swap function
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
}
