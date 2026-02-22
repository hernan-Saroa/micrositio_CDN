/**
 * API Gateway VIITS
 * Enruta peticiones del frontend React hacia los microservicios backend.
 * Puerto: 3000 (mismo que el monolito original — transparente para el frontend)
 *
 * Durante la TRANSICIÓN:
 *   - Si el microservicio está activo → lo proxifica
 *   - Si NO está activo → cae al monolito en :3099 (modo compatibilidad)
 */

const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const dotenv = require('dotenv')
dotenv.config()

const app = express()
const PORT = process.env.GATEWAY_PORT || 3000

// === Destinos ===
const SERVICES = {
    auth: process.env.SVC_AUTH_URL || 'http://localhost:3001',
    dai: process.env.SVC_DAI_URL || 'http://localhost:3002',
    reports: process.env.SVC_REPORTS_URL || 'http://localhost:3003',
    users: process.env.SVC_USERS_URL || 'http://localhost:3004',
    // Monolito original — fallback durante transición
    legacy: process.env.MONOLITH_URL || 'http://localhost:3099',
}

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))

// Health del gateway
app.get('/api/health', (_req, res) => res.json({
    service: 'api-gateway',
    status: 'OK',
    services: SERVICES,
    timestamp: new Date().toISOString(),
}))

// Helper para crear proxy con logging
function proxy(target: string, pathRewrite?: Record<string, string>) {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite,
        on: {
            error: (err: Error, _req: unknown, res: unknown) => {
                console.error(`[gateway] proxy error → ${target}:`, err.message)
                    ; (res as any).status?.(502).json({ error: 'Servicio no disponible', target })
            }
        }
    })
}

// === Rutas por microservicio ===
app.use('/api/auth', proxy(SERVICES.auth))
app.use('/api/clickhouse', proxy(SERVICES.dai))
app.use('/api/reports', proxy(SERVICES.reports))
app.use('/api/downloads', proxy(SERVICES.reports))
app.use('/api/users', proxy(SERVICES.users))
app.use('/api/audit', proxy(SERVICES.users))

// === Fallback al monolito para todo lo demás ===
// (slider, stats, elastic, sqlserver — aún no extraídos)
app.use('/api', proxy(SERVICES.legacy))

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   API Gateway VIITS — Puerto ${PORT}   ║
║   Auth    → ${SERVICES.auth}   ║
║   DAI     → ${SERVICES.dai}   ║
║   Reports → ${SERVICES.reports}   ║
║   Users   → ${SERVICES.users}   ║
║   Legacy  → ${SERVICES.legacy}  ║
╚═══════════════════════════════════════╝
  `)
})

module.exports = app
