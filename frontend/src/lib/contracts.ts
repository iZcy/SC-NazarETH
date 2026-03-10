import abis from './abis.json'

// ─── Deployed addresses (Base Sepolia — MockUSDC, 2-min durations for PoC) ──
export const ADDRESSES = {
  MockUSDC:       '0x7E450bbceD79824BDb019a39D4147288159CA405',
  NazarRegistry:  '0x04a340843af2e6b98D6C73a34195D715954e6F8C',
  NazarOracle:    '0xf3A7a178C94152a8ad3eCcBc859DdcEf39763eBB',
  NazarYield:     '0xa68aE383B23D31730C0c5D1F8E2d869406f01CB3',
  NazarTreasury:  '0xAD2c206C02107D594B3B337Ce10950c14986205c',
  NazarChallenge: '0xB7dF500fec819efD7FC6F544C6A9B760d1cdEC2a',
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
