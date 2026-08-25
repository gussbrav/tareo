import { Navigate, Route, Routes } from 'react-router-dom'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NuevaActividad from './pages/NuevaActividad.jsx'
import Tareo from './pages/Tareo.jsx'
import Admin from './pages/Admin.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import AppShell from './components/AppShell.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/tareo" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tareo" element={<Tareo />} />
        <Route
          path="/actividades/nueva"
          element={
            <RequireAuth roles={['admin', 'supervisor']}>
              <NuevaActividad />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth roles={['admin']}>
              <Admin />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
