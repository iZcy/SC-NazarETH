import { useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import RegisterPage from './pages/RegisterPage'
import NewChallengePage from './pages/NewChallengePage'
import ActiveChallengePage from './pages/ActiveChallengePage'
import OraclePage from './pages/OraclePage'

export type Page = 'dashboard' | 'register' | 'new-challenge' | 'active' | 'oracle'

function WrongChainBanner() {
  const { switchChain, isPending } = useSwitchChain()
  return (
    <div style={{
      background: '#78350f', borderBottom: '1px solid #f59e0b',
      padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ color: '#fbbf24', fontWeight: 600 }}>⚠️ Wrong network</span>
      <span style={{ color: '#fde68a', fontSize: 13 }}>
        This app runs on Base Sepolia. First add the network, then switch.
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          style={{ fontSize: 13, padding: '5px 16px', background: '#f59e0b', color: '#000' }}
          disabled={isPending}
          onClick={() => switchChain({ chainId: baseSepolia.id })}
        >
          {isPending ? 'Switching…' : 'Switch to Base Sepolia'}
        </button>
      </div>
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
      {page === 'dashboard'      && <DashboardPage onNavigate={setPage} />}
      {page === 'register'       && <RegisterPage onNavigate={setPage} />}
      {page === 'new-challenge'  && <NewChallengePage onNavigate={setPage} />}
      {page === 'active'         && <ActiveChallengePage />}
      {page === 'oracle'         && <OraclePage />}
    </Layout>
  )
}
