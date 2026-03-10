// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title INazarYield
 * @notice Interface for the yield layer that holds user stake during active challenges.
 *
 * @dev MVP implementation: MockYield — USDC is held idle in-contract.
 *      V2 path: AaveYield adapter wiring to Aave v3 on Base:
 *        - deposit  → IPool(AAVE_POOL).supply(usdc, amount, address(this), 0)
 *        - withdraw → IPool(AAVE_POOL).withdraw(usdc, amount, recipient)
 *        - balanceOf → IERC20(aUSDC).balanceOf(address(this))
 *      The yield (difference between deposited and aUSDC balance) accrues to the protocol.
 *      Users only ever get their principal back — yield is protocol revenue (Stream 1).
 */
interface INazarYield {
    /**
     * @notice Deposit USDC into the yield layer.
     * @dev Caller must have approved this contract for `amount` USDC before calling.
     * @param amount USDC amount in 6-decimal units.
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraw USDC from the yield layer to a recipient.
     * @param recipient Address to send USDC to.
     * @param amount    USDC amount in 6-decimal units.
     */
    function withdraw(address recipient, uint256 amount) external;

    /**
     * @notice Total USDC deposited (principal tracking, not including yield).
     */
    function totalDeposited() external view returns (uint256);
}
