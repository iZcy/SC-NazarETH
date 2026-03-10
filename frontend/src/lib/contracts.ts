import abis from './abis.json'

// ─── Deployed addresses (local anvil — from DeployLocal.s.sol broadcast) ────
export const ADDRESSES = {
  MockUSDC:       '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  NazarRegistry:  '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
  NazarOracle:    '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  NazarYield:     '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
  NazarTreasury:  '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
  NazarChallenge: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
} as const

// ─── Anvil default accounts ──────────────────────────────────────────────────
export const ANVIL_ACCOUNTS = {
  admin: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',   // Account 0 — admin/oracle
  alice: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',   // Account 1
  bob:   '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',   // Account 2
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
