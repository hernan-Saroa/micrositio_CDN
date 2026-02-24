const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Protect all stats routes
router.use(authenticateToken);
router.use(authorizeRole(['admin']));

// ========================================
// GET /api/stats/dashboard?from=&to=
// Executive dashboard aggregation
// ========================================
router.get('/dashboard', asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    // Default: last 30 days
    const dateFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0] + ' 23:59:59';

    // ── 1. Reports ──────────────────────────────────────────────
    const reportsTotal = await query('SELECT COUNT(*) as total FROM reports');
    const reportsInPeriod = await query(
        "SELECT COUNT(*) as total FROM reports WHERE created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );
    const reportsToday = await query(
        "SELECT COUNT(*) as total FROM reports WHERE date(created_at) = date('now')"
    );
    const reportsPublic = await query(
        "SELECT COUNT(*) as total FROM reports WHERE is_public = 1"
    );
    const totalViews = await query(
        "SELECT COALESCE(SUM(view_count), 0) as total FROM reports"
    );
    const totalDownloadsReports = await query(
        "SELECT COALESCE(SUM(download_count), 0) as total FROM reports"
    );

    // ── 2. Downloads ────────────────────────────────────────────
    const downloadsTotal = await query('SELECT COUNT(*) as total FROM downloads');
    const downloadsInPeriod = await query(
        "SELECT COUNT(*) as total FROM downloads WHERE created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );
    const downloadsToday = await query(
        "SELECT COUNT(*) as total FROM downloads WHERE date(created_at) = date('now')"
    );
    const downloadsCompleted = await query(
        "SELECT COUNT(*) as total FROM downloads WHERE status = 'completed'"
    );
    const downloadsFailed = await query(
        "SELECT COUNT(*) as total FROM downloads WHERE status = 'failed' OR status = 'error'"
    );

    // ── 3. Users ────────────────────────────────────────────────
    const usersTotal = await query('SELECT COUNT(*) as total FROM users');
    const usersActive = await query(
        "SELECT COUNT(*) as total FROM users WHERE is_active = 1"
    );
    const usersNewInPeriod = await query(
        "SELECT COUNT(*) as total FROM users WHERE created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );
    const usersWithMFA = await query(
        "SELECT COUNT(*) as total FROM users WHERE totp_enabled = 1"
    );

    // ── 4. Sessions ─────────────────────────────────────────────
    const sessionsActive = await query(
        "SELECT COUNT(*) as total FROM sessions WHERE expires_at > datetime('now')"
    );

    // ── 5. Security (from audit_logs) ───────────────────────────
    const loginsTotal = await query(
        "SELECT COUNT(*) as total FROM audit_logs WHERE action = 'login' AND created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );
    const loginsFailed = await query(
        "SELECT COUNT(*) as total FROM audit_logs WHERE action = 'login' AND status = 'failure' AND created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );
    const loginsSuccess = await query(
        "SELECT COUNT(*) as total FROM audit_logs WHERE action = 'login' AND status = 'success' AND created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );

    // ── 6. Activity trend (last 7 days) ─────────────────────────
    const activityTrend = await query(`
        SELECT date(created_at) as day, COUNT(*) as actions
        FROM audit_logs
        WHERE created_at >= date('now', '-6 days')
        GROUP BY date(created_at)
        ORDER BY day ASC
    `);

    // Fill missing days with 0
    const trend = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayStr = d.toISOString().split('T')[0];
        const found = (activityTrend.rows || activityTrend).find(r => r.day === dayStr);
        trend.push({
            day: dayStr,
            label: d.toLocaleDateString('es-CO', { weekday: 'short' }),
            actions: found ? found.actions : 0
        });
    }

    // ── 7. Recent items ─────────────────────────────────────────
    const recentReports = await query(
        "SELECT id, title, file_name, file_size, view_count, download_count, created_at FROM reports ORDER BY created_at DESC LIMIT 5"
    );
    const recentDownloads = await query(`
        SELECT d.id, d.resource_type, d.file_name, d.status, d.created_at,
               u.name as user_name, u.email as user_email
        FROM downloads d
        LEFT JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC LIMIT 5
    `);
    const recentAudit = await query(`
        SELECT a.action, a.resource_type, a.status, a.created_at,
               u.name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC LIMIT 5
    `);

    // ── 8. Audit total actions in period ────────────────────────
    const auditTotal = await query(
        "SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );

    // ── 9. DAI Alerts ───────────────────────────────────────────
    const daiTotal = await query('SELECT COUNT(*) as total FROM dai_alerts');
    const daiToday = await query(
        "SELECT COUNT(*) as total FROM dai_alerts WHERE date(fecha_plataforma) = date('now')"
    );
    const daiPending = await query(
        "SELECT COUNT(*) as total FROM dai_alerts WHERE estado != 'resuelta'"
    );
    const daiCritical = await query(
        "SELECT COUNT(*) as total FROM dai_alerts WHERE severidad = 'critica'"
    );
    const daiAvgLatency = await query(
        "SELECT COALESCE(AVG(latencia_ms), 0) as total FROM dai_alerts"
    );

    // ── Build response ──────────────────────────────────────────
    const r = (result) => (result.rows || result)[0]?.total || 0;

    res.json({
        period: { from: dateFrom, to: dateTo },
        reports: {
            total: r(reportsTotal),
            in_period: r(reportsInPeriod),
            today: r(reportsToday),
            public: r(reportsPublic),
            total_views: r(totalViews),
            total_downloads: r(totalDownloadsReports)
        },
        downloads: {
            total: r(downloadsTotal),
            in_period: r(downloadsInPeriod),
            today: r(downloadsToday),
            completed: r(downloadsCompleted),
            failed: r(downloadsFailed)
        },
        users: {
            total: r(usersTotal),
            active: r(usersActive),
            new_in_period: r(usersNewInPeriod),
            with_mfa: r(usersWithMFA)
        },
        sessions: {
            active: r(sessionsActive)
        },
        security: {
            logins_total: r(loginsTotal),
            logins_failed: r(loginsFailed),
            logins_success: r(loginsSuccess),
            success_rate: r(loginsTotal) > 0
                ? Math.round((r(loginsSuccess) / r(loginsTotal)) * 100)
                : 100
        },
        activity: {
            total_actions: r(auditTotal),
            trend
        },
        dai: {
            total: r(daiTotal),
            today: r(daiToday),
            pending: r(daiPending),
            critical: r(daiCritical),
            avg_latency: Math.round(r(daiAvgLatency))
        },
        recent: {
            reports: recentReports.rows || recentReports,
            downloads: recentDownloads.rows || recentDownloads,
            audit: recentAudit.rows || recentAudit
        }
    });
}));

// Keep existing traffic route
router.get('/traffic', asyncHandler(async (req, res) => {
    const { department, limit = 10 } = req.query;
    let queryStr = `SELECT sector_name, department, AVG(average_speed) as avg_speed,
                    SUM(total_vehicles) as total_vehicles,
                    SUM(vehicles_over_limit) as vehicles_over_limit
                    FROM traffic_stats WHERE date >= date('now', '-30 days')`;
    const params = [];
    if (department) {
        params.push(department);
        queryStr += ` AND department = $${params.length}`;
    }
    queryStr += ` GROUP BY sector_name, department ORDER BY total_vehicles DESC`;
    params.push(limit);
    queryStr += ` LIMIT $${params.length}`;
    const result = await query(queryStr, params);
    res.json(result.rows || result);
}));

module.exports = router;
