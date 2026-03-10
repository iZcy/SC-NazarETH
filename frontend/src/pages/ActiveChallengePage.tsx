import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import {
  ADDRESSES, NazarChallengeAbi, MockUSDAbi,
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

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDAbi,
    functionName: 'allowance',
    args: [address as `0x${string}`, ADDRESSES.NazarChallenge],
    query: { enabled: !!address },
  })

  // Approve
  const { writeContract: approve, data: approveTx, isPending: approving } = useWriteContract()
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveTx })
  if (approveOk) refetchAllowance()

  // Deposit
  const { writeContract: deposit, data: depositTx, isPending: depositing, error: depositErr } = useWriteContract()
  const { isSuccess: depositOk } = useWaitForTransactionReceipt({ hash: depositTx })
  if (depositOk) { refetchId(); refetchChallenge() }

  // WithdrawProgress
  const { writeContract: withdrawMilestone, data: withdrawTx, isPending: withdrawing, error: withdrawErr } = useWriteContract()
  const { isSuccess: withdrawOk } = useWaitForTransactionReceipt({ hash: withdrawTx })
  if (withdrawOk) refetchChallenge()

  // Finalize
  const { writeContract: finalize, data: finalizeTx, isPending: finalizing, error: finalizeErr } = useWriteContract()
  const { isSuccess: finalizeOk } = useWaitForTransactionReceipt({ hash: finalizeTx })
  if (finalizeOk) refetchChallenge()

  if (!isConnected) return <div className="card error-box">Connect your wallet.</div>
  if (!challengeId || challengeId === 0n) {
    return <div className="card" style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
      No active challenge found. Create one first!
    </div>
  }
  if (!challenge) return <div className="card" style={{ color: 'var(--muted)', padding: 20 }}>Loading…</div>

  const status       = Number(challenge.status)
  const stakeAmount  = challenge.stakeAmount as bigint
  const progressBps  = challenge.progressBps as bigint
  const milestones   = Number(challenge.milestonesWithdrawn)
  const deadline     = challenge.deadline as bigint
  const isActive     = status === 2
  const isCreated    = status === 1
  const isFinalized  = status === 3
  const now          = BigInt(Math.floor(Date.now() / 1000))
  const pastDeadline = now > deadline + 86400n  // after grace
  const needsApproval = !allowance || (allowance as bigint) < stakeAmount
  const earnedMilestones = Math.floor(Number(progressBps) / 1000)
  const canWithdraw  = isActive && earnedMilestones > milestones

  const anyErr = depositErr || withdrawErr || finalizeErr

  return (
    <div style={{ maxWidth: 580 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 20 }}>
        My Challenge <span style={{ fontSize: 16, color: 'var(--muted)' }}>#{String(challengeId as bigint)}</span>
      </h2>

      {/* Status banner */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <strong>Status</strong>
          <span className={`tag ml-auto tag-${['purple','purple','yellow','green'][status] ?? 'purple'}`}>
            {CHALLENGE_STATUS[status] ?? 'Unknown'}
          </span>
        </div>

        <div className="stat-grid">
          <div>
            <div className="stat-label">Staked</div>
            <div style={{ fontWeight: 700 }}>{formatUSDC(stakeAmount)} USDC</div>
          </div>
          <div>
            <div className="stat-label">Progress</div>
            <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatBps(progressBps)}</div>
          </div>
          <div>
            <div className="stat-label">Milestones (10% each)</div>
            <div style={{ fontWeight: 700 }}>{milestones} / {earnedMilestones} earned</div>
          </div>
          <div>
            <div className="stat-label">Deadline</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{formatDeadline(deadline)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 14, background: 'var(--border)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: progressBps >= 10000n ? 'var(--success)' : 'var(--accent)',
            width: `${Math.min(100, Number(progressBps) / 100)}%`,
            transition: 'width .3s',
          }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
          {formatBps(progressBps)} complete — {earnedMilestones} milestone(s) earned
        </div>
      </div>

      {anyErr && (
        <div className="error-box" style={{ marginBottom: 12 }}>
          {(anyErr as any).shortMessage ?? (anyErr as Error).message}
        </div>
      )}

      {/* Approve + Deposit */}
      {isCreated && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 14 }}>Deposit your stake to activate the challenge.</p>
          {needsApproval ? (
            <button className="btn-primary" style={{ width: '100%', padding: 11 }}
              disabled={approving}
              onClick={() => approve({
                address: ADDRESSES.MockUSDC, abi: MockUSDAbi,
                functionName: 'approve',
                args: [ADDRESSES.NazarChallenge, stakeAmount],
              })}>
              {approving ? 'Confirm…' : `Approve ${formatUSDC(stakeAmount)} USDC`}
            </button>
          ) : (
            <button className="btn-success" style={{ width: '100%', padding: 11 }}
              disabled={depositing}
              onClick={() => deposit({
                address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
                functionName: 'deposit',
                args: [challengeId as bigint],
              })}>
              {depositing ? 'Confirm…' : `Deposit ${formatUSDC(stakeAmount)} USDC`}
            </button>
          )}
        </div>
      )}

      {/* Withdraw milestone */}
      {canWithdraw && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 14 }}>
            You can withdraw <strong>{earnedMilestones - milestones}</strong> new milestone(s) ({(earnedMilestones - milestones) * 10}% of stake).
          </p>
          <button className="btn-primary" style={{ width: '100%', padding: 11 }}
            disabled={withdrawing}
            onClick={() => withdrawMilestone({
              address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
              functionName: 'withdrawProgress',
              args: [challengeId as bigint],
            })}>
            {withdrawing ? 'Confirm…' : 'Withdraw Milestone'}
          </button>
        </div>
      )}

      {/* Finalize */}
      {isActive && pastDeadline && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 14 }}>
            The grace period has passed. Finalize to distribute remaining funds.
          </p>
          <button className="btn-danger" style={{ width: '100%', padding: 11 }}
            disabled={finalizing}
            onClick={() => finalize({
              address: ADDRESSES.NazarChallenge, abi: NazarChallengeAbi,
              functionName: 'finalize',
              args: [challengeId as bigint],
            })}>
            {finalizing ? 'Confirm…' : 'Finalize Challenge'}
          </button>
        </div>
      )}

      {isFinalized && (
        <div className="success-box">Challenge finalized. Check your wallet balance.</div>
      )}
    </div>
  )
}
