// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NazarOracle
 * @notice Trusted oracle contract fed by the NazarETH backend.
 * @dev The backend (holding ORACLE_ROLE) calls submitProgress() after processing
 *      Strava activity data for a user. Progress is expressed in basis points (0–10000).
 *      10000 bps = 100% of the challenge goal completed.
 *
 *      Oracle trust model (MVP):
 *        - Single backend EOA holds ORACLE_ROLE. Centralized but fine for hackathon.
 *        - V2 path: Replace with Chainlink Functions calling Strava API, or an
 *          optimistic oracle with a 24h dispute window.
 *
 *      Stale data guard:
 *        - Progress updates with reportedAt older than STALE_THRESHOLD are rejected.
 *        - This prevents the backend from submitting backdated data.
 */
contract NazarOracle is AccessControl {

    // ─── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── Constants ─────────────────────────────────────────────────────────────
    /// @dev Maximum age of a progress report. Reports older than this are rejected.
    uint256 public constant STALE_THRESHOLD = 1 hours;

    // ─── Types ─────────────────────────────────────────────────────────────────
    struct ProgressData {
        uint256 progressBps;  // 0–10000 (basis points of goal completion)
        uint256 reportedAt;   // unix timestamp of the Strava activity update
        bool    finalized;    // set true after the challenge deadline passes
    }

    // ─── Storage ───────────────────────────────────────────────────────────────
    /// @dev wallet => challengeId => ProgressData
    mapping(address => mapping(uint256 => ProgressData)) private _progress;

    // ─── Events ────────────────────────────────────────────────────────────────
    event ProgressSubmitted(
        address indexed wallet,
        uint256 indexed challengeId,
        uint256 progressBps,
        uint256 reportedAt
    );
    event ProgressFinalized(address indexed wallet, uint256 indexed challengeId);

    // ─── Errors ────────────────────────────────────────────────────────────────
    error StaleReport(uint256 reportedAt, uint256 blockTimestamp);
    error AlreadyFinalized(address wallet, uint256 challengeId);
    error ProgressExceedsMax(uint256 progressBps);

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address admin, address oracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // ─── Oracle actions ────────────────────────────────────────────────────────

    /**
     * @notice Submit latest progress for a user's challenge.
     * @param wallet         The challenger's wallet address.
     * @param challengeId    The challenge ID tracked in NazarChallenge.
     * @param progressBps    Completion in basis points (0–10000). Monotonically increasing.
     * @param reportedAt     Unix timestamp of the Strava sync (from Strava API response).
     */
    function submitProgress(
        address wallet,
        uint256 challengeId,
        uint256 progressBps,
        uint256 reportedAt
    ) external onlyRole(ORACLE_ROLE) {
        if (progressBps > 10_000) revert ProgressExceedsMax(progressBps);
        if (_progress[wallet][challengeId].finalized) revert AlreadyFinalized(wallet, challengeId);

        // Reject stale off-chain reports
        if (block.timestamp > reportedAt + STALE_THRESHOLD) {
            revert StaleReport(reportedAt, block.timestamp);
        }

        // Only allow progress to increase (Strava distance never goes down)
        ProgressData storage pd = _progress[wallet][challengeId];
        if (progressBps > pd.progressBps) {
            pd.progressBps = progressBps;
            pd.reportedAt  = reportedAt;
        }

        emit ProgressSubmitted(wallet, challengeId, progressBps, reportedAt);
    }

    /**
     * @notice Mark a challenge's progress as finalized (called after deadline).
     * @dev Once finalized, no further progress updates are accepted.
     *      This is called by the backend right after a challenge's deadline passes.
     */
    function finalizeProgress(address wallet, uint256 challengeId)
        external
        onlyRole(ORACLE_ROLE)
    {
        if (_progress[wallet][challengeId].finalized) revert AlreadyFinalized(wallet, challengeId);
        _progress[wallet][challengeId].finalized = true;
        emit ProgressFinalized(wallet, challengeId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getProgress(address wallet, uint256 challengeId)
        external
        view
        returns (ProgressData memory)
    {
        return _progress[wallet][challengeId];
    }

    function getProgressBps(address wallet, uint256 challengeId)
        external
        view
        returns (uint256)
    {
        return _progress[wallet][challengeId].progressBps;
    }

    function isFinalized(address wallet, uint256 challengeId)
        external
        view
        returns (bool)
    {
        return _progress[wallet][challengeId].finalized;
    }
}
