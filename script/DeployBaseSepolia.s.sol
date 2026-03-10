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
 * @notice Base Sepolia deployment script (uses MockUSDC — permissionless mint).
 *
 * Required env vars:
 *   PRIVATE_KEY   Private key of the deployer/admin wallet
 *
 * Usage:
 *   forge script script/DeployBaseSepolia.s.sol \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast -vvv
 */
contract DeployBaseSepolia is Script {

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console2.log("Deployer:  ", deployer);
        console2.log("Chain ID:  ", block.chainid);
        require(block.chainid == 84532, "DeployBaseSepolia: wrong chain");

        vm.startBroadcast(deployerKey);

        // ── 1. MockUSDC ───────────────────────────────────────────────────────
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC:       ", address(usdc));

        // Seed deployer with 1,000,000 USDC
        usdc.mint(deployer, 1_000_000e6);

        // ── 2. Core Contracts ─────────────────────────────────────────────────
        NazarRegistry registry = new NazarRegistry(deployer, deployer, true); // devMode=true for demo
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
        bytes32 CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
        yieldVault.grantRole(CHALLENGE_ROLE, address(challenge));
        treasury.grantRole(CHALLENGE_ROLE, address(challenge));

        vm.stopBroadcast();

        console2.log("\n=== NazarETH deployed to Base Sepolia ===");
        console2.log("Deployer/Oracle/Admin: ", deployer);
    }
}
