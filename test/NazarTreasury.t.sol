// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/NazarTreasury.sol";
import "../src/mocks/MockUSDC.sol";

contract NazarTreasuryTest is Test {

    NazarTreasury public treasury;
    MockUSDC  public usdc;

    address public admin     = makeAddr("admin");
    address public challenge = makeAddr("challenge"); // mock NazarChallenge
    address public operator  = makeAddr("operator");
    address public alice     = makeAddr("alice");
    address public bob       = makeAddr("bob");
    address public attacker  = makeAddr("attacker");

    bytes32 constant CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
    bytes32 constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");

    function setUp() public {
        usdc     = new MockUSDC();
        treasury = new NazarTreasury(admin, address(usdc));

        vm.prank(admin);
        treasury.grantRole(CHALLENGE_ROLE, challenge);
        vm.prank(admin);
        treasury.grantRole(OPERATOR_ROLE, operator);
    }

    // Helper: push USDC to treasury and record fee + pool
    // Skips receiveProtocolFee / receiveCompletionPool if the amount is 0
    // to avoid triggering the ZeroAmount guard.
    function _fundTreasury(uint256 fee, uint256 pool) internal {
        uint256 total = fee + pool;
        if (total == 0) return;
        usdc.mint(challenge, total);
        vm.startPrank(challenge);
        usdc.transfer(address(treasury), total);
        if (fee  > 0) treasury.receiveProtocolFee(fee);
        if (pool > 0) treasury.receiveCompletionPool(pool);
        vm.stopPrank();
    }

    // ─── receiveProtocolFee ────────────────────────────────────────────────────

    function test_ReceiveProtocolFee_Success() public {
        _fundTreasury(150e6, 0);
        assertEq(treasury.treasuryBalance(), 150e6);
    }

    function test_ReceiveProtocolFee_Revert_Unauthorized() public {
        usdc.mint(attacker, 100e6);
        vm.prank(attacker);
        vm.expectRevert();
        treasury.receiveProtocolFee(100e6);
    }

    function test_ReceiveProtocolFee_Revert_ZeroAmount() public {
        vm.prank(challenge);
        vm.expectRevert(NazarTreasury.ZeroAmount.selector);
        treasury.receiveProtocolFee(0);
    }

    // ─── receiveCompletionPool ─────────────────────────────────────────────────

    function test_ReceiveCompletionPool_Success() public {
        _fundTreasury(0, 850e6);
        assertEq(treasury.completionPool(), 850e6);
    }

    // ─── distributeBonus ──────────────────────────────────────────────────────

    function test_DistributeBonus_TwoWinners_ProportionalSplit() public {
        // Pool: 1000 USDC
        _fundTreasury(0, 1000e6);

        // alice: weight 3 (e.g. 300 USDC stake × 1 week)
        // bob:   weight 7 (e.g. 700 USDC stake × 1 week)
        address[] memory completers = new address[](2);
        uint256[] memory weights    = new uint256[](2);
        completers[0] = alice;
        completers[1] = bob;
        weights[0] = 3;
        weights[1] = 7;

        vm.prank(operator);
        treasury.distributeBonus(completers, weights);

        // alice: 1000 * 3/10 = 300 USDC
        // bob:   1000 * 7/10 = 700 USDC
        assertEq(usdc.balanceOf(alice), 300e6);
        assertEq(usdc.balanceOf(bob),   700e6);
        assertEq(treasury.completionPool(), 0);
    }

    function test_DistributeBonus_SingleWinner() public {
        _fundTreasury(0, 850e6);

        address[] memory completers = new address[](1);
        uint256[] memory weights    = new uint256[](1);
        completers[0] = alice;
        weights[0] = 1;

        vm.prank(operator);
        treasury.distributeBonus(completers, weights);

        assertEq(usdc.balanceOf(alice), 850e6);
        assertEq(treasury.completionPool(), 0);
    }

    function test_DistributeBonus_EmptyPool_NoOp() public {
        // completionPool is 0 — should not revert, just no-op
        address[] memory completers = new address[](1);
        uint256[] memory weights    = new uint256[](1);
        completers[0] = alice;
        weights[0] = 1;

        vm.prank(operator);
        treasury.distributeBonus(completers, weights); // should not revert
        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_DistributeBonus_Revert_ArrayMismatch() public {
        _fundTreasury(0, 500e6);

        address[] memory completers = new address[](2);
        uint256[] memory weights    = new uint256[](1);
        completers[0] = alice;
        completers[1] = bob;
        weights[0] = 1;

        vm.prank(operator);
        vm.expectRevert(NazarTreasury.ArrayLengthMismatch.selector);
        treasury.distributeBonus(completers, weights);
    }

    function test_DistributeBonus_Revert_EmptyArray() public {
        _fundTreasury(0, 500e6);

        address[] memory completers = new address[](0);
        uint256[] memory weights    = new uint256[](0);

        vm.prank(operator);
        vm.expectRevert(NazarTreasury.EmptyDistribution.selector);
        treasury.distributeBonus(completers, weights);
    }

    function test_DistributeBonus_Revert_Unauthorized() public {
        address[] memory completers = new address[](1);
        uint256[] memory weights    = new uint256[](1);

        vm.prank(attacker);
        vm.expectRevert();
        treasury.distributeBonus(completers, weights);
    }

    // ─── adminWithdraw ────────────────────────────────────────────────────────

    function test_AdminWithdraw_Success() public {
        _fundTreasury(200e6, 0);

        address recipient = makeAddr("recipient");
        vm.prank(admin);
        treasury.adminWithdraw(recipient, 150e6);

        assertEq(usdc.balanceOf(recipient), 150e6);
        assertEq(treasury.treasuryBalance(), 50e6);
    }

    function test_AdminWithdraw_Revert_Exceeds() public {
        _fundTreasury(100e6, 0);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(NazarTreasury.InsufficientTreasury.selector, 200e6, 100e6)
        );
        treasury.adminWithdraw(admin, 200e6);
    }

    function test_AdminWithdraw_Revert_Unauthorized() public {
        _fundTreasury(100e6, 0);

        vm.prank(attacker);
        vm.expectRevert();
        treasury.adminWithdraw(attacker, 100e6);
    }
}
