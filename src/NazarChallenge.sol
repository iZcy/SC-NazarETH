// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INazarYield.sol";
import "./NazarRegistry.sol";
import "./NazarOracle.sol";
import "./NazarTreasury.sol";

/**
 * @title NazarChallenge
 * @notice Core commitment device. Users stake USDC against a Strava fitness goal.
 *
 * ─── User Flow ────────────────────────────────────────────────────────────────
 *  1. Register wallet → Strava via NazarRegistry.
 *  2. createChallenge(activityType, targetValue, deadline, stakeAmount)
 *  3. deposit(challengeId)  — pulls USDC, routes to NazarYield vault.
 *  4. Backend submits progress via NazarOracle as user completes activity.
 *  5. withdrawProgress(challengeId) — unlock floor(progressBps/1000)*10% per call.
 *     e.g. at 35% completion → floor(3500/1000)*10 = 30% unlocked.
 *  6. finalize(challengeId) — callable by anyone after deadline.
 *     - If fully completed (withdrawnBps == 10000): no penalty.
 *     - Otherwise: remaining stake split 15% treasury + 85% completion bonus pool.
 *
 * ─── Penalty Mechanics ────────────────────────────────────────────────────────
 *  Failed stake fuels two revenue streams:
 *    Stream 1 (silent):   Yield from NazarYield layer accrues to protocol.
 *    Stream 2 (engaging): 85% of penalties redistributed to users who succeeded.
 *                         Knowing others' failure funds YOUR reward is a stronger
 *                         behavioral motivator than "just get your money back."
 *
 * ─── Oracle Trust (MVP) ───────────────────────────────────────────────────────
 *  Single backend EOA with ORACLE_ROLE in NazarOracle. Centralized but correct
 *  for a hackathon MVP. V2 path: Chainlink Functions calling Strava API, or an
 *  optimistic oracle with 24h dispute window.
 */
