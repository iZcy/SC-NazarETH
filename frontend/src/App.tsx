import { useState } from 'react'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import RegisterPage from './pages/RegisterPage'
import NewChallengePage from './pages/NewChallengePage'
import ActiveChallengePage from './pages/ActiveChallengePage'
import OraclePage from './pages/OraclePage'

export type Page = 'dashboard' | 'register' | 'new-challenge' | 'active' | 'oracle'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard'      && <DashboardPage onNavigate={setPage} />}
      {page === 'register'       && <RegisterPage onNavigate={setPage} />}
      {page === 'new-challenge'  && <NewChallengePage onNavigate={setPage} />}
      {page === 'active'         && <ActiveChallengePage />}
      {page === 'oracle'         && <OraclePage />}
    </Layout>
  )
}
