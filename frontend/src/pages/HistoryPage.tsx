import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import {
  ADDRESSES, NazarChallengeAbi,
  formatUSDC, formatDeadline, CHALLENGE_STATUS,
} from '../lib/contracts'

const ACTIVITY_LABEL: Record<string, string> = {
  '0xd5b59c4d76e21fede15a8d63e16db9d1ac9104e77339e2cfebfe85c1f2d62f72': '🏃 Running',
  '0x9db3e7ab5e3cf96cef648e0e3e0571c5f1d4c5b4a2c5e8cb4b1a3f0e2cd8b49c': '🚴 Cycling',
  '0x4e9b29e634f4c9e1db7e3f7a4c3d1b8a4b3e6f2c8a1d4e7b0c3f2a6e9d5b8c1': '🏊 Swimming',
}

const BPS = 10_000n
const CONTRACT = { address: ADDRESSES.NazarChallenge as `0x${string}`, abi: NazarChallengeAbi as any }

export default function HistoryPage() {
  const { address, isConnected } = useAccount()

  // 1. Get total challenge count
  const { data: counter } = useReadContract({
    ...CONTRACT,
    functionName: 'challengeCounter',
  })

  const total = Number(counter ?? 0n)

  // 2. Batch-read all challenges via multicall
  const { data: allChallenges, isLoading } = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      ...CONTRACT,
      functionName: 'getChallenge',
      args: [BigInt(i + 1)],
    })),
    query: { enabled: total > 0 },
  })

  if (!isConnected) return (
    <div className="card error-box">Connect your wallet to view history.</div>
  )

  if (isLoading || (total > 0 && !allChallenges)) return (
    <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
      Loading challenge history…
    </div>
  )

  // 3. Filter to this user's challenges
  const mine = (allChallenges ?? [])
    .map((r, i) => ({ id: BigInt(i + 1), data: r?.result as any }))
    .filter(({ data }) => data && (data.challenger as string).toLowerCase() === address?.toLowerCase())
    .reverse() // newest first

  const totalStaked  = mine.reduce((s, { data: d }) => s + (d.stakeAmount as bigint), 0n)
  const totalClaimed = mine.reduce((s, { data: d }) => s + (d.stakeAmount as bigint) * (d.withdrawnBps as bigint) / BPS, 0n)
  const totalLost    = totalStaked - totalClaimed

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 20 }}>Challenge History</h2>

      {total === 0 && (
        <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
          No challenges found on-chain yet.
        </div>
      )}

      {total > 0 && mine.length === 0 && (
        <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
          No challenges found for this wallet.
        </div>
      )}

      {/* Summary */}
      {mine.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Challenges</div>
            <div className="stat-value">{mine.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Staked</div>
            <div className="stat-value">{formatUSDC(totalStaked)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Claimed Back</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{formatUSDC(totalClaimed)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lost (Penalty)</div>
            <div className="stat-value" style={{ color: totalLost > 0n ? '#f87171' : 'var(--muted)' }}>{formatUSDC(totalLost)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
        </div>
      )}

      {/* Per-challenge cards */}
      {mine.map(({ id, data: d }) => {
        const stakeAmount  = d.stakeAmount  as bigint
        const withdrawnBps = d.withdrawnBps as bigint
        const status       = Number(d.status)
        const claimed      = stakeAmount * withdrawnBps / BPS
        const lost         = stakeAmount - claimed
        const pct          = Number(withdrawnBps) / 100
        const isFinalized  = status === 3
        const isActive     = status === 2
        const actType      = (d.activityType as string).toLowerCase()

        const statusColor = isFinalized
          ? (lost === 0n ? '#4ade80' : '#f87171')
          : isActive ? '#fbbf24' : 'var(--muted)'

        const resultLabel = isFinalized
          ? (lost === 0n ? '✓ Completed' : '✗ Penalized')
          : CHALLENGE_STATUS[status] ?? 'Unknown'

        return (
          <div key={String(id)} className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>
                Challenge #{String(id)}
                <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--muted)' }}>
                  {ACTIVITY_LABEL[actType] ?? '🏅 Activity'}
                </span>
              </strong>
              <span style={{
                marginLeft: 'auto', fontSize: 13, fontWeight: 600,
                padding: '2px 10px', borderRadius: 12,
                background: statusColor + '22', color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}>
                {resultLabel}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, pct)}%`,
                background: lost === 0n && isFinalized ? '#4ade80' : 'var(--accent)',
                transition: 'width .3s',
              }} />
            </div>

            <div className="stat-grid">
              <div>
                <div className="stat-label">Staked</div>
                <div style={{ fontWeight: 700 }}>{formatUSDC(stakeAmount)} USDC</div>
              </div>
              <div>
                <div className="stat-label">Progress withdrawn</div>
                <div style={{ fontWeight: 700 }}>{pct.toFixed(0)}%</div>
              </div>
              <div>
                <div className="stat-label">Claimed back</div>
                <div style={{ fontWeight: 700, color: '#4ade80' }}>{formatUSDC(claimed)} USDC</div>
              </div>
              <div>
                <div className="stat-label">{isActive ? 'At risk' : 'Lost'}</div>
                <div style={{ fontWeight: 700, color: lost > 0n ? '#f87171' : 'var(--muted)' }}>
                  {formatUSDC(lost)} USDC
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              Target: {String(d.targetValue as bigint)} m · Deadline: {formatDeadline(d.deadline as bigint)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
