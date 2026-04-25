import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
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

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
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

  const { writeContract: mintUsdc, data: mintTx, isPending: minting } = useWriteContract()
  const { isSuccess: mintOk } = useWaitForTransactionReceipt({ hash: mintTx, query: { enabled: !!mintTx } })
  if (mintOk) refetchBalance()

  if (!isConnected) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: '56px 32px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(252,76,2,0.15), rgba(252,76,2,0.05))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 32,
        }}>⛓️</div>
        <h1 className="section-title" style={{ marginBottom: 10 }}>
          Welcome to <span style={{ color: 'var(--accent2)' }}>NazarETH</span>
        </h1>
        <p style={{ color: 'var(--text2)', maxWidth: 420, margin: '0 auto 8px', lineHeight: 1.6 }}>
          Stake USDC against your Strava fitness goals. Hit your target — keep your funds.
          Miss it — lose the unearned portion.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Connect your wallet to get started.
        </p>
      </div>
    )
  }

  const progressBps = (progressBpsRaw ?? 0n) as bigint
  const statusColors: Record<number, string> = { 1: 'tag-yellow', 2: 'tag-yellow', 3: 'tag-green' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 className="section-title" style={{ margin: 0 }}>Dashboard</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>

      <div className="stat-grid animate-in">
        <div className="stat-card">
          <div className="stat-label">USDC Balance</div>
          <div className="stat-value" style={{ color: 'var(--accent2)' }}>
            {usdcBalance !== undefined ? formatUSDC(usdcBalance as bigint) : '...'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Registration</div>
          <div style={{ marginTop: 4 }}>
            {isRegistered === undefined ? '...'
              : (isRegistered as boolean)
                ? <span className="tag tag-green">✓ Registered</span>
                : <span className="tag tag-yellow">Not registered</span>
            }
          </div>
        </div>
        {(isRegistered as boolean | undefined) && stravaId !== undefined && (
          <div className="stat-card">
            <div className="stat-label">Strava Athlete ID</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{String(stravaId as bigint)}</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Active Challenge</div>
          <div style={{ marginTop: 4 }}>
            {challengeId === undefined ? '...'
              : challengeId === 0n
                ? <span className="tag tag-yellow">None</span>
                : <span className="tag tag-orange">#{String(challengeId as bigint)}</span>
            }
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{
        background: 'linear-gradient(135deg, var(--surface), rgba(252,76,2,0.04))',
        border: '1px solid rgba(252,76,2,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'rgba(252,76,2,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🚰</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>MockUSDC Faucet</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              Mint 1,000 test USDC — free on devnet.
              Current balance: <strong style={{ color: 'var(--accent2)' }}>
                {usdcBalance !== undefined ? formatUSDC(usdcBalance as bigint) : '...'} USDC
              </strong>
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ whiteSpace: 'nowrap', padding: '10px 22px' }}
            disabled={minting || !address}
            onClick={() => mintUsdc({
              address: ADDRESSES.MockUSDC,
              abi: MockUSDAbi,
              functionName: 'mint',
              args: [address as `0x${string}`, 1000n * 10n ** 6n],
              chainId: baseSepolia.id,
            })}
          >
            {minting ? 'Minting...' : 'Get 1,000 USDC'}
          </button>
        </div>
        {mintOk && (
          <div className="success-box" style={{ marginTop: 12 }}>
            ✓ 1,000 USDC minted to your wallet!
          </div>
        )}
      </div>

      {!isRegistered && (
        <div className="card animate-in" style={{
          background: 'linear-gradient(135deg, var(--surface), rgba(52,211,153,0.03))',
          border: '1px solid rgba(52,211,153,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(52,211,153,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Get Started</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Register your Strava account to create challenges.
              </div>
            </div>
            <button className="btn-success" style={{ whiteSpace: 'nowrap' }} onClick={() => onNavigate('register')}>
              Register →
            </button>
          </div>
        </div>
      )}

      {isRegistered && (!challengeId || challengeId === 0n) && (
        <div className="card animate-in" style={{
          background: 'linear-gradient(135deg, var(--surface), rgba(252,76,2,0.04))',
          border: '1px solid rgba(252,76,2,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(252,76,2,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>🎯</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Create a Challenge</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Stake USDC and commit to a fitness goal.
              </div>
            </div>
            <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => onNavigate('new-challenge')}>
              New Challenge →
            </button>
          </div>
        </div>
      )}

      {challenge && (
        <div className="card animate-in" style={{
          background: 'linear-gradient(135deg, var(--surface), rgba(251,191,36,0.03))',
          border: '1px solid rgba(251,191,36,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(251,191,36,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginRight: 14,
            }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Active Challenge #{String(challengeId as bigint)}
              </div>
              <span className={`tag ${statusColors[Number((challenge as any).status)] ?? 'tag-orange'}`}>
                {CHALLENGE_STATUS[Number((challenge as any).status)] ?? 'Unknown'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div className="stat-label">Staked</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{formatUSDC((challenge as any).stakeAmount)} USDC</div>
            </div>
            <div>
              <div className="stat-label">Progress</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>{formatBps(progressBps)}</div>
            </div>
            <div>
              <div className="stat-label">Deadline</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{formatDeadline((challenge as any).deadline)}</div>
            </div>
          </div>

          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{
              width: `${Math.min(100, Number(progressBps) / 100)}%`,
              background: progressBps >= 10000n
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #FC4C02, #ff7e3a)',
            }} />
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="btn-primary" onClick={() => onNavigate('active')}>
              Manage Challenge →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
