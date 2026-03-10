import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      className="btn-primary"
      style={{ fontSize: 13 }}
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0] })}
    >
      {isPending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
