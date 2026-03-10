// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/NazarRegistry.sol";
import "../src/NazarOracle.sol";
import "../src/NazarYield.sol";
import "../src/NazarTreasury.sol";
import "../src/NazarChallenge.sol";
import "../src/mocks/MockUSDC.sol";

/**
 * @notice Comprehensive tests for NazarChallenge — the core commitment device.
 * Tests cover the full user flow: create → deposit → progress withdraw → finalize.
 */
contract NazarChallengeTest is Test {

    // ─── Contracts ─────────────────────────────────────────────────────────────
    MockUSDC       public usdc;
    NazarRegistry  public registry;
    NazarOracle    public oracleContract;
    NazarYield     public yieldVault;
    NazarTreasury  public treasury;
    NazarChallenge public challenge;

    // ─── Actors ────────────────────────────────────────────────────────────────
    address public admin;
    address public alice;
    address public bob;
    address public oracleSigner;
    uint256 internal oracleKey;
    uint256 internal adminKey;

    // ─── Challenge params ──────────────────────────────────────────────────────
    bytes32 constant RUNNING     = keccak256("running");
    uint256 constant TARGET_10KM = 10_000;      // 10,000 meters
    uint256 constant STAKE       = 1_000e6;     // 1,000 USDC (6 decimals)
    uint256 constant ONE_WEEK    = 7 days;

    uint256 public challengeDeadline;
    uint256 public challengeId;

    // ─── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        (admin, adminKey)     = makeAddrAndKey("admin");
        (oracleSigner, oracleKey) = makeAddrAndKey("oracle");
        alice = makeAddr("alice");
        bob   = makeAddr("bob");

        // Deploy contracts
        usdc         = new MockUSDC();
        registry     = new NazarRegistry(admin, oracleSigner, false);
        oracleContract = new NazarOracle(admin, oracleSigner);
        yieldVault   = new NazarYield(admin, address(usdc));
        treasury     = new NazarTreasury(admin, address(usdc));
        challenge    = new NazarChallenge(
            admin,
            address(registry),
            address(oracleContract),
            address(yieldVault),
            address(treasury),
            address(usdc)
        );

        // Wire roles
        bytes32 CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
        vm.prank(admin);
        yieldVault.grantRole(CHALLENGE_ROLE, address(challenge));
        vm.prank(admin);
        treasury.grantRole(CHALLENGE_ROLE, address(challenge));

        // Mint USDC
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);

        // Register alice via EIP-712 signed backend signature
        _registerWallet(alice, 11111111);

        // Set challenge deadline
        challengeDeadline = block.timestamp + ONE_WEEK;
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    function _registerWallet(address wallet, uint256 stravaId) internal {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(wallet);
        bytes32 structHash = keccak256(
            abi.encode(registry.REGISTER_TYPEHASH(), wallet, stravaId, nonce, deadline)
        );
        bytes32 digest = registry.hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(wallet);
        registry.register(stravaId, deadline, sig);
    }

    function _createAndDeposit(address user, uint256 deadline, uint256 stake)
        internal
        returns (uint256 cId)
    {
        vm.prank(user);
        cId = challenge.createChallenge(RUNNING, TARGET_10KM, deadline, stake);

        vm.prank(user);
        usdc.approve(address(challenge), stake);

        vm.prank(user);
        challenge.deposit(cId);
    }

    function _submitProgress(address wallet, uint256 cId, uint256 bps) internal {
        vm.prank(oracleSigner);
        oracleContract.submitProgress(wallet, cId, bps, block.timestamp);
    }

    function _finalizeOracle(address wallet, uint256 cId) internal {
        vm.prank(oracleSigner);
        oracleContract.finalizeProgress(wallet, cId);
    }

    // ─── Test: Create challenge ────────────────────────────────────────────────

    function test_CreateChallenge_Success() public {
        vm.prank(alice);
        uint256 cId = challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);

        NazarChallenge.Challenge memory c = challenge.getChallenge(cId);
        assertEq(c.challenger, alice);
        assertEq(c.stakeAmount, STAKE);
        assertEq(c.deadline, challengeDeadline);
        assertEq(uint8(c.status), uint8(NazarChallenge.ChallengeStatus.Created));
        assertEq(challenge.getActiveChallenge(alice), cId);
    }

    function test_CreateChallenge_Revert_UnregisteredWallet() public {
        vm.prank(bob); // bob is not registered
        vm.expectRevert(abi.encodeWithSelector(NazarChallenge.WalletNotRegistered.selector, bob));
        challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);
    }

    function test_CreateChallenge_Revert_ActiveChallengeExists() public {
        vm.prank(alice);
        uint256 cId = challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(NazarChallenge.ActiveChallengeExists.selector, alice, cId)
        );
        challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);
    }

    function test_CreateChallenge_Revert_InvalidDeadline() public {
        uint256 badDeadline = block.timestamp + 30 minutes; // less than MIN_DURATION

        vm.prank(alice);
        vm.expectRevert();
        challenge.createChallenge(RUNNING, TARGET_10KM, badDeadline, STAKE);
    }

    function test_CreateChallenge_Revert_InsufficientStake() public {
        // Read MIN_STAKE before setting prank — prank is consumed by the first external call
        uint256 minStake = challenge.MIN_STAKE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(NazarChallenge.InsufficientStake.selector, 0, minStake)
        );
        challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, 0);
    }

    // ─── Test: Deposit ─────────────────────────────────────────────────────────

    function test_Deposit_Success() public {
        vm.prank(alice);
        uint256 cId = challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);

        vm.prank(alice);
        usdc.approve(address(challenge), STAKE);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        challenge.deposit(cId);

        NazarChallenge.Challenge memory c = challenge.getChallenge(cId);
        assertEq(uint8(c.status), uint8(NazarChallenge.ChallengeStatus.Active));
        assertEq(usdc.balanceOf(alice), aliceBefore - STAKE);
        assertEq(usdc.balanceOf(address(yieldVault)), STAKE);
        assertEq(yieldVault.totalDeposited(), STAKE);
    }

    function test_Deposit_Revert_WrongStatus() public {
        vm.prank(alice);
        uint256 cId = challenge.createChallenge(RUNNING, TARGET_10KM, challengeDeadline, STAKE);

        vm.prank(alice);
        usdc.approve(address(challenge), STAKE * 2);

        vm.prank(alice);
        challenge.deposit(cId);

        // Second deposit should fail — status is Active, not Created
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                NazarChallenge.WrongStatus.selector,
                NazarChallenge.ChallengeStatus.Active,
                NazarChallenge.ChallengeStatus.Created
            )
        );
        challenge.deposit(cId);
    }

    // ─── Test: Progress withdrawal milestones ──────────────────────────────────

    function test_WithdrawProgress_At30Percent() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);
        _submitProgress(alice, cId, 3500); // 35% progress → floor = 30%

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        challenge.withdrawProgress(cId);

        // 30% of 1000 USDC = 300 USDC
        assertEq(usdc.balanceOf(alice) - aliceBefore, 300e6);
        assertEq(challenge.getChallenge(cId).withdrawnBps, 3000);
    }

    function test_WithdrawProgress_Sequential_30_Then_70() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // First: claim 30%
        _submitProgress(alice, cId, 3500);
        vm.prank(alice);
        challenge.withdrawProgress(cId);
        assertEq(challenge.getChallenge(cId).withdrawnBps, 3000);

        // Advance progress to 70%
        _submitProgress(alice, cId, 7000);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        challenge.withdrawProgress(cId);

        // Delta: (70% - 30%) of 1000 = 400 USDC
        assertEq(usdc.balanceOf(alice) - aliceBefore, 400e6);
        assertEq(challenge.getChallenge(cId).withdrawnBps, 7000);
    }

    function test_WithdrawProgress_Sequential_30_70_100() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        _submitProgress(alice, cId, 3000);
        vm.prank(alice);
        challenge.withdrawProgress(cId);

        _submitProgress(alice, cId, 7000);
        vm.prank(alice);
        challenge.withdrawProgress(cId);

        _submitProgress(alice, cId, 10_000);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        challenge.withdrawProgress(cId);

        // Final delta: 30% of 1000 = 300 USDC
        assertEq(usdc.balanceOf(alice) - aliceBefore, 300e6);
        assertEq(challenge.getChallenge(cId).withdrawnBps, 10_000);
    }

    function test_WithdrawProgress_Revert_NothingAtZeroProgress() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);
        // No progress submitted — progressBps = 0 → floor = 0 → nothing to withdraw

        vm.prank(alice);
        vm.expectRevert(NazarChallenge.NothingToWithdraw.selector);
        challenge.withdrawProgress(cId);
    }

    function test_WithdrawProgress_Revert_NothingNew() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);
        _submitProgress(alice, cId, 3000);

        vm.prank(alice);
        challenge.withdrawProgress(cId); // claim 30%

        // Progress hasn't advanced past 30% floor — nothing new
        vm.prank(alice);
        vm.expectRevert(NazarChallenge.NothingToWithdraw.selector);
        challenge.withdrawProgress(cId);
    }

    // ─── Test: Finalize - full completion (no penalty) ─────────────────────────

    function test_Finalize_FullCompletion_NoPenalty() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // Alice withdraws 100%
        _submitProgress(alice, cId, 10_000);
        vm.prank(alice);
        challenge.withdrawProgress(cId);
        assertEq(challenge.getChallenge(cId).withdrawnBps, 10_000);

        // Move past deadline
        vm.warp(challengeDeadline + 1);
        _finalizeOracle(alice, cId);

        vm.prank(makeAddr("anyone"));
        challenge.finalize(cId);

        NazarChallenge.Challenge memory c = challenge.getChallenge(cId);
        assertEq(uint8(c.status), uint8(NazarChallenge.ChallengeStatus.Finalized));

        // No penalty: treasury should have received nothing
        assertEq(treasury.treasuryBalance(), 0);
        assertEq(treasury.completionPool(), 0);

        // Alice's active challenge cleared
        assertEq(challenge.getActiveChallenge(alice), 0);
    }

    // ─── Test: Finalize - zero completion (full penalty) ──────────────────────

    function test_Finalize_ZeroCompletion_FullPenalty() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // No progress, no withdrawal
        vm.warp(challengeDeadline + 1);
        _finalizeOracle(alice, cId);

        uint256 treasuryBefore = usdc.balanceOf(address(treasury));

        vm.prank(makeAddr("anyone"));
        challenge.finalize(cId);

        // penaltyAmount = 1000 USDC (100% of stake)
        // protocolFee   = 1000e6 * 1500 / 10000 = 150e6
        // completionPool = 1000e6 - 150e6 = 850e6

        uint256 expectedFee  = (STAKE * 1500) / 10_000;             // 150 USDC
        uint256 expectedPool = STAKE - expectedFee;                  // 850 USDC

        assertEq(treasury.treasuryBalance(), expectedFee);
        assertEq(treasury.completionPool(), expectedPool);
        assertEq(usdc.balanceOf(address(treasury)) - treasuryBefore, STAKE);
    }

    // ─── Test: Finalize - partial completion (partial penalty) ────────────────

    function test_Finalize_PartialCompletion_PartialPenalty() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // Alice achieves 30% and withdraws
        _submitProgress(alice, cId, 3000);
        vm.prank(alice);
        challenge.withdrawProgress(cId);

        vm.warp(challengeDeadline + 1);
        _finalizeOracle(alice, cId);

        vm.prank(makeAddr("anyone"));
        challenge.finalize(cId);

        // remaining = 70% of 1000 USDC = 700 USDC
        // protocolFee   = 700e6 * 1500 / 10000 = 105e6
        // completionPool = 700e6 - 105e6 = 595e6

        uint256 remaining    = (STAKE * 7000) / 10_000;             // 700 USDC
        uint256 expectedFee  = (remaining * 1500) / 10_000;         // 105 USDC
        uint256 expectedPool = remaining - expectedFee;              // 595 USDC

        assertEq(treasury.treasuryBalance(), expectedFee);
        assertEq(treasury.completionPool(), expectedPool);
    }

    // ─── Test: Finalize - deadline not passed ─────────────────────────────────

    function test_Finalize_Revert_DeadlineNotPassed() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        vm.expectRevert(
            abi.encodeWithSelector(
                NazarChallenge.DeadlineNotPassed.selector,
                challengeDeadline,
                block.timestamp
            )
        );
        challenge.finalize(cId);
    }

    // ─── Test: Finalize - grace period failsafe ───────────────────────────────

    function test_Finalize_GracePeriod_NoOracleNeeded() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // Warp past deadline + grace period (oracle never called)
        vm.warp(challengeDeadline + challenge.GRACE_PERIOD() + 1);

        // Should succeed without oracle finalizing
        vm.prank(makeAddr("anyone"));
        challenge.finalize(cId);

        NazarChallenge.Challenge memory c = challenge.getChallenge(cId);
        assertEq(uint8(c.status), uint8(NazarChallenge.ChallengeStatus.Finalized));
    }

    // ─── Test: Finalize - oracle not finalized, before grace ──────────────────

    function test_Finalize_Revert_OracleNotFinalized() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);

        // Warp past deadline but NOT past grace period
        vm.warp(challengeDeadline + 1);

        vm.expectRevert(NazarChallenge.OracleNotFinalized.selector);
        challenge.finalize(cId);
    }

    // ─── Test: Active challenge lock ──────────────────────────────────────────

    function test_ActiveChallenge_ClearedAfterFinalize() public {
        uint256 cId = _createAndDeposit(alice, challengeDeadline, STAKE);
        assertEq(challenge.getActiveChallenge(alice), cId);

        vm.warp(challengeDeadline + challenge.GRACE_PERIOD() + 1);
        challenge.finalize(cId);

        assertEq(challenge.getActiveChallenge(alice), 0);
    }
}
