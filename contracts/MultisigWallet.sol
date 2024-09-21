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

}
