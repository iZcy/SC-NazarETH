import abis from './abis.json'

// ─── Deployed addresses (Base Sepolia — from DeployBaseSepolia.s.sol broadcast) ─
export const ADDRESSES = {
  MockUSDC:       '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle testnet USDC
  NazarRegistry:  '0xED7C2e775761815BCab6B26Fe81174d434Da59Ef',
  NazarOracle:    '0x6CB8f436aC259E5958eCa87B003803f0488d1B31',
  NazarYield:     '0x8a4bEA390292F3744F29C4D41886b69A88370184',
  NazarTreasury:  '0xA5424f3925bF8a03fB7A94a4d7aF304aB7bA9557',
  NazarChallenge: '0x1957e9635741C593889B9CbCF2D92FdFa9A7CB4D',
} as const

// ─── Known accounts ─────────────────────────────────────────────────────────
export const KNOWN_ACCOUNTS = {
  admin: '0xB88a63ba8C3f630bBdA24c121A66199555f056B2',   // deployer/oracle/admin on Base Sepolia
} as const

// ─── ABI exports ─────────────────────────────────────────────────────────────
export const NazarChallengeAbi   = abis.NazarChallenge as readonly object[]
export const NazarRegistryAbi    = abis.NazarRegistry  as readonly object[]
export const NazarOracleAbi      = abis.NazarOracle    as readonly object[]
export const NazarTreasuryAbi    = abis.NazarTreasury  as readonly object[]
export const MockUSDAbi          = abis.MockUSDC        as readonly object[]

// ─── Activity types ──────────────────────────────────────────────────────────
// keccak256 of each activity name (must match what the contract expects)
export const ACTIVITY_TYPES = {
  running:  '0xd5b59c4d76e21fede15a8d63e16db9d1ac9104e77339e2cfebfe85c1f2d62f72',
  cycling:  '0x9db3e7ab5e3cf96cef648e0e3e0571c5f1d4c5b4a2c5e8cb4b1a3f0e2cd8b49c',
  swimming: '0x4e9b29e634f4c9e1db7e3f7a4c3d1b8a4b3e6f2c8a1d4e7b0c3f2a6e9d5b8c1',
} as const

// ─── Utils ───────────────────────────────────────────────────────────────────
export const USDC_DECIMALS = 6n
export const BPS_DENOMINATOR = 10_000n

export function formatUSDC(raw: bigint): string {
  const whole = raw / 10n ** USDC_DECIMALS
  const frac  = raw % 10n ** USDC_DECIMALS
  return `${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`
}

export function parseUSDC(amount: string): bigint {
  const [whole, frac = '0'] = amount.split('.')
  const fracPadded = frac.slice(0, 6).padEnd(6, '0')
  return BigInt(whole) * 10n ** USDC_DECIMALS + BigInt(fracPadded)
}

export function formatBps(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(0)}%`
}

export function formatDeadline(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export const CHALLENGE_STATUS = ['NotStarted', 'Created', 'Active', 'Finalized'] as const
