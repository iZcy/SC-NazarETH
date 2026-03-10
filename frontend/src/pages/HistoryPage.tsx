import { useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { baseSepolia } from 'wagmi/chains'
import {
  ADDRESSES, NazarChallengeAbi,
  formatUSDC, formatDeadline, CHALLENGE_STATUS,
} from '../lib/contracts'

interface ChallengeRecord {
  id: bigint
  stakeAmount: bigint
  withdrawnBps: bigint
  deadline: bigint
  activityType: string
  targetValue: bigint
  status: number
}

const ACTIVITY_LABEL: Record<string, string> = {
  '0xd5b59c4d76e21fede15a8d63e16db9d1ac9104e77339e2cfebfe85c1f2d62f72': '🏃 Running',
  '0x9db3e7ab5e3cf96cef648e0e3e0571c5f1d4c5b4a2c5e8cb4b1a3f0e2cd8b49c': '🚴 Cycling',
  '0x4e9b29e634f4c9e1db7e3f7a4c3d1b8a4b3e6f2c8a1d4e7b0c3f2a6e9d5b8c1': '🏊 Swimming',
}

const BPS = 10_000n

export default function HistoryPage() {
  const { address, isConnected } = useAccount()
  const client = usePublicClient({ chainId: baseSepolia.id })

  const [records, setRecords] = useState<ChallengeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !client) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // 1. Get all ChallengeCreated events for this user
        const logs = await client!.getLogs({
          address: ADDRESSES.NazarChallenge as `0x${string}`,
          event: parseAbiItem(
            'event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, bytes32 activityType, uint256 targetValue, uint256 deadline, uint256 stakeAmount)'
          ),
          args: { challenger: address },
          fromBlock: 0n,
          toBlock: 'latest',
        })

        if (cancelled) return

        // 2. Read current on-chain state for each challenge
        const settled = await Promise.all(
          logs.map(async (log) => {
            const id = log.args.challengeId as bigint
            const data = await client!.readContract({
              address: ADDRESSES.NazarChallenge as `0x${string}`,
              abi: NazarChallengeAbi as any,
              functionName: 'getChallenge',
              args: [id],
            }) as any
            return {
              id,
              stakeAmount:  data.stakeAmount  as bigint,
              withdrawnBps: data.withdrawnBps as bigint,
              deadline:     data.deadline     as bigint,
              activityType: (data.activityType as string).toLowerCase(),
              targetValue:  data.targetValue  as bigint,
              status:       Number(data.status),
            }
          })
        )

        if (!cancelled) {
          // Sort newest first (highest ID first)
          setRecords(settled.sort((a, b) => Number(b.id - a.id)))
        }
      } catch (e: any) {
        if (!cancelled) setError(e.shortMessage ?? e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [address, client])

  if (!isConnected) return (
    <div className="card error-box">Connect your wallet to view history.</div>
  )

  const totalStaked  = records.reduce((s, r) => s + r.stakeAmount, 0n)
  const totalClaimed = records.reduce((s, r) => s + r.stakeAmount * r.withdrawnBps / BPS, 0n)
  const totalLost    = totalStaked - totalClaimed

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 20 }}>Challenge History</h2>

      {loading && (
        <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
          Loading challenge history…
        </div>
      )}

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && records.length === 0 && !error && (
        <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
          No challenges found for this wallet.
        </div>
      )}

      {/* Summary stats */}
      {records.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Challenges</div>
            <div className="stat-value">{records.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Staked</div>
            <div className="stat-value">{formatUSDC(totalStaked)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Claimed Back</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{formatUSDC(totalClaimed)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Lost (Penalty)</div>
            <div className="stat-value" style={{ color: totalLost > 0n ? 'var(--error, #f87171)' : 'var(--muted)' }}>{formatUSDC(totalLost)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>USDC</span></div>
          </div>
        </div>
      )}

      {/* Per-challenge list */}
      {records.map((r) => {
        const claimed = r.stakeAmount * r.withdrawnBps / BPS
        const lost    = r.stakeAmount - claimed
        const pct     = Number(r.withdrawnBps) / 100
        const isFinalized = r.status === 3
        const isActive    = r.status === 2

        const statusColor = r.status === 3
          ? (lost === 0n ? '#4ade80' : '#f87171')
          : r.status === 2 ? '#fbbf24' : 'var(--muted)'

        const resultLabel = !isFinalized
          ? CHALLENGE_STATUS[r.status] ?? 'Unknown'
          : lost === 0n ? '✓ Completed' : `✗ Penalized`

        return (
          <div key={String(r.id)} className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>
                Challenge #{String(r.id)}
                <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--muted)' }}>
                  {ACTIVITY_LABEL[r.activityType] ?? r.activityType.slice(0, 10)}
                </span>
              </strong>
              <span style={{
                marginLeft: 'auto',
                fontSize: 13, fontWeight: 600, padding: '2px 10px',
                borderRadius: 12, background: statusColor + '22', color: statusColor,
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
                <div style={{ fontWeight: 700 }}>{formatUSDC(r.stakeAmount)} USDC</div>
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
              Target: {String(r.targetValue)} m · Deadline: {formatDeadline(r.deadline)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
