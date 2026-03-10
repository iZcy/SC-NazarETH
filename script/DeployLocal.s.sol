// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/NazarRegistry.sol";
import "../src/NazarOracle.sol";
import "../src/NazarYield.sol";
import "../src/NazarTreasury.sol";
import "../src/NazarChallenge.sol";

/**
 * @notice Local deployment script. Deploys all contracts and wires roles.
 *
 * Usage (no private key needed — Anvil handles signing):
 *   forge script script/DeployLocal.s.sol \
 *     --rpc-url http://localhost:8545 \
 *     --sender 0x66534dD42A65a2386aA9cB9c36d37A35c01C77b6 \
 *     --unlocked --broadcast -vvv
 */
contract DeployLocal is Script {

    function run() external {
        address deployer = msg.sender; // set via --sender flag, no private key needed

        vm.startBroadcast();

        // ── 1. Mock USDC ───────────────────────────────────────────────────────
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC:       ", address(usdc));

        // Seed deployer and 5 test addresses with 100,000 USDC each
        usdc.mint(deployer, 100_000e6);
        address[5] memory testAccounts = [
            address(0x1111111111111111111111111111111111111111),
            address(0x2222222222222222222222222222222222222222),
            address(0x3333333333333333333333333333333333333333),
            address(0x4444444444444444444444444444444444444444),
            address(0x5555555555555555555555555555555555555555)
        ];
        for (uint256 i = 0; i < testAccounts.length; i++) {
            usdc.mint(testAccounts[i], 100_000e6);
        }

        // ── 2. Core Contracts ─────────────────────────────────────────────────
        // Oracle signer = deployer for local testing. devMode = true for local.
        NazarRegistry registry = new NazarRegistry(deployer, deployer, true);
        console2.log("NazarRegistry:  ", address(registry));

        NazarOracle oracle = new NazarOracle(deployer, deployer);
        console2.log("NazarOracle:    ", address(oracle));

        NazarYield yieldVault = new NazarYield(deployer, address(usdc));
        console2.log("NazarYield:     ", address(yieldVault));

        NazarTreasury treasury = new NazarTreasury(deployer, address(usdc));
        console2.log("NazarTreasury:  ", address(treasury));

        NazarChallenge challenge = new NazarChallenge(
            deployer,
            address(registry),
            address(oracle),
            address(yieldVault),
            address(treasury),
            address(usdc)
        );
        console2.log("NazarChallenge: ", address(challenge));

        // ── 3. Wire Roles ─────────────────────────────────────────────────────
        // NazarYield: grant CHALLENGE_ROLE to NazarChallenge
        bytes32 CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
        yieldVault.grantRole(CHALLENGE_ROLE, address(challenge));

        // NazarTreasury: grant CHALLENGE_ROLE to NazarChallenge
        treasury.grantRole(CHALLENGE_ROLE, address(challenge));

        // NazarTreasury: deployer already has OPERATOR_ROLE (from constructor)

        vm.stopBroadcast();

        console2.log("\n=== Deployment complete (local) ===");
        console2.log("Deployer/Oracle/Admin: ", deployer);
    }
}
