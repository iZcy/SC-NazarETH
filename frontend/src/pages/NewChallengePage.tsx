import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import type { Page } from '../App'
import { ADDRESSES, NazarChallengeAbi, MockUSDAbi, parseUSDC, ACTIVITY_TYPES } from '../lib/contracts'

interface Props { onNavigate: (p: Page) => void }

export default function NewChallengePage({ onNavigate }: Props) {
  const { address, isConnected } = useAccount()
  const [step, setStep] = useState<'approve' | 'create'>('approve')

  const [activityType, setActivityType] = useState<keyof typeof ACTIVITY_TYPES>('running')
  const [targetValue, setTargetValue]   = useState('10000')   // metres / default 10 km
  const [durationMins, setDurationMins] = useState('3')
  const [stakeAmount, setStakeAmount]   = useState('10')      // USDC

  const stakeRaw = parseUSDC(stakeAmount || '0')
  const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(durationMins) * 60)

  // Allowance check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDAbi,
    functionName: 'allowance',
    args: [address as `0x${string}`, ADDRESSES.NazarChallenge],
    query: { enabled: !!address },
  })

  const needsApproval = !allowance || (allowance as bigint) < stakeRaw

  // Approve
  const { writeContract: approve, data: approveTx, isPending: approving, error: approveErr } = useWriteContract()
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveTx,
    query: { enabled: !!approveTx },
  })

  if (approveSuccess && step === 'approve') { refetchAllowance(); setStep('create') }

  // Create
  const { writeContract: create, data: createTx, isPending: creating, error: createErr } = useWriteContract()
  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({
    hash: createTx,
    query: { enabled: !!createTx },
  })

  if (!isConnected) return <div className="card error-box">Connect your wallet first.</div>

  if (createSuccess) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
        <div className="success-box" style={{ marginBottom: 20 }}>
          Challenge created! Deposit your USDC to activate it.
        </div>
        <button className="btn-primary" onClick={() => onNavigate('active')}>Go to My Challenge →</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 540 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 20 }}>New Challenge</h2>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Activity Type</label>
          <select value={activityType} onChange={e => setActivityType(e.target.value as any)}>
            <option value="running">🏃 Running</option>
            <option value="cycling">🚴 Cycling</option>
            <option value="swimming">🏊 Swimming</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Target Distance (metres)</label>
          <input
            type="number"
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
          />
          <span className="form-hint">E.g. 10000 = 10 km total for the challenge period.</span>
        </div>

        <div className="form-group">
          <label className="form-label">Duration (minutes)</label>
          <input
            type="number"
            min="3"
            value={durationMins}
            onChange={e => setDurationMins(e.target.value)}
          />
          <span className="form-hint">Minimum 3 minutes. After deadline, wait 2 more minutes (grace period) before finalizing.</span>
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
          <span className="form-hint">Minimum 1 USDC. You'll lose unearned portion if you miss the goal.</span>
        </div>

        {(approveErr || createErr) && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            {((approveErr || createErr) as any)?.shortMessage ?? (approveErr || createErr)?.message}
          </div>
        )}

        {/* Step 1: Approve */}
        {needsApproval && step === 'approve' && (
          <button
            className="btn-primary"
            style={{ width: '100%', padding: 12 }}
            disabled={approving}
            onClick={() => approve({
              address: ADDRESSES.MockUSDC,
              abi: MockUSDAbi,
              functionName: 'approve',
              args: [ADDRESSES.NazarChallenge, stakeRaw * 10n], // approve 10x for convenience
              chainId: baseSepolia.id,
            })}
          >
            {approving ? 'Confirm approval in wallet…' : `1. Approve ${stakeAmount} USDC`}
          </button>
        )}

        {/* Step 2: Create */}
        {(!needsApproval || step === 'create') && (
          <button
            className="btn-success"
            style={{ width: '100%', padding: 12 }}
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
            {creating ? 'Confirm in wallet…' : '2. Create Challenge'}
          </button>
        )}
      </div>
    </div>
  )
}
