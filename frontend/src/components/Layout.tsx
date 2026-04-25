import type { Page } from '../App'
import ConnectWallet from './ConnectWallet'

async function addBaseSepoliaToMetaMask() {
  await (window as any).ethereum?.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x14a34',
      chainName: 'Base Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.base.org'],
      blockExplorerUrls: ['https://sepolia.basescan.org'],
    }],
  })
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'register', label: 'Register', icon: '👤' },
  { id: 'new-challenge', label: 'New Challenge', icon: '🎯' },
  { id: 'active', label: 'My Challenge', icon: '⚡' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'oracle', label: 'Oracle', icon: '🔮' },
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
      <header style={{
        background: 'linear-gradient(180deg, #1a1a24 0%, var(--surface) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        height: 60,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 28 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #FC4C02, #ff7e3a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff',
            boxShadow: '0 2px 8px rgba(252,76,2,0.3)',
          }}>N</div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: '#fff' }}>
            Nazar<span style={{ color: 'var(--accent2)' }}>ETH</span>
          </span>
        </div>

        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  background: active ? 'rgba(252,76,2,0.12)' : 'transparent',
                  color: active ? 'var(--accent2)' : 'var(--muted)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  borderBottom: active ? '2px solid var(--strava)' : '2px solid transparent',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ marginRight: 5 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={addBaseSepoliaToMetaMask}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--muted)',
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all .15s ease',
            }}
            title="Add Base Sepolia to MetaMask"
          >
            + Base Sepolia
          </button>
          <ConnectWallet />
        </div>
      </header>

      {banner}

      <main style={{
        flex: 1,
        padding: '32px 28px',
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
        animation: 'fadeIn .25s ease',
      }}>
        {children}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '18px',
        color: 'var(--muted)',
        fontSize: 12,
        borderTop: '1px solid var(--border)',
      }}>
        NazarETH · Built on Base · Base Sepolia (84532)
      </footer>
    </div>
  )
}
