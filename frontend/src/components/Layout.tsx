import type { Page } from '../App'
import ConnectWallet from './ConnectWallet'

async function addBaseSepoliaToMetaMask() {
  await (window as any).ethereum?.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x14a34', // 84532
      chainName: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia.basescan.org'],
    }],
  })
}

const TABS: { id: Page; label: string }[] = [
  { id: 'dashboard',     label: '🏠 Dashboard'   },
  { id: 'register',      label: '📋 Register'    },
  { id: 'new-challenge', label: '🎯 New Challenge'},
  { id: 'active',        label: '⚡ My Challenge' },
  { id: 'history',       label: '📜 History'     },
  { id: 'oracle',        label: '🔮 Oracle Panel' },
]

interface Props {
  currentPage: Page
  onNavigate: (p: Page) => void
  children: React.ReactNode
  banner?: React.ReactNode
}

export default function Layout({ currentPage, onNavigate, children, banner }: Props) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 56,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent2)', marginRight: 16 }}>
          NazarETH
        </span>

        {TABS.map(t => (
          <button
            key={t.id}
            className={currentPage === t.id ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 13 }}
            onClick={() => onNavigate(t.id)}
          >
            {t.label}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px', color: '#60a5fa', border: '1px solid #60a5fa' }}
            title="Add Base Sepolia to MetaMask"
            onClick={addBaseSepoliaToMetaMask}
          >
            + Base Sepolia
          </button>
          <ConnectWallet />
        </div>
      </header>

      {/* Full-width banner slot (e.g. wrong-chain warning) */}
      {banner}

      {/* Content */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '14px', color: 'var(--muted)', fontSize: 12 }}>
        NazarETH · Base Batches III · Base Sepolia (Chain 84532)
      </footer>
    </div>
  )
}
