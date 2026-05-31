// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ArcShield.sol";

/**
 * @title MockUSDC
 * @dev Simple ERC20 mock for testing. USDC has 6 decimals.
 */
contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function balanceOf(address owner) external view override returns (uint256) {
        return balances[owner];
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balances[msg.sender] >= value, "Insufficient balance");
        
        balances[msg.sender] -= value;
        balances[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balances[from] >= value, "Insufficient balance");
        require(allowances[from][msg.sender] >= value, "Insufficient allowance");
        
        allowances[from][msg.sender] -= value;
        balances[from] -= value;
        balances[to] += value;
        
        emit Transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external {
        totalSupply += value;
        balances[to] += value;
        emit Transfer(address(0), to, value);
    }
}
