import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/modules/auth/LoginPage'
import DAIPage from '@/modules/dai/DAIPage'
import DashboardPage from '@/modules/dashboard/DashboardPage'
import UsuariosPage from '@/modules/usuarios/UsuariosPage'
import ReportesPage from '@/modules/reportes/ReportesPage'
import CCTVPage from '@/modules/cctv/CCTVPage'
import CiudadanaPage from '@/modules/ciudadana/CiudadanaPage'
import { useAuthStore } from '@/stores/auth.store'
import type { ReactNode } from 'react'

// Lazy-load MapaPage so leaflet is split into a separate chunk
const MapaPage = lazy(() => import('@/modules/mapa/MapaPage'))

const MapFallback = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8', background: '#f1f5f9' }}>
    <span className="material-icons" style={{ animation: 'spin .7s linear infinite', fontSize: 32, display: 'inline-block' }}>refresh</span>
    <span style={{ fontWeight: 600 }}>Cargando mapa...</span>
  </div>
)

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 15_000 } },
})

function PrivateRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#94a3b8', background: '#f1f5f9' }}>
      <span className="material-icons" style={{ fontSize: 48 }}>construction</span>
      <h2 style={{ fontWeight: 800, color: '#475569' }}>{name}</h2>
      <p style={{ fontSize: '.85rem' }}>Próximamente en esta fase de migración</p>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated shell */}
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            <Route path="dashboard" element={
              <PrivateRoute><DashboardPage /></PrivateRoute>
            } />

            <Route path="dai" element={
              <PrivateRoute><DAIPage /></PrivateRoute>
            } />

            <Route path="cctv" element={
              <PrivateRoute><CCTVPage /></PrivateRoute>
            } />

            <Route path="usuarios" element={
              <PrivateRoute><UsuariosPage /></PrivateRoute>
            } />

            <Route path="reportes" element={
              <PrivateRoute><ReportesPage /></PrivateRoute>
            } />

            <Route path="mapa" element={
              <PrivateRoute>
                <Suspense fallback={<MapFallback />}>
                  <MapaPage />
                </Suspense>
              </PrivateRoute>
            } />

            <Route path="ciudadana" element={
              <PrivateRoute><CiudadanaPage /></PrivateRoute>
            } />

            <Route path="ajustes" element={
              <PrivateRoute><PlaceholderPage name="Ajustes del sistema" /></PrivateRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
