/**
 * svc-dai — Microservicio DAI / ClickHouse
 * Extráido de: backend/routes/clickhouseserver.js
 * Puerto por defecto: 3002
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '../../backend/.env') })

const clickhouseRoutes = require('../../backend/routes/clickhouseserver')
const { authenticateToken } = require('../../backend/middleware/auth')

const app = express()
const PORT = process.env.DAI_PORT || 3002

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ service: 'svc-dai', status: 'OK', port: PORT }))

// Todas las rutas DAI/ClickHouse protegidas con JWT
app.use('/api/clickhouse', authenticateToken, clickhouseRoutes)

app.listen(PORT, () => {
    console.log(`[svc-dai] corriendo en puerto ${PORT}`)
})

module.exports = app
