# NazarETH Agent Instructions

## Project Structure
- **Smart contracts**: Foundry project in root (`src/`, `test/`, `script/`)
- **Frontend**: React + Vite in `frontend/` with wagmi/viem for Web3
- **Dependencies**: OpenZeppelin contracts, forge-std (git submodules in `lib/`)

## Development Commands

### Smart Contracts (Foundry)
```bash
# Build contracts
forge build

# Run all tests
forge test

# Run specific test
forge test --match-test testName

# Format code (check only: forge fmt --check)
forge fmt

# Gas snapshot
forge snapshot
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Dev server
npm run build      # Production build (runs tsc + vite build)
```

### Deployment
```bash
# Local (Anvil)
forge script script/DeployLocal.s.sol --broadcast

# Base Sepolia (requires PRIVATE_KEY env var)
forge script script/DeployBaseSepolia.s.sol --rpc-url https://sepolia.base.org --broadcast

# Verify on Etherscan (requires BASESCAN_API_KEY)
forge verify-contract <address> <contract> --chain-id 84532
```

## Configuration Notes

### Foundry
- Solidity version: 0.8.26
- Compiler optimizer enabled (200 runs, via IR)
- Test profile CI runs in GitHub Actions
- RPC endpoints: `localhost`, `base_sepolia`, `base_mainnet`
- Etherscan verification configured for Base Sepolia/Mainnet
- Format: 100 char line length, 4-space tabs, bracket spacing

### Frontend
- TypeScript strict mode enabled
- No unused locals/parameters checks disabled
- `global` polyfilled to `globalThis` in vite.config.ts

## Testing Quirks
- Tests use MockUSDC (`src/mocks/MockUSDC.sol`) for USDC with permissionless minting
- Deploy scripts use `devMode=true` in NazarRegistry for demo purposes
- Test helpers often pattern-match role constants like `CHALLENGE_ROLE`

## Contract Architecture
Core system with role-based access:
- `NazarRegistry`: User-Strava linking, admin controls
- `NazarOracle`: Backend-submitted progress updates (ORACLE_ROLE)
- `NazarYield`: USDC vault for staked funds (CHALLENGE_ROLE can deposit/withdraw)
- `NazarTreasury`: Failed challenge penalties split 15% treasury / 85% completion pool
- `NazarChallenge`: Main commitment contract (PAUSER_ROLE, OPERATOR_ROLE)

Critical constants in NazarChallenge:
- Progress in basis points (10000 = 100%)
- Withdrawal milestones: 10% steps (1000 bps)
- MIN_DURATION and GRACE_PERIOD set to 2 minutes for PoC demo

## CI/CD
- GitHub Actions runs: `forge fmt --check`, `forge build --sizes`, `forge test -vvv`
- Submodules checked out recursively
- Uses foundry-rs/foundry-toolchain@v1
