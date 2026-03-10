import { useAccount, useReadContract } from 'wagmi'
import type { Page } from '../App'
import {
  ADDRESSES, NazarRegistryAbi, NazarChallengeAbi, NazarOracleAbi, MockUSDAbi,
  formatUSDC, formatBps, formatDeadline, CHALLENGE_STATUS,
} from '../lib/contracts'

interface Props { onNavigate: (p: Page) => void }

export default function DashboardPage({ onNavigate }: Props) {
  const { address, isConnected } = useAccount()

  const { data: isRegistered } = useReadContract({
    address: ADDRESSES.NazarRegistry,
    abi: NazarRegistryAbi,
    functionName: 'isRegistered',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const { data: stravaId } = useReadContract({
    address: ADDRESSES.NazarRegistry,
    abi: NazarRegistryAbi,
    functionName: 'getStravaId',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!isRegistered },
  })

  const { data: usdcBalance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDAbi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const { data: challengeId } = useReadContract({
    address: ADDRESSES.NazarChallenge,
    abi: NazarChallengeAbi,
    functionName: 'getActiveChallenge',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const { data: challenge } = useReadContract({
    address: ADDRESSES.NazarChallenge,
    abi: NazarChallengeAbi,
    functionName: 'getChallenge',
    args: [challengeId as bigint],
    query: { enabled: challengeId !== undefined && challengeId !== 0n },
  }) as { data: any }

  const { data: progressBpsRaw } = useReadContract({
    address: ADDRESSES.NazarOracle,
    abi: NazarOracleAbi,
    functionName: 'getProgressBps',
    args: [address as `0x${string}`, challengeId as bigint],
    query: { enabled: !!address && !!challengeId && challengeId !== 0n },
  })

  if (!isConnected) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛓️</div>
        <h2 style={{ color: 'var(--accent2)', marginBottom: 8 }}>Welcome to NazarETH</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
          A self-discipline staking dApp. Stake USDC against your Strava fitness goals.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Connect your wallet to get started.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: 'var(--accent2)' }}>Dashboard</h2>

      {/* Account stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">USDC Balance</div>
          <div className="stat-value">{usdcBalance !== undefined ? formatUSDC(usdcBalance as bigint) : '…'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Registration</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {isRegistered === undefined ? '…' : (isRegistered as boolean)
              ? <span style={{ color: 'var(--success)' }}>✓ Registered</span>
              : <span style={{ color: 'var(--warn)' }}>Not registered</span>
            }
          </div>
        </div>
        {(isRegistered as boolean | undefined) && stravaId !== undefined && (
          <div className="stat-card">
            <div className="stat-label">Strava Athlete ID</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{String(stravaId as bigint)}</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Active Challenge</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {challengeId === undefined ? '…' : challengeId === 0n
              ? <span style={{ color: 'var(--muted)' }}>None</span>
              : <span style={{ color: 'var(--accent2)' }}>#{String(challengeId as bigint)}</span>
            }
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {!isRegistered && (
        <div className="card">
          <div className="row">
            <div>
              <strong>Get started</strong>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Register your Strava account to create challenges.
              </p>
            </div>
            <button className="btn-primary ml-auto" onClick={() => onNavigate('register')}>
              Register →
            </button>
          </div>
        </div>
      )}

      {isRegistered && (!challengeId || challengeId === 0n) && (
        <div className="card">
          <div className="row">
            <div>
              <strong>Create a challenge</strong>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Stake USDC and commit to a fitness goal.
              </p>
            </div>
            <button className="btn-primary ml-auto" onClick={() => onNavigate('new-challenge')}>
              New Challenge →
            </button>
          </div>
        </div>
      )}

      {/* Active challenge preview */}
      {challenge && (
        <div className="card">
          <div style={{ marginBottom: 12 }} className="row">
            <strong>Active Challenge #{String(challengeId as bigint)}</strong>
            <span className={`tag ml-auto tag-${['purple','purple','yellow','green'][Number((challenge as any).status)] || 'purple'}`}>
              {CHALLENGE_STATUS[Number((challenge as any).status)] ?? 'Unknown'}
            </span>
          </div>
          <div className="stat-grid">
            <div>
              <div className="stat-label">Staked</div>
              <div style={{ fontWeight: 700 }}>{formatUSDC((challenge as any).stakeAmount)} USDC</div>
            </div>
            <div>
              <div className="stat-label">Progress</div>
              <div style={{ fontWeight: 700 }}>{formatBps((progressBpsRaw ?? 0n) as bigint)}</div>
            </div>
            <div>
              <div className="stat-label">Deadline</div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{formatDeadline((challenge as any).deadline)}</div>
            </div>
            <div>
              <div className="stat-label">Milestones withdrawn</div>
              <div style={{ fontWeight: 700 }}>{String(Number((challenge as any).withdrawnBps ?? 0n) / 1000)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn-primary" onClick={() => onNavigate('active')}>Manage Challenge →</button>
          </div>
        </div>
      )}
    </div>
  )
}
