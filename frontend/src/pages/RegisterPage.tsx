import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import type { Page } from '../App'
import { ADDRESSES, NazarRegistryAbi } from '../lib/contracts'

interface Props { onNavigate: (p: Page) => void }

export default function RegisterPage({ onNavigate }: Props) {
  const { address, isConnected } = useAccount()
  const [stravaId, setStravaId] = useState('')

  const { data: isRegistered, refetch } = useReadContract({
    address: ADDRESSES.NazarRegistry,
    abi: NazarRegistryAbi,
    functionName: 'isRegistered',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  })

  const { writeContract, data: txHash, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  function handleRegister() {
    if (!stravaId || !address) return
    writeContract({
      address: ADDRESSES.NazarRegistry,
      abi: NazarRegistryAbi,
      functionName: 'devRegister',
      args: [BigInt(stravaId)],
      chainId: baseSepolia.id,
    })
  }

  if (isSuccess) {
    refetch()
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div className="success-box" style={{ marginBottom: 20 }}>
          Registered successfully! Your Strava ID {stravaId} is now linked to your wallet.
        </div>
        <button className="btn-primary" onClick={() => onNavigate('new-challenge')}>
          Create a Challenge →
        </button>
      </div>
    )
  }

  if (!isConnected) {
    return <div className="card error-box">Connect your wallet to register.</div>
  }

  if (isRegistered) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div className="success-box" style={{ marginBottom: 16 }}>
          ✓ Your wallet is already registered.
        </div>
        <button className="btn-primary" onClick={() => onNavigate('dashboard')}>← Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 20 }}>Register</h2>

      <div className="card">
        <p style={{ color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Link your wallet to a Strava athlete ID. On the local devnet this uses{' '}
          <code>devRegister</code> which skips the EIP-712 signature check.
        </p>

        <div className="form-group">
          <label className="form-label">Strava Athlete ID</label>
          <input
            type="number"
            placeholder="e.g. 12345678"
            value={stravaId}
            onChange={e => setStravaId(e.target.value)}
          />
          <span className="form-hint">
            Find it at strava.com/athletes/&lt;ID&gt; — any number works on local devnet.
          </span>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            {(error as any).shortMessage ?? error.message}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', padding: 12 }}
          disabled={!stravaId || isPending || isConfirming}
          onClick={handleRegister}
        >
          {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Register (devMode)'}
        </button>
      </div>
    </div>
  )
}
