import { Navigate, Route, Routes } from 'react-router-dom'

import Login from './pages/Login.jsx'
import Agenda from './pages/Agenda.jsx'
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
        <Route path="/agenda" element={<Agenda />} />
        <Route
          path="/actividades/nueva"
          element={
            <RequireAuth roles={['admin', 'supervisor']}>
              <NuevaActividad />
            </RequireAuth>
          }
        />
        <Route
          path="/configuracion"
          element={
            <RequireAuth roles={['admin']}>
              <Admin />
            </RequireAuth>
          }
        />
        {/* Redirect del path viejo — evita romper bookmarks. */}
        <Route path="/admin" element={<Navigate to="/configuracion" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
