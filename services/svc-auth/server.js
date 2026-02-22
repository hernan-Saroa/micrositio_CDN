/**
 * svc-auth — Microservicio de Autenticación VIITS
 * Extráido de: backend/routes/auth.js
 * Puerto por defecto: 3001
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '../../backend/.env') })

// Importar la lógica de auth ya existente (sin cambiarla)
const authRoutes = require('../../backend/routes/auth')

const app = express()
const PORT = process.env.AUTH_PORT || 3001

app.use(helmet())
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// Rate limit estricto en login
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
app.use('/api/auth/login', loginLimiter)

// Health
app.get('/health', (_req, res) => res.json({ service: 'svc-auth', status: 'OK', port: PORT }))

// Montar las mismas rutas del monolito — sin reescribir nada
app.use('/api/auth', authRoutes.router)

app.listen(PORT, () => {
    console.log(`[svc-auth] corriendo en puerto ${PORT}`)
})

module.exports = app