contract NazarChallenge is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── Constants ─────────────────────────────────────────────────────────────
    /// @dev Progress is stored in basis points (0–10000). 10000 = 100%.
    uint256 public constant BPS_DENOMINATOR   = 10_000;
    /// @dev Withdrawal milestone step: 10% = 1000 bps.
    uint256 public constant MILESTONE_STEP    = 1_000;
    /// @dev Protocol fee: 15% of penalty stake.
    uint256 public constant PROTOCOL_FEE_BPS  = 1_500;
    /// @dev Completion pool: 85% of penalty stake.
    uint256 public constant COMPLETION_POOL_BPS = 8_500;
    /// @dev Minimum challenge duration to prevent abuse.
    uint256 public constant MIN_DURATION      = 2 minutes; // NOTE: short for PoC demo (was 1 days)
    /// @dev Grace period after deadline before anyone can force-finalize without oracle finalization.
    uint256 public constant GRACE_PERIOD      = 2 minutes; // NOTE: short for PoC demo (was 1 days)
    /// @dev Minimum stake to prevent spam challenges.
    uint256 public constant MIN_STAKE         = 1e6; // 1 USDC (6 decimals)

    // ─── Types ─────────────────────────────────────────────────────────────────
    enum ChallengeStatus { NotStarted, Created, Active, Finalized }

    struct Challenge {
        address     challenger;
        bytes32     activityType;   // e.g. keccak256("running"), keccak256("cycling")
        uint256     targetValue;    // target in activity units (e.g. meters for running)
        uint256     deadline;       // unix timestamp
        uint256     stakeAmount;    // USDC in 6-decimal units
        uint256     withdrawnBps;   // how many bps of stake already withdrawn (0–10000)
        ChallengeStatus status;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────
    NazarRegistry  public immutable registry;
    NazarOracle    public immutable oracle;
    INazarYield    public immutable yieldVault;
    NazarTreasury  public immutable treasury;
    IERC20         public immutable usdc;

    uint256 private _challengeCounter;

    /// @dev challengeId => Challenge
    mapping(uint256 => Challenge) private _challenges;

    /// @dev wallet => active challengeId (0 = no active challenge)
    mapping(address => uint256) private _activeChallenge;

    // ─── Events ────────────────────────────────────────────────────────────────
    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed challenger,
        bytes32 activityType,
        uint256 targetValue,
        uint256 deadline,
        uint256 stakeAmount
    );
    event Deposited(uint256 indexed challengeId, address indexed challenger, uint256 amount);
    event ProgressWithdrawn(
        uint256 indexed challengeId,
        address indexed challenger,
        uint256 withdrawnBps,
        uint256 totalWithdrawnBps,
        uint256 amount
    );
    event ChallengeFinalized(
        uint256 indexed challengeId,
        address indexed challenger,
        bool    completed,
        uint256 penaltyAmount,
        uint256 protocolFee,
        uint256 completionPoolShare
    );

    // ─── Errors ────────────────────────────────────────────────────────────────
    error WalletNotRegistered(address wallet);
    error ActiveChallengeExists(address wallet, uint256 challengeId);
    error InvalidDeadline(uint256 deadline, uint256 minimum);
    error InsufficientStake(uint256 provided, uint256 minimum);
    error ChallengeNotFound(uint256 challengeId);
    error NotChallenger(address caller, address challenger);
    error WrongStatus(ChallengeStatus current, ChallengeStatus expected);
    error NothingToWithdraw();
    error DeadlineNotPassed(uint256 deadline, uint256 blockTimestamp);
    error OracleNotFinalized();

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address admin,
        address registryAddress,
        address oracleAddress,
        address yieldVaultAddress,
        address treasuryAddress,
        address usdcAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        registry   = NazarRegistry(registryAddress);
        oracle     = NazarOracle(oracleAddress);
        yieldVault = INazarYield(yieldVaultAddress);
        treasury   = NazarTreasury(treasuryAddress);
        usdc       = IERC20(usdcAddress);
    }

    // ─── User Actions ──────────────────────────────────────────────────────────

    /**
     * @notice Step 2: Create a challenge. Must be registered in NazarRegistry.
     * @param activityType  keccak256 of activity name, e.g. keccak256("running").
     * @param targetValue   Goal in activity units (meters, steps, calories, etc.).
     * @param deadline      Unix timestamp when the challenge closes. Must be > now + 1 day.
     * @param stakeAmount   USDC stake in 6-decimal units. Minimum 1 USDC.
     * @return challengeId  The assigned challenge ID.
     */
    function createChallenge(
        bytes32 activityType,
        uint256 targetValue,
        uint256 deadline,
        uint256 stakeAmount
    ) external whenNotPaused returns (uint256 challengeId) {
        if (!registry.isRegistered(msg.sender)) revert WalletNotRegistered(msg.sender);
        if (_activeChallenge[msg.sender] != 0) {
            revert ActiveChallengeExists(msg.sender, _activeChallenge[msg.sender]);
        }
        if (deadline < block.timestamp + MIN_DURATION) {
            revert InvalidDeadline(deadline, block.timestamp + MIN_DURATION);
        }
        if (stakeAmount < MIN_STAKE) revert InsufficientStake(stakeAmount, MIN_STAKE);

        challengeId = ++_challengeCounter;

        _challenges[challengeId] = Challenge({
            challenger:   msg.sender,
            activityType: activityType,
            targetValue:  targetValue,
            deadline:     deadline,
            stakeAmount:  stakeAmount,
            withdrawnBps: 0,
            status:       ChallengeStatus.Created
        });

        _activeChallenge[msg.sender] = challengeId;

        emit ChallengeCreated(challengeId, msg.sender, activityType, targetValue, deadline, stakeAmount);
    }

    /**
     * @notice Step 3: Deposit the staked USDC to activate the challenge.
     * @dev Caller must have approved this contract for stakeAmount USDC beforehand.
     *      USDC is routed: caller → this contract → NazarYield vault.
     */
    function deposit(uint256 challengeId) external whenNotPaused nonReentrant {
        Challenge storage c = _getChallenge(challengeId);
        if (c.challenger != msg.sender) revert NotChallenger(msg.sender, c.challenger);
        if (c.status != ChallengeStatus.Created) revert WrongStatus(c.status, ChallengeStatus.Created);

        c.status = ChallengeStatus.Active;

        // Pull USDC from challenger to this contract
        usdc.safeTransferFrom(msg.sender, address(this), c.stakeAmount);

        // Approve yield vault and deposit
        usdc.forceApprove(address(yieldVault), c.stakeAmount);
        yieldVault.deposit(c.stakeAmount);

        emit Deposited(challengeId, msg.sender, c.stakeAmount);
    }

    /**
     * @notice Step 5: Withdraw the unlocked portion of stake based on current progress.
     * @dev Progress is read from NazarOracle. Unlocked percent = floor(progressBps / 1000) * 10.
     *      Example: 3500 bps progress → floor(3500/1000) = 3 → 30% unlocked.
     *               3000 bps progress → floor(3000/1000) = 3 → 30% unlocked.
     *      Users can call this multiple times; each call only withdraws the delta
     *      between current unlockable and already-withdrawn amount.
     */
    function withdrawProgress(uint256 challengeId) external whenNotPaused nonReentrant {
        Challenge storage c = _getChallenge(challengeId);
        if (c.challenger != msg.sender) revert NotChallenger(msg.sender, c.challenger);
        if (c.status != ChallengeStatus.Active) revert WrongStatus(c.status, ChallengeStatus.Active);

        uint256 progressBps = oracle.getProgressBps(msg.sender, challengeId);

        // Floor to nearest MILESTONE_STEP (10% = 1000 bps)
        // e.g. progressBps=3500 → (3500/1000)*1000 = 3000 bps = 30%
        uint256 unlockedBps = (progressBps / MILESTONE_STEP) * MILESTONE_STEP;
        if (unlockedBps > BPS_DENOMINATOR) unlockedBps = BPS_DENOMINATOR;

        uint256 withdrawableBps = unlockedBps - c.withdrawnBps;
        if (withdrawableBps == 0) revert NothingToWithdraw();

        uint256 amount = (c.stakeAmount * withdrawableBps) / BPS_DENOMINATOR;
        c.withdrawnBps += withdrawableBps;

        yieldVault.withdraw(msg.sender, amount);

        emit ProgressWithdrawn(challengeId, msg.sender, withdrawableBps, c.withdrawnBps, amount);
    }

    /**
     * @notice Step 6: Finalize a challenge after its deadline.
     * @dev Callable by anyone after deadline. Two conditions allow finalization:
     *      (a) Oracle has marked the challenge as finalized (normal path).
     *      (b) block.timestamp >= deadline + GRACE_PERIOD (failsafe, prevents funds locked forever).
     *
     *      If challenger completed 100% (withdrawnBps == 10000): no penalty.
     *      Otherwise: remaining stake → 15% protocol fee + 85% completion pool.
     *
     *      USDC flow for penalty: yieldVault → this contract → treasury (two buckets).
     */
    function finalize(uint256 challengeId) external whenNotPaused nonReentrant {
        Challenge storage c = _getChallenge(challengeId);
        if (c.status != ChallengeStatus.Active) revert WrongStatus(c.status, ChallengeStatus.Active);
        if (block.timestamp < c.deadline) revert DeadlineNotPassed(c.deadline, block.timestamp);

        bool oracleFinalized = oracle.isFinalized(c.challenger, challengeId);
        bool gracePassed = block.timestamp >= c.deadline + GRACE_PERIOD;
        if (!oracleFinalized && !gracePassed) revert OracleNotFinalized();

        c.status = ChallengeStatus.Finalized;
        delete _activeChallenge[c.challenger];

        // Remaining stake not yet withdrawn
        uint256 remainingBps = BPS_DENOMINATOR - c.withdrawnBps;
        bool completed = (remainingBps == 0);

        uint256 protocolFee      = 0;
        uint256 completionShare  = 0;
        uint256 penaltyAmount    = 0;

        if (!completed && remainingBps > 0) {
            penaltyAmount = (c.stakeAmount * remainingBps) / BPS_DENOMINATOR;

            // Pull remaining from yield vault to this contract
            yieldVault.withdraw(address(this), penaltyAmount);

            // Split: 15% protocol fee + 85% completion pool
            protocolFee     = (penaltyAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            completionShare = penaltyAmount - protocolFee; // avoids rounding dust staying in contract

            // Push to treasury and notify it to record the split
            usdc.safeTransfer(address(treasury), penaltyAmount);
            treasury.receiveProtocolFee(protocolFee);
            treasury.receiveCompletionPool(completionShare);
        }

        emit ChallengeFinalized(
            challengeId, c.challenger, completed, penaltyAmount, protocolFee, completionShare
        );
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return _challenges[challengeId];
    }

    function getActiveChallenge(address wallet) external view returns (uint256) {
        return _activeChallenge[wallet];
    }

    function challengeCounter() external view returns (uint256) {
        return _challengeCounter;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _getChallenge(uint256 challengeId) internal view returns (Challenge storage) {
        Challenge storage c = _challenges[challengeId];
        if (c.challenger == address(0)) revert ChallengeNotFound(challengeId);
        return c;
    }
}
