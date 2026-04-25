import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--success)',
          boxShadow: '0 0 6px rgba(52,211,153,0.5)',
        }} />
        <span style={{
          fontSize: 13, color: 'var(--text2)',
          fontFamily: 'monospace', letterSpacing: '0.02em',
        }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--muted)',
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all .15s ease',
          }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0] })}
      style={{
        background: 'linear-gradient(135deg, #FC4C02, #ff7e3a)',
        border: 'none',
        borderRadius: 8,
        color: '#fff',
        padding: '8px 18px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .15s ease',
        boxShadow: '0 2px 8px rgba(252,76,2,0.3)',
      }}
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
