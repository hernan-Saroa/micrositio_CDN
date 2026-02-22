/**
 * svc-reports — Microservicio de Reportes y Descargas
 * Extráido de: backend/routes/reports.js + downloads.js
 * Puerto por defecto: 3003
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '../../backend/.env') })

const reportsRoutes = require('../../backend/routes/reports')
const downloadsRoutes = require('../../backend/routes/downloads')
const { authenticateToken } = require('../../backend/middleware/auth')

const app = express()
const PORT = process.env.REPORTS_PORT || 3003

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
// NOTA: NO se usa express.json global aquí porque reports usa multer
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.get('/health', (_req, res) => res.json({ service: 'svc-reports', status: 'OK', port: PORT }))

app.use('/api/reports', authenticateToken, reportsRoutes)
app.use('/api/downloads', authenticateToken, express.json({ limit: '10mb' }), downloadsRoutes)

app.listen(PORT, () => {
    console.log(`[svc-reports] corriendo en puerto ${PORT}`)
})

module.exports = app
