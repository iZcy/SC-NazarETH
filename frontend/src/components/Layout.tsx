import type { Page } from '../App'
import ConnectWallet from './ConnectWallet'

const TABS: { id: Page; label: string }[] = [
  { id: 'dashboard',     label: '🏠 Dashboard'   },
  { id: 'register',      label: '📋 Register'    },
  { id: 'new-challenge', label: '🎯 New Challenge'},
  { id: 'active',        label: '⚡ My Challenge' },
  { id: 'oracle',        label: '🔮 Oracle Panel' },
]

interface Props {
  currentPage: Page
  onNavigate: (p: Page) => void
  children: React.ReactNode
}

export default function Layout({ currentPage, onNavigate, children }: Props) {
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

        <div className="ml-auto">
          <ConnectWallet />
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '14px', color: 'var(--muted)', fontSize: 12 }}>
        NazarETH · Base Batches III · Local Devnet (Chain 31337)
      </footer>
    </div>
  )
}
