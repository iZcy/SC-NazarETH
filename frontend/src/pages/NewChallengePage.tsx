import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import type { Page } from '../App'
import { ADDRESSES, NazarChallengeAbi, MockUSDAbi, parseUSDC, ACTIVITY_TYPES } from '../lib/contracts'

interface Props { onNavigate: (p: Page) => void }

const ACTIVITY_OPTIONS = [
  { value: 'running' as const, icon: '🏃', label: 'Running' },
  { value: 'cycling' as const, icon: '🚴', label: 'Cycling' },
  { value: 'swimming' as const, icon: '🏊', label: 'Swimming' },
]

export default function NewChallengePage({ onNavigate }: Props) {
  const { address, isConnected } = useAccount()
  const [step, setStep] = useState<'approve' | 'create'>('approve')

  const [activityType, setActivityType] = useState<keyof typeof ACTIVITY_TYPES>('running')
  const [targetValue, setTargetValue] = useState('10000')
  const [durationMins, setDurationMins] = useState('3')
  const [stakeAmount, setStakeAmount] = useState('10')

  const stakeRaw = parseUSDC(stakeAmount || '0')
  const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(durationMins) * 60)

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDAbi,
    functionName: 'allowance',
    args: [address as `0x${string}`, ADDRESSES.NazarChallenge],
    query: { enabled: !!address },
  })

  const needsApproval = !allowance || (allowance as bigint) < stakeRaw

  const { writeContract: approve, data: approveTx, isPending: approving, error: approveErr } = useWriteContract()
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveTx,
    query: { enabled: !!approveTx },
  })

  if (approveSuccess && step === 'approve') { refetchAllowance(); setStep('create') }

  const { writeContract: create, data: createTx, isPending: creating, error: createErr } = useWriteContract()
  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({
    hash: createTx,
    query: { enabled: !!createTx },
  })

  if (!isConnected) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>Connect your wallet first.</p>
      </div>
    )
  }

  if (createSuccess) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(252,76,2,0.15), rgba(255,126,58,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>🏆</div>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Challenge Created!</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
          Your challenge is live. Deposit your USDC to activate it.
        </p>
        <button className="btn-primary" onClick={() => onNavigate('active')}>
          Go to My Challenge →
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 540 }} className="animate-in">
      <h1 className="section-title" style={{ marginBottom: 6 }}>New Challenge</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Define your fitness commitment and stake USDC. Hit your goal to earn it back.
      </p>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Activity Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACTIVITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setActivityType(opt.value)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: activityType === opt.value ? '2px solid var(--strava)' : '1px solid var(--border)',
                  background: activityType === opt.value ? 'rgba(252,76,2,0.08)' : 'var(--bg)',
                  color: activityType === opt.value ? 'var(--accent2)' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .15s ease',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</div>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Target Distance (metres)</label>
          <input
            type="number"
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
          />
          <span className="form-hint">
            E.g. 10000 = 10 km total for the challenge period.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Duration (minutes)</label>
          <input
            type="number"
            min="3"
            value={durationMins}
            onChange={e => setDurationMins(e.target.value)}
          />
          <span className="form-hint">
            Minimum 3 min. After deadline, 2 min grace period before finalizing.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Stake Amount (USDC)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={stakeAmount}
            onChange={e => setStakeAmount(e.target.value)}
          />
          <span className="form-hint">
            Minimum 1 USDC. Unearned portion is lost if you miss the goal.
          </span>
        </div>

        <hr className="divider" />

        <div style={{
          background: 'var(--surface2)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          <div>
            <div className="stat-label">You'll stake</div>
            <div style={{ fontWeight: 700, color: 'var(--accent2)' }}>{stakeAmount} USDC</div>
          </div>
          <div>
            <div className="stat-label">Duration</div>
            <div style={{ fontWeight: 700 }}>{durationMins} min</div>
          </div>
          <div>
            <div className="stat-label">Target</div>
            <div style={{ fontWeight: 700 }}>{Number(targetValue).toLocaleString()} m</div>
          </div>
          <div>
            <div className="stat-label">Activity</div>
            <div style={{ fontWeight: 700 }}>{ACTIVITY_OPTIONS.find(o => o.value === activityType)?.label}</div>
          </div>
        </div>

        {(approveErr || createErr) && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            {((approveErr || createErr) as any)?.shortMessage ?? (approveErr || createErr)?.message}
          </div>
        )}

        {needsApproval && step === 'approve' && (
          <button
            className="btn-primary"
            style={{ width: '100%', padding: 13 }}
            disabled={approving}
            onClick={() => approve({
              address: ADDRESSES.MockUSDC,
              abi: MockUSDAbi,
              functionName: 'approve',
              args: [ADDRESSES.NazarChallenge, stakeRaw * 10n],
              chainId: baseSepolia.id,
            })}
          >
            {approving ? 'Confirm approval in wallet...' : `1. Approve ${stakeAmount} USDC`}
          </button>
        )}

        {(!needsApproval || step === 'create') && (
          <button
            className="btn-success"
            style={{ width: '100%', padding: 13 }}
            disabled={creating}
            onClick={() => create({
              address: ADDRESSES.NazarChallenge,
              abi: NazarChallengeAbi,
              functionName: 'createChallenge',
              args: [
                ACTIVITY_TYPES[activityType] as `0x${string}`,
                BigInt(targetValue),
                deadline,
                stakeRaw,
              ],
              chainId: baseSepolia.id,
            })}
          >
            {creating ? 'Confirm in wallet...' : '2. Create Challenge'}
          </button>
        )}
      </div>
    </div>
  )
}
