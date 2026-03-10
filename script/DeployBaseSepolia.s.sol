// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/NazarRegistry.sol";
import "../src/NazarOracle.sol";
import "../src/NazarYield.sol";
import "../src/NazarTreasury.sol";
import "../src/NazarChallenge.sol";

/**
 * @notice Base Sepolia deployment script (uses Circle's real testnet USDC).
 *
 * Required env vars:
 *   PRIVATE_KEY       Private key of the deployer/admin wallet
 *   ORACLE_SIGNER     EOA address of the NazarETH backend oracle signer
 *   TREASURY_ADMIN    EOA address that receives admin control over treasury
 *   BASESCAN_API_KEY  For contract verification
 *
 * Usage:
 *   forge script script/DeployBaseSepolia.s.sol \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployBaseSepolia is Script {

    // Circle's official USDC on Base Sepolia
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address deployer     = vm.addr(deployerKey);
        address oracleSigner = vm.envAddress("ORACLE_SIGNER");
        address treasuryAdmin = vm.envAddress("TREASURY_ADMIN");

        console2.log("Deployer:       ", deployer);
        console2.log("Oracle signer:  ", oracleSigner);
        console2.log("Treasury admin: ", treasuryAdmin);
        console2.log("USDC:           ", USDC_BASE_SEPOLIA);
        console2.log("Chain ID:       ", block.chainid);
        require(block.chainid == 84532, "DeployBaseSepolia: wrong chain");

        vm.startBroadcast(deployerKey);

        // ── 1. Core Contracts ─────────────────────────────────────────────────
        NazarRegistry registry = new NazarRegistry(deployer, oracleSigner);
        console2.log("NazarRegistry:  ", address(registry));

        NazarOracle oracle = new NazarOracle(deployer, oracleSigner);
        console2.log("NazarOracle:    ", address(oracle));

        NazarYield yieldVault = new NazarYield(deployer, USDC_BASE_SEPOLIA);
        console2.log("NazarYield:     ", address(yieldVault));

        NazarTreasury treasury = new NazarTreasury(treasuryAdmin, USDC_BASE_SEPOLIA);
        console2.log("NazarTreasury:  ", address(treasury));

        NazarChallenge challenge = new NazarChallenge(
            deployer,
            address(registry),
            address(oracle),
            address(yieldVault),
            address(treasury),
            USDC_BASE_SEPOLIA
        );
        console2.log("NazarChallenge: ", address(challenge));

        // ── 2. Wire Roles ─────────────────────────────────────────────────────
        bytes32 CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
        yieldVault.grantRole(CHALLENGE_ROLE, address(challenge));
        treasury.grantRole(CHALLENGE_ROLE, address(challenge));

        // ── 3. Transfer admin roles to treasury admin if different from deployer
        if (treasuryAdmin != deployer) {
            bytes32 DEFAULT_ADMIN_ROLE = 0x00;

            // NazarTreasury admin is already treasuryAdmin (set in constructor)
            // Transfer NazarYield admin to deployer (intentional: ops team may differ)
            // Transfer NazarChallenge admin to deployer
            // NOTE: deployer retains admin on registry and oracle for oracle key rotation
            console2.log("Role wiring complete. Deployer retains admin on Registry/Oracle/Challenge.");
        }

        vm.stopBroadcast();

        console2.log("\n=== NazarETH deployed to Base Sepolia ===");
        console2.log("Verify all contracts on https://sepolia.basescan.org");
    }
}
