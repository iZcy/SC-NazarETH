import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import {
  ADDRESSES, NazarChallengeAbi, NazarOracleAbi, MockUSDAbi,
  formatUSDC, formatBps, formatDeadline, CHALLENGE_STATUS,
} from '../lib/contracts'

export default function ActiveChallengePage() {
  const { address, isConnected } = useAccount()

  const { data: challengeId, refetch: refetchId } = useReadContract({
    address: ADDRESSES.NazarChallenge,
    abi: NazarChallengeAbi,
    functionName: 'getActiveChallenge',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const { data: challenge, refetch: refetchChallenge } = useReadContract({
    address: ADDRESSES.NazarChallenge,
    abi: NazarChallengeAbi,
    functionName: 'getChallenge',
    args: [challengeId as bigint],
    query: { enabled: !!challengeId && challengeId !== 0n },
  }) as { data: any; refetch: () => void }

  const { data: progressBpsRaw, refetch: refetchProgress } = useReadContract({
    address: ADDRESSES.NazarOracle,
    abi: NazarOracleAbi,
    functionName: 'getProgressBps',
    args: [address as `0x${string}`, challengeId as bigint],
    query: { enabled: !!address && !!challengeId && challengeId !== 0n },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDAbi,
    functionName: 'allowance',
    args: [address as `0x${string}`, ADDRESSES.NazarChallenge],
    query: { enabled: !!address },
  })

  const { writeContract: approve, data: approveTx, isPending: approving } = useWriteContract()
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveTx })
  if (approveOk) refetchAllowance()

  const { writeContract: deposit, data: depositTx, isPending: depositing, error: depositErr } = useWriteContract()
  const { isSuccess: depositOk } = useWaitForTransactionReceipt({ hash: depositTx })
  if (depositOk) { refetchId(); refetchChallenge(); refetchProgress() }

  const { writeContract: withdrawMilestone, data: withdrawTx, isPending: withdrawing, error: withdrawErr } = useWriteContract()
  const { isSuccess: withdrawOk } = useWaitForTransactionReceipt({ hash: withdrawTx })
  if (withdrawOk) { refetchChallenge(); refetchProgress() }

  const { writeContract: finalize, data: finalizeTx, isPending: finalizing, error: finalizeErr } = useWriteContract()
  const { isSuccess: finalizeOk } = useWaitForTransactionReceipt({ hash: finalizeTx })
  if (finalizeOk) refetchChallenge()

  if (!isConnected) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>Connect your wallet.</p>
      </div>
    )
  }

  if (!challengeId || challengeId === 0n) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 24,
        }}>🎯</div>
        <h2 className="section-title" style={{ marginBottom: 8, fontSize: 20 }}>No Active Challenge</h2>
        <p style={{ color: 'var(--muted)' }}>Create one to get started!</p>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="card animate-in" style={{ padding: 24 }}>
        <div style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading...</div>
      </div>
    )
  }

  const status = Number(challenge.status)
  const stakeAmount = challenge.stakeAmount as bigint
  const withdrawnBps = challenge.withdrawnBps as bigint
  const progressBps = (progressBpsRaw ?? 0n) as bigint
  const milestones = Number(withdrawnBps) / 1000
  const deadline = challenge.deadline as bigint
  const isActive = status === 2
  const isCreated = status === 1
  const isFinalized = status === 3
  const now = BigInt(Math.floor(Date.now() / 1000))
  const pastDeadline = now > deadline + 120n
  const needsApproval = !allowance || (allowance as bigint) < stakeAmount
  const earnedMilestones = Math.floor(Number(progressBps) / 1000)
  const canWithdraw = isActive && earnedMilestones > milestones
  const anyErr = depositErr || withdrawErr || finalizeErr

  const statusConfig: Record<number, { color: string; bg: string }> = {
    1: { color: 'var(--warn)', bg: 'rgba(251,191,36,0.08)' },
    2: { color: 'var(--accent2)', bg: 'rgba(252,76,2,0.08)' },
    3: { color: 'var(--success)', bg: 'rgba(52,211,153,0.08)' },
  }

  return (
    <div style={{ maxWidth: 600 }} className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h1 className="section-title" style={{ margin: 0, fontSize: 22 }}>My Challenge</h1>
        <span style={{ fontSize: 15, color: 'var(--muted)' }}>#{String(challengeId as bigint)}</span>
      </div>

      <div className="card" style={{
        marginBottom: 16,
        background: statusConfig[status]?.bg ?? 'var(--surface)',
        border: `1px solid ${statusConfig[status]?.color ?? 'var(--border)'}33`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${statusConfig[status]?.color ?? 'var(--muted)'}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginRight: 14,
          }}>
            {isCreated ? '📋' : isActive ? '⚡' : isFinalized ? '✓' : '❓'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {CHALLENGE_STATUS[status] ?? 'Unknown'}
            </div>
          </div>
          <span className={`tag ml-auto ${status === 3 ? 'tag-green' : status === 2 ? 'tag-orange' : 'tag-yellow'}`}>
            {CHALLENGE_STATUS[status] ?? 'Unknown'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div>
            <div className="stat-label">Staked</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{formatUSDC(stakeAmount)} USDC</div>
          </div>
          <div>
            <div className="stat-label">Progress</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>{formatBps(progressBps)}</div>
          </div>
          <div>
            <div className="stat-label">Deadline</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{formatDeadline(deadline)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="stat-label">Milestones (10% each)</span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>
              {milestones} withdrawn / {earnedMilestones} earned
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const earned = i < earnedMilestones
              const withdrawn = i < milestones
              return (
                <div key={i} style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: withdrawn ? 'var(--success)' : earned ? 'var(--accent2)' : 'var(--border)',
                  transition: 'background .2s',
                }} />
              )
            })}
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

        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{formatBps(progressBps)} oracle progress</span>
          {canWithdraw && (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              {earnedMilestones - milestones} ready to withdraw
            </span>
          )}
        </div>
      </div>

      {anyErr && (
        <div className="error-box" style={{ marginBottom: 12 }}>
          {(anyErr as any).shortMessage ?? (anyErr as Error).message}
        </div>
      )}

      {isCreated && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(251,191,36,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>💰</div>
            <div>
              <div style={{ fontWeight: 700 }}>Deposit Required</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Deposit {formatUSDC(stakeAmount)} USDC to activate your challenge.
              </div>
            </div>
          </div>
          {needsApproval ? (
            <button className="btn-primary" style={{ width: '100%', padding: 12 }}
              disabled={approving}
              onClick={() => approve({
                address: ADDRESSES.MockUSDC, abi: MockUSDAbi,
                functionName: 'approve',
                args: [ADDRESSES.NazarChallenge, stakeAmount],
                chainId: baseSepolia.id,
              })}>
              {approving ? 'Confirming...' : `Approve ${formatUSDC(stakeAmount)} USDC`}
            </button>
          ) : (
            <button className="btn-success" style={{ width: '100%', padding: 12 }}
              disabled={depositing}
              onClick={() => deposit({
                address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
                functionName: 'deposit',
                args: [challengeId as bigint],
                chainId: baseSepolia.id,
              })}>
              {depositing ? 'Confirming...' : `Deposit ${formatUSDC(stakeAmount)} USDC`}
            </button>
          )}
        </div>
      )}

      {canWithdraw && (
        <div className="card" style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, var(--surface), rgba(52,211,153,0.04))',
          border: '1px solid rgba(52,211,153,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(52,211,153,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>💸</div>
            <div>
              <div style={{ fontWeight: 700 }}>Milestone Unlocked!</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Withdraw <strong style={{ color: 'var(--success)' }}>{earnedMilestones - milestones}</strong> milestone(s) — {(earnedMilestones - milestones) * 10}% of stake.
              </div>
            </div>
          </div>
          <button className="btn-success" style={{ width: '100%', padding: 12 }}
            disabled={withdrawing}
            onClick={() => withdrawMilestone({
              address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
              functionName: 'withdrawProgress',
              args: [challengeId as bigint],
              chainId: baseSepolia.id,
            })}>
            {withdrawing ? 'Confirming...' : 'Withdraw Milestone'}
          </button>
        </div>
      )}

      {isActive && pastDeadline && (
        <div className="card" style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, var(--surface), rgba(248,113,113,0.04))',
          border: '1px solid rgba(248,113,113,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(248,113,113,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>⏰</div>
            <div>
              <div style={{ fontWeight: 700 }}>Grace Period Passed</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Finalize to distribute remaining funds.
              </div>
            </div>
          </div>
          <button className="btn-danger" style={{ width: '100%', padding: 12 }}
            disabled={finalizing}
            onClick={() => finalize({
              address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
              functionName: 'finalize',
              args: [challengeId as bigint],
              chainId: baseSepolia.id,
            })}>
            {finalizing ? 'Confirming...' : 'Finalize Challenge'}
          </button>
        </div>
      )}

      {isFinalized && (
        <div className="success-box animate-in">
          Challenge finalized. Check your wallet balance.
        </div>
      )}
    </div>
  )
}
