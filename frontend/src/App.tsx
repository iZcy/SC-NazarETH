import { useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import RegisterPage from './pages/RegisterPage'
import NewChallengePage from './pages/NewChallengePage'
import ActiveChallengePage from './pages/ActiveChallengePage'
import OraclePage from './pages/OraclePage'
import HistoryPage from './pages/HistoryPage'

export type Page = 'dashboard' | 'register' | 'new-challenge' | 'active' | 'oracle' | 'history'

function WrongChainBanner() {
  const { switchChain, isPending } = useSwitchChain()
  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(252,76,2,0.08), rgba(252,76,2,0.15))',
      borderBottom: '1px solid rgba(252,76,2,0.25)',
      padding: '10px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'rgba(252,76,2,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        ⚠️
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>Wrong Network</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          This app runs on Base Sepolia. Switch your network to continue.
        </div>
      </div>
      <button
        disabled={isPending}
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        style={{
          background: 'linear-gradient(135deg, #FC4C02, #ff7e3a)',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          padding: '6px 16px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {isPending ? 'Switching...' : 'Switch to Base Sepolia'}
      </button>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const isWrongChain = isConnected && chainId !== baseSepolia.id

  return (
    <Layout currentPage={page} onNavigate={setPage} banner={isWrongChain ? <WrongChainBanner /> : undefined}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'register' && <RegisterPage onNavigate={setPage} />}
      {page === 'new-challenge' && <NewChallengePage onNavigate={setPage} />}
      {page === 'active' && <ActiveChallengePage />}
      {page === 'oracle' && <OraclePage />}
      {page === 'history' && <HistoryPage />}
    </Layout>
  )
}
