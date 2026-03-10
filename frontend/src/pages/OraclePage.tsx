import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { ADDRESSES, NazarOracleAbi } from '../lib/contracts'

export default function OraclePage() {
  const { address, isConnected } = useAccount()

  // submitProgress fields
  const [wallet, setWallet] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [progressBps, setProgressBps] = useState('')

  // finalizeProgress fields
  const [fWallet, setFWallet] = useState('')
  const [fChallengeId, setFChallengeId] = useState('')

  // MockUSDC mint fields
  const [mintTo, setMintTo] = useState('')
  const [mintAmount, setMintAmount] = useState('100')

  const { writeContract: submit, data: submitTx, isPending: submitting, error: submitErr } = useWriteContract()
  const { isSuccess: submitOk } = useWaitForTransactionReceipt({ hash: submitTx })

  const { writeContract: finalize, data: finTx, isPending: finalizing, error: finErr } = useWriteContract()
  const { isSuccess: finalizeOk } = useWaitForTransactionReceipt({ hash: finTx })

  if (!isConnected) return <div className="card error-box">Connect the admin wallet to use this panel.</div>

  return (
    <div style={{ maxWidth: 580 }}>
      <h2 style={{ color: 'var(--accent2)', marginBottom: 6 }}>Oracle Panel</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 13 }}>
        Admin-only actions. Connect as <code>0xB88a63ba…</code> (deployer/oracle/admin · Base Sepolia).
      </p>

      {/* Submit Progress */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>📤 Submit Progress</h3>

        <div className="form-group">
          <label className="form-label">Challenger Wallet</label>
          <input placeholder="0x…" value={wallet} onChange={e => setWallet(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Challenge ID</label>
          <input type="number" placeholder="1" value={challengeId} onChange={e => setChallengeId(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Progress (BPS, 0–10000)</label>
          <input type="number" min="0" max="10000" placeholder="5000 = 50%"
            value={progressBps} onChange={e => setProgressBps(e.target.value)} />
          <span className="form-hint">1000 = 10%, 5000 = 50%, 10000 = 100%</span>
        </div>

        {submitErr && <div className="error-box" style={{ marginBottom: 12 }}>{(submitErr as any).shortMessage ?? submitErr.message}</div>}
        {submitOk && <div className="success-box" style={{ marginBottom: 12 }}>Progress submitted!</div>}

        <button className="btn-primary" style={{ width: '100%', padding: 11 }}
          disabled={submitting || !wallet || !challengeId || !progressBps}
          onClick={() => submit({
            address: ADDRESSES.NazarOracle,
            abi: NazarOracleAbi,
            functionName: 'submitProgress',
            args: [
              wallet as `0x${string}`,
              BigInt(challengeId),
              BigInt(progressBps),
              BigInt(Math.floor(Date.now() / 1000)),
            ],
            chainId: baseSepolia.id,
          })}>
          {submitting ? 'Confirm…' : 'Submit Progress'}
        </button>
      </div>

      {/* Finalize Progress */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>✅ Finalize Progress</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 14, fontSize: 13 }}>
          Marks a challenge as fully completed (progressBps locked at 10000).
        </p>

        <div className="form-group">
          <label className="form-label">Challenger Wallet</label>
          <input placeholder="0x…" value={fWallet} onChange={e => setFWallet(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Challenge ID</label>
          <input type="number" placeholder="1" value={fChallengeId} onChange={e => setFChallengeId(e.target.value)} />
        </div>

        {finErr && <div className="error-box" style={{ marginBottom: 12 }}>{(finErr as any).shortMessage ?? finErr.message}</div>}
        {finalizeOk && <div className="success-box" style={{ marginBottom: 12 }}>Progress finalized!</div>}

        <button className="btn-success" style={{ width: '100%', padding: 11 }}
          disabled={finalizing || !fWallet || !fChallengeId}
          onClick={() => finalize({
            address: ADDRESSES.NazarOracle,
            abi: NazarOracleAbi,
            functionName: 'finalizeProgress',
            args: [fWallet as `0x${string}`, BigInt(fChallengeId)],
            chainId: baseSepolia.id,
          })}>
          {finalizing ? 'Confirm…' : 'Finalize Progress'}
        </button>
      </div>

      {/* Info box */}
      <div className="card" style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}>
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>ℹ️ Deployment Info</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <tbody>
            {Object.entries(ADDRESSES).map(([name, addr]) => (
              <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{name}</td>
                <td style={{ padding: '6px 8px', color: 'var(--accent2)' }}>{addr}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>Admin / Oracle</td>
              <td style={{ padding: '6px 8px', color: 'var(--success)' }}>0xB88a63ba8C3f630bBdA24c121A66199555f056B2</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>Chain</td>
              <td style={{ padding: '6px 8px', color: 'var(--text)' }}>84532 (Base Sepolia)</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>Connected as</td>
              <td style={{ padding: '6px 8px', color: 'var(--text)' }}>{address ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
