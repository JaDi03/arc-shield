// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for standard ERC20 token operations (USDC has 6 decimals on Arc).
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title ArcShield
 * @dev On-chain security guardrail contract for AI agents transacting on Arc Network.
 * It enforces spending limits, allowlists, and emergency mechanisms at the smart contract level.
 */
contract ArcShield {
    // Ownership and Roles
    address public owner;
    address public agent;
    
    // Deployed ERC-20 USDC token address on Arc Testnet: 0x3600000000000000000000000000000000000000
    address public immutable usdc;
    
    // Security Policies (USDC has 6 decimals)
    uint256 public dailyLimit;
    uint256 public maxTxAmount;
    uint256 public dailySpent;
    uint256 public lastWindowStart;
    
    // Target Access Allowlist
    mapping(address => bool) public isAllowlisted;
    
    // Emergency Control
    bool public isLocked;

    // Events
    event ActionExecuted(address indexed target, uint256 amount, bytes data);
    event AllowlistUpdated(address indexed target, bool allowed);
    event LimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MaxTxAmountUpdated(uint256 oldMax, uint256 newMax);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event EmergencyLocked(bool locked);
    event FundsWithdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Caller is not the authorized agent");
        _;
    }

    modifier notLocked() {
        require(!isLocked, "ArcShield: Emergency lock is active");
        _;
    }

    constructor(
        address _owner,
        address _agent,
        address _usdc,
        uint256 _dailyLimit,
        uint256 _maxTxAmount
    ) {
        require(_owner != address(0), "Owner address cannot be zero");
        require(_agent != address(0), "Agent address cannot be zero");
        require(_usdc != address(0), "USDC address cannot be zero");
        
        owner = _owner;
        agent = _agent;
        usdc = _usdc;
        dailyLimit = _dailyLimit;
        maxTxAmount = _maxTxAmount;
        lastWindowStart = block.timestamp;
    }

    /**
     * @dev Executes a transaction requested by the AI agent, subject to allowlist and limit checks.
     * @param target The destination address (e.g., API contract, recipient address).
     * @param amount The amount of USDC to allocate/send (6 decimals).
     * @param data Optional call data for contract execution.
     */
    function executeAction(
        address target,
        uint256 amount,
        bytes calldata data
    ) external onlyAgent notLocked returns (bytes memory) {
        require(isAllowlisted[target], "ArcShield: Target not in allowlist");
        require(amount <= maxTxAmount, "ArcShield: Exceeds transaction limit");

        // Daily window check & reset
        if (block.timestamp >= lastWindowStart + 1 days) {
            dailySpent = 0;
            lastWindowStart = block.timestamp;
        }

        require(dailySpent + amount <= dailyLimit, "ArcShield: Exceeds daily spending limit");
        dailySpent += amount;

        bytes memory returnData;
        if (data.length > 0) {
            // Approve the target to spend the specified amount of USDC for this call
            if (amount > 0) {
                require(IERC20(usdc).approve(target, amount), "ArcShield: USDC approval failed");
            }
            
            // Execute low-level call
            bool success;
            (success, returnData) = target.call(data);
            require(success, "ArcShield: Low-level call failed");
        } else {
            // Simple transfer of USDC
            if (amount > 0) {
                require(IERC20(usdc).transfer(target, amount), "ArcShield: USDC transfer failed");
            }
        }

        emit ActionExecuted(target, amount, data);
        return returnData;
    }

    /**
     * @dev Set allowlist status for a target contract/address.
     */
    function setAllowlist(address target, bool allowed) external onlyOwner {
        require(target != address(0), "Target address cannot be zero");
        isAllowlisted[target] = allowed;
        emit AllowlistUpdated(target, allowed);
    }

    /**
     * @dev Update the daily spending limit.
     */
    function updateDailyLimit(uint256 _newLimit) external onlyOwner {
        emit LimitUpdated(dailyLimit, _newLimit);
        dailyLimit = _newLimit;
    }

    /**
     * @dev Update the single transaction limit.
     */
    function updateMaxTxAmount(uint256 _newMax) external onlyOwner {
        emit MaxTxAmountUpdated(maxTxAmount, _newMax);
        maxTxAmount = _newMax;
    }

    /**
     * @dev Rotate the authorized AI agent address.
     */
    function updateAgent(address _newAgent) external onlyOwner {
        require(_newAgent != address(0), "Agent address cannot be zero");
        emit AgentUpdated(agent, _newAgent);
        agent = _newAgent;
    }

    /**
     * @dev Set the emergency lock status to freeze/unfreeze agent operations.
     */
    event SetLocked(bool locked);
    function setEmergencyLock(bool _locked) external onlyOwner {
        isLocked = _locked;
        emit EmergencyLocked(_locked);
    }

    /**
     * @dev Withdraw all USDC from the contract to a safe wallet (owner only).
     */
    function withdrawFunds(address to) external onlyOwner {
        require(to != address(0), "Recipient address cannot be zero");
        uint256 balance = IERC20(usdc).balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        require(IERC20(usdc).transfer(to, balance), "Withdrawal failed");
        emit FundsWithdrawn(to, balance);
    }
}
