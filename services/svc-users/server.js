/**
 * svc-users — Microservicio de Gestión de Usuarios
 * Extráido de: backend/routes/users.js + audit.js
 * Puerto por defecto: 3004
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '../../backend/.env') })

const usersRoutes = require('../../backend/routes/users')
const auditRoutes = require('../../backend/routes/audit')
const { authenticateToken } = require('../../backend/middleware/auth')

const app = express()
const PORT = process.env.USERS_PORT || 3004

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '5mb' }))

app.get('/health', (_req, res) => res.json({ service: 'svc-users', status: 'OK', port: PORT }))

app.use('/api/users', authenticateToken, usersRoutes)
app.use('/api/audit', authenticateToken, auditRoutes)

app.listen(PORT, () => {
    console.log(`[svc-users] corriendo en puerto ${PORT}`)
})

module.exports = app
