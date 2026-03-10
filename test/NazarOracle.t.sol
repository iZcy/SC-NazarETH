// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/NazarOracle.sol";

contract NazarOracleTest is Test {

    NazarOracle public oracle;

    address public admin     = makeAddr("admin");
    address public alice     = makeAddr("alice");
    address public attacker  = makeAddr("attacker");
    address internal oracleSigner;
    uint256 internal oracleKey;

    uint256 constant CHALLENGE_ID = 1;

    function setUp() public {
        (oracleSigner, oracleKey) = makeAddrAndKey("oracle");
        oracle = new NazarOracle(admin, oracleSigner);
    }

    // ─── submitProgress ────────────────────────────────────────────────────────

    function test_SubmitProgress_Success() public {
        uint256 reportedAt = block.timestamp;

        vm.prank(oracleSigner);
        oracle.submitProgress(alice, CHALLENGE_ID, 3500, reportedAt);

        NazarOracle.ProgressData memory pd = oracle.getProgress(alice, CHALLENGE_ID);
        assertEq(pd.progressBps, 3500);
        assertEq(pd.reportedAt, reportedAt);
        assertFalse(pd.finalized);
    }

    function test_SubmitProgress_Monotonic_OnlyIncrease() public {
        vm.prank(oracleSigner);
        oracle.submitProgress(alice, CHALLENGE_ID, 5000, block.timestamp);

        // Lower value should not overwrite
        vm.prank(oracleSigner);
        oracle.submitProgress(alice, CHALLENGE_ID, 3000, block.timestamp);

        assertEq(oracle.getProgressBps(alice, CHALLENGE_ID), 5000);
    }

    function test_SubmitProgress_Revert_Stale() public {
        // Warp forward so block.timestamp > STALE_THRESHOLD without underflow
        vm.warp(block.timestamp + oracle.STALE_THRESHOLD() + 2 hours);
        uint256 staleTime = block.timestamp - oracle.STALE_THRESHOLD() - 1;

        vm.prank(oracleSigner);
        vm.expectRevert(
            abi.encodeWithSelector(NazarOracle.StaleReport.selector, staleTime, block.timestamp)
        );
        oracle.submitProgress(alice, CHALLENGE_ID, 3500, staleTime);
    }

    function test_SubmitProgress_Revert_Unauthorized() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.submitProgress(alice, CHALLENGE_ID, 3500, block.timestamp);
    }

    function test_SubmitProgress_Revert_ExceedsMax() public {
        vm.prank(oracleSigner);
        vm.expectRevert(
            abi.encodeWithSelector(NazarOracle.ProgressExceedsMax.selector, 10001)
        );
        oracle.submitProgress(alice, CHALLENGE_ID, 10001, block.timestamp);
    }

    // ─── finalizeProgress ──────────────────────────────────────────────────────

    function test_FinalizeProgress_Success() public {
        vm.prank(oracleSigner);
        oracle.submitProgress(alice, CHALLENGE_ID, 7000, block.timestamp);

        vm.prank(oracleSigner);
        oracle.finalizeProgress(alice, CHALLENGE_ID);

        assertTrue(oracle.isFinalized(alice, CHALLENGE_ID));
    }

    function test_FinalizeProgress_Revert_AlreadyFinalized() public {
        vm.prank(oracleSigner);
        oracle.finalizeProgress(alice, CHALLENGE_ID);

        vm.prank(oracleSigner);
        vm.expectRevert(
            abi.encodeWithSelector(NazarOracle.AlreadyFinalized.selector, alice, CHALLENGE_ID)
        );
        oracle.finalizeProgress(alice, CHALLENGE_ID);
    }

    function test_SubmitProgress_Revert_AfterFinalized() public {
        vm.prank(oracleSigner);
        oracle.finalizeProgress(alice, CHALLENGE_ID);

        vm.prank(oracleSigner);
        vm.expectRevert(
            abi.encodeWithSelector(NazarOracle.AlreadyFinalized.selector, alice, CHALLENGE_ID)
        );
        oracle.submitProgress(alice, CHALLENGE_ID, 5000, block.timestamp);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function test_GetProgress_Default() public view {
        NazarOracle.ProgressData memory pd = oracle.getProgress(alice, CHALLENGE_ID);
        assertEq(pd.progressBps, 0);
        assertFalse(pd.finalized);
    }
}
