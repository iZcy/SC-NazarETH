// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/NazarRegistry.sol";

/**
 * @notice Tests for NazarRegistry — wallet ↔ Strava immutable binding.
 */
contract NazarRegistryTest is Test {

    NazarRegistry public registry;

    address public admin  = makeAddr("admin");
    address public oracle = makeAddr("oracle");
    address public alice  = makeAddr("alice");
    address public bob    = makeAddr("bob");

    uint256 internal oracleKey;

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function setUp() public {
        (address oracleSigner, uint256 key) = makeAddrAndKey("oracleKey");
        oracleKey = key;
        oracle = oracleSigner;

        registry = new NazarRegistry(admin, oracle, false);
    }

    function _signRegistration(
        address wallet,
        uint256 stravaId,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.REGISTER_TYPEHASH(),
                wallet,
                stravaId,
                nonce,
                deadline
            )
        );
        bytes32 digest = registry.hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ─── devRegister ───────────────────────────────────────────────────────────

    function test_DevRegister_Revert_WhenDevModeOff() public {
        // registry was deployed with devMode = false
        vm.prank(alice);
        vm.expectRevert("devMode disabled");
        registry.devRegister(99999999);
    }

    function test_DevRegister_Success_WhenDevModeOn() public {
        NazarRegistry devRegistry = new NazarRegistry(admin, oracle, true);

        vm.prank(alice);
        devRegistry.devRegister(99999999);

        assertTrue(devRegistry.isRegistered(alice));
        assertEq(devRegistry.getStravaId(alice), 99999999);
    }

    // ─── Happy path ────────────────────────────────────────────────────────────

    function test_Register_Success() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(alice);

        bytes memory sig = _signRegistration(alice, stravaId, nonce, deadline);

        vm.prank(alice);
        registry.register(stravaId, deadline, sig);

        assertTrue(registry.isRegistered(alice));
        assertEq(registry.getStravaId(alice), stravaId);
        assertEq(registry.getWallet(stravaId), alice);
    }

    // ─── Double registration guard ─────────────────────────────────────────────

    function test_Register_Revert_AlreadyRegistered() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signRegistration(alice, stravaId, registry.nonces(alice), deadline);
        vm.prank(alice);
        registry.register(stravaId, deadline, sig);

        // Alice tries to register again with a different stravaId
        uint256 stravaId2 = 99999999;
        bytes memory sig2 = _signRegistration(alice, stravaId2, registry.nonces(alice), deadline);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NazarRegistry.AlreadyRegistered.selector, alice));
        registry.register(stravaId2, deadline, sig2);
    }

    function test_Register_Revert_StravaIdAlreadyBound() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp + 1 hours;

        // Alice registers stravaId
        bytes memory sig = _signRegistration(alice, stravaId, registry.nonces(alice), deadline);
        vm.prank(alice);
        registry.register(stravaId, deadline, sig);

        // Bob tries to register the same stravaId
        bytes memory sig2 = _signRegistration(bob, stravaId, registry.nonces(bob), deadline);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(NazarRegistry.StravaIdAlreadyBound.selector, stravaId)
        );
        registry.register(stravaId, deadline, sig2);
    }

    // ─── Signature guards ──────────────────────────────────────────────────────

    function test_Register_Revert_InvalidSignature() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp + 1 hours;

        // Sign with a random key (not oracle)
        (, uint256 randomKey) = makeAddrAndKey("random");
        bytes32 structHash = keccak256(
            abi.encode(registry.REGISTER_TYPEHASH(), alice, stravaId, registry.nonces(alice), deadline)
        );
        bytes32 digest = registry.hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(randomKey, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert(NazarRegistry.InvalidSignature.selector);
        registry.register(stravaId, deadline, badSig);
    }

    function test_Register_Revert_SignatureExpired() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp - 1; // already expired

        bytes memory sig = _signRegistration(alice, stravaId, registry.nonces(alice), deadline);

        vm.prank(alice);
        vm.expectRevert(NazarRegistry.SignatureExpired.selector);
        registry.register(stravaId, deadline, sig);
    }

    function test_Register_Revert_NonceReuse() public {
        uint256 stravaId = 12345678;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = registry.nonces(alice);

        // First registration succeeds
        bytes memory sig = _signRegistration(alice, stravaId, nonce, deadline);
        vm.prank(alice);
        registry.register(stravaId, deadline, sig);

        // Bob tries to reuse alice's signed data (same nonce 0) on his own call
        // This should fail because nonce has advanced for alice, and the signature was for alice
        uint256 stravaId2 = 99999999;
        bytes memory sig2 = _signRegistration(bob, stravaId2, nonce, deadline); // nonce=0 for bob still
        vm.prank(bob);
        registry.register(stravaId2, deadline, sig2); // bob's nonce is still 0 — should succeed
        assertTrue(registry.isRegistered(bob));
    }

    // ─── View functions ────────────────────────────────────────────────────────

    function test_IsNotRegistered_Default() public view {
        assertFalse(registry.isRegistered(alice));
        assertEq(registry.getStravaId(alice), 0);
        assertEq(registry.getWallet(99999999), address(0));
    }
}
