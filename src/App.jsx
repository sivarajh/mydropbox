import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SharedFile from './pages/SharedFile'
import NotConfigured from './pages/NotConfigured'

export default function App() {
  const { user, loading } = useAuth()

  if (!isConfigured) return <NotConfigured />
  if (loading) return <div className="center muted">Loading…</div>

  return (
    <Routes>
      {/* Public share links work whether or not you are signed in. */}
      <Route path="/share/:token" element={<SharedFile />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={user ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/folder/:folderId"
        element={user ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
