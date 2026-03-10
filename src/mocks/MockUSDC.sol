// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Permissionless test USDC with 6 decimals. For local/testnet use only.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    /// @notice Mint arbitrary amount to any address. NOT for mainnet.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev USDC uses 6 decimals
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
