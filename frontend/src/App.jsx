import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Login from './pages/Login.jsx'
import AceptarInvitacion from './pages/AceptarInvitacion.jsx'
import Agenda from './pages/Agenda.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NuevaActividad from './pages/NuevaActividad.jsx'
import Tareo from './pages/Tareo.jsx'
import Admin from './pages/Admin.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import AppShell from './components/AppShell.jsx'
import { configApi } from './api/config'
import { applyBrand } from './lib/brand'

export default function App() {
  // Bootstrap: cargamos la marca pública (favicon + title) UNA vez al iniciar
  // la app. Sirve para el Login (sin auth) y queda cacheado para AppShell.
  // Se refresca cuando el admin edita Marca (evento tareo:brand-updated).
  useEffect(() => {
    const load = () => configApi.publicSettings().then(applyBrand).catch(() => {})
    load()
    window.addEventListener('tareo:brand-updated', load)
    return () => window.removeEventListener('tareo:brand-updated', load)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Público: link enviado por email al invitar un usuario. */}
      <Route path="/aceptar/:token" element={<AceptarInvitacion />} />

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
        {/* /configuracion accesible por TODOS los roles autenticados — el sidebar
            filtra qué tabs muestra según role. Non-admin solo ve "Mi cuenta > Seguridad". */}
        <Route
          path="/configuracion"
          element={
            <RequireAuth>
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
