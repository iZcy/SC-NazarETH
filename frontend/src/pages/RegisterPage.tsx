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
      <div className="card animate-in" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--success-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>✓</div>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Registered!</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
          Strava ID <strong>{stravaId}</strong> is now linked to your wallet.
        </p>
        <button className="btn-primary" onClick={() => onNavigate('new-challenge')}>
          Create a Challenge →
        </button>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>Connect your wallet to register.</p>
      </div>
    )
  }

  if (isRegistered) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--success-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>✓</div>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Already Registered</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Your wallet is linked to a Strava account.</p>
        <button className="btn-secondary" onClick={() => onNavigate('dashboard')}>
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480 }} className="animate-in">
      <h1 className="section-title" style={{ marginBottom: 6 }}>Register</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Link your wallet to a Strava athlete ID. On devnet, <code style={{
          background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, fontSize: 12,
        }}>devRegister</code> skips the signature check.
      </p>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Strava Athlete ID</label>
          <input
            type="number"
            placeholder="e.g. 12345678"
            value={stravaId}
            onChange={e => setStravaId(e.target.value)}
          />
          <span className="form-hint">
            Find it at strava.com/athletes/&lt;ID&gt; — any number works on devnet.
          </span>
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 12 }}>
            {(error as any).shortMessage ?? error.message}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', padding: 13 }}
          disabled={!stravaId || isPending || isConfirming}
          onClick={handleRegister}
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Register (devMode)'}
        </button>
      </div>
    </div>
  )
}
