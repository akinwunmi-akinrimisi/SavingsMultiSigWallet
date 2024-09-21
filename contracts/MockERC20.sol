// contracts/MockERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, initialSupply); // Mint initial supply to deployer
    }
}
