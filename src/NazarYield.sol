// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INazarYield.sol";

/**
 * @title NazarYield
 * @notice MVP yield layer: holds USDC idle in-contract (no real yield).
 * @dev Implements INazarYield. Only NazarChallenge (CHALLENGE_ROLE) can call
 *      deposit() and withdraw(). This keeps asset flow restricted to the protocol.
 *
 *      V2 upgrade path: Deploy an AaveYield.sol that implements the same INazarYield
 *      interface and point NazarChallenge to it. No changes needed in NazarChallenge.
 *
 *      USDC on Base Sepolia testnet: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *      USDC on Base mainnet:         0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
contract NazarYield is INazarYield, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");

    // ─── Storage ───────────────────────────────────────────────────────────────
    IERC20  public immutable usdc;
    uint256 private _totalDeposited;

    // ─── Events ────────────────────────────────────────────────────────────────
    event Deposited(uint256 amount, uint256 newTotal);
    event Withdrawn(address indexed recipient, uint256 amount, uint256 newTotal);

    // ─── Errors ────────────────────────────────────────────────────────────────
    error InsufficientBalance(uint256 requested, uint256 available);

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address admin, address usdcAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        usdc = IERC20(usdcAddress);
    }

    // ─── INazarYield ───────────────────────────────────────────────────────────

    /**
     * @notice Pull USDC from NazarChallenge into this vault.
     * @dev NazarChallenge must approve this contract before calling.
     *      In V2 (Aave), this would call IPool.supply().
     */
    function deposit(uint256 amount) external override onlyRole(CHALLENGE_ROLE) nonReentrant {
        _totalDeposited += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(amount, _totalDeposited);
    }

    /**
     * @notice Send USDC from this vault to a recipient (challenger or treasury).
     * @dev In V2 (Aave), this would call IPool.withdraw().
     */
    function withdraw(address recipient, uint256 amount)
        external
        override
        onlyRole(CHALLENGE_ROLE)
        nonReentrant
    {
        if (amount > _totalDeposited) revert InsufficientBalance(amount, _totalDeposited);
        _totalDeposited -= amount;
        usdc.safeTransfer(recipient, amount);
        emit Withdrawn(recipient, amount, _totalDeposited);
    }

    function totalDeposited() external view override returns (uint256) {
        return _totalDeposited;
    }
}
