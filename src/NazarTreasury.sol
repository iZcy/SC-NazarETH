// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title NazarTreasury
 * @notice Receives and distributes penalty funds from failed NazarETH challenges.
 *
 * @dev Two distinct buckets:
 *      ┌─────────────────────────────────────────────────────────────────┐
 *      │  Failed/partial stake (after deadline)                          │
 *      │                                                                 │
 *      │    15% → _treasuryBalance   (protocol revenue, admin withdraw)  │
 *      │    85% → _completionPool    (redistributed to winners)          │
 *      └─────────────────────────────────────────────────────────────────┘
 *
 *      The completion pool is distributed by the backend (OPERATOR_ROLE) after
 *      a distribution epoch ends, proportional to each winner's stake × duration.
 *
 *      Behavioral design: Knowing that other people's failure funds YOUR reward
 *      is a stronger retention mechanism than simply "get your money back."
 *      It creates asymmetric upside for disciplined users.
 */
contract NazarTreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");

    // ─── Storage ───────────────────────────────────────────────────────────────
    IERC20  public immutable usdc;
    uint256 public treasuryBalance;
    uint256 public completionPool;

    // ─── Events ────────────────────────────────────────────────────────────────
    event ProtocolFeeReceived(uint256 amount);
    event CompletionPoolReceived(uint256 amount);
    event BonusDistributed(address indexed completer, uint256 share);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ────────────────────────────────────────────────────────────────
    error ArrayLengthMismatch();
    error EmptyDistribution();
    error InsufficientTreasury(uint256 requested, uint256 available);
    error ZeroAmount();

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address admin, address usdcAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        usdc = IERC20(usdcAddress);
    }

    // ─── Called by NazarChallenge ──────────────────────────────────────────────

    /**
     * @notice Receive the 15% protocol fee portion of a failed challenge penalty.
     * @dev CHALLENGE_ROLE (NazarChallenge) must have transferred the USDC to this
     *      contract before calling, OR this contract pulls from NazarChallenge.
     *      We use push pattern: NazarChallenge sends USDC here then notifies.
     */
    function receiveProtocolFee(uint256 amount)
        external
        onlyRole(CHALLENGE_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        treasuryBalance += amount;
        emit ProtocolFeeReceived(amount);
    }

    /**
     * @notice Receive the 85% completion bonus pool portion of a failed challenge penalty.
     */
    function receiveCompletionPool(uint256 amount)
        external
        onlyRole(CHALLENGE_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        completionPool += amount;
        emit CompletionPoolReceived(amount);
    }

    // ─── Operator actions ──────────────────────────────────────────────────────

    /**
     * @notice Distribute the completion bonus pool to successful challengers.
     * @dev Weights should be computed off-chain as stakeAmount × durationDays for each winner.
     *      Distribution is proportional: share_i = completionPool × weight_i / totalWeight.
     *      The full completionPool is drained in a single distribution call.
     *
     * @param completers  Array of wallet addresses that completed their challenges.
     * @param weights     Corresponding weight values (stake × duration, unitless).
     */
    function distributeBonus(
        address[] calldata completers,
        uint256[] calldata weights
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        if (completers.length != weights.length) revert ArrayLengthMismatch();
        if (completers.length == 0) revert EmptyDistribution();

        uint256 pool = completionPool;
        if (pool == 0) return; // nothing to distribute

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }

        completionPool = 0; // drain before transfers (reentrancy safety)

        for (uint256 i = 0; i < completers.length; i++) {
            if (weights[i] == 0) continue;
            uint256 share = (pool * weights[i]) / totalWeight;
            if (share > 0) {
                usdc.safeTransfer(completers[i], share);
                emit BonusDistributed(completers[i], share);
            }
        }
    }

    // ─── Admin actions ─────────────────────────────────────────────────────────

    /**
     * @notice Withdraw from the protocol treasury bucket.
     */
    function adminWithdraw(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (amount > treasuryBalance) revert InsufficientTreasury(amount, treasuryBalance);
        treasuryBalance -= amount;
        usdc.safeTransfer(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }
}
