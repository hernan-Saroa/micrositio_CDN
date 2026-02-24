const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ========================================
// POST /api/analytics/event  (PUBLIC — no auth)
// Receives anonymous tracking events
// ========================================
router.post('/event', asyncHandler(async (req, res) => {
    const { session_id, page, section, event_type, event_target, device_type, browser, os, screen_width, referrer, duration_seconds } = req.body || {};

    if (!session_id || !page || !event_type) {
        return res.status(400).json({ error: 'session_id, page, event_type required' });
    }

    // Sanitize inputs (max lengths)
    const safe = (v, max) => v ? String(v).substring(0, max) : null;

    await query(
        `INSERT INTO page_events (session_id, page, section, event_type, event_target, device_type, browser, os, screen_width, referrer, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
            safe(session_id, 64),
            safe(page, 50),
            safe(section, 50),
            safe(event_type, 30),
            safe(event_target, 100),
            safe(device_type, 20),
            safe(browser, 30),
            safe(os, 30),
            screen_width ? parseInt(screen_width, 10) || null : null,
            safe(referrer, 200),
            duration_seconds ? parseInt(duration_seconds, 10) || 0 : 0
        ]
    );

    res.json({ ok: true });
}));

// ========================================
// GET /api/analytics/summary  (ADMIN only)
// Aggregated analytics for the dashboard
// ========================================
router.get('/summary', authenticateToken, authorizeRole(['admin']), asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0] + ' 23:59:59';

    // 1. Active visitors (sessions with events in last 5 min)
    const activeVisitors = await query(
        "SELECT COUNT(DISTINCT session_id) as total FROM page_events WHERE created_at >= datetime('now', '-5 minutes')"
    );

    // 2. Total unique sessions in period
    const totalSessions = await query(
        "SELECT COUNT(DISTINCT session_id) as total FROM page_events WHERE created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );

    // 3. Total pageviews in period
    const totalPageviews = await query(
        "SELECT COUNT(*) as total FROM page_events WHERE event_type = 'pageview' AND created_at >= $1 AND created_at <= $2",
        [dateFrom, dateTo]
    );

    // 4. Visitors by page
    const byPage = await query(
        `SELECT page, COUNT(DISTINCT session_id) as visitors, COUNT(*) as events
         FROM page_events
         WHERE created_at >= $1 AND created_at <= $2
         GROUP BY page ORDER BY visitors DESC`,
        [dateFrom, dateTo]
    );

    // 5. Section heat map (top 10 sections by views)
    const sectionHeat = await query(
        `SELECT page, section, COUNT(*) as views, ROUND(AVG(duration_seconds),0) as avg_duration
         FROM page_events
         WHERE section IS NOT NULL AND created_at >= $1 AND created_at <= $2
         GROUP BY page, section ORDER BY views DESC LIMIT 10`,
        [dateFrom, dateTo]
    );

    // 6. Device breakdown
    const byDevice = await query(
        `SELECT device_type, COUNT(DISTINCT session_id) as sessions
         FROM page_events
         WHERE device_type IS NOT NULL AND created_at >= $1 AND created_at <= $2
         GROUP BY device_type ORDER BY sessions DESC`,
        [dateFrom, dateTo]
    );

    // 7. Browser breakdown
    const byBrowser = await query(
        `SELECT browser, COUNT(DISTINCT session_id) as sessions
         FROM page_events
         WHERE browser IS NOT NULL AND created_at >= $1 AND created_at <= $2
         GROUP BY browser ORDER BY sessions DESC`,
        [dateFrom, dateTo]
    );

    // 8. OS breakdown
    const byOS = await query(
        `SELECT os, COUNT(DISTINCT session_id) as sessions
         FROM page_events
         WHERE os IS NOT NULL AND created_at >= $1 AND created_at <= $2
         GROUP BY os ORDER BY sessions DESC`,
        [dateFrom, dateTo]
    );

    // 9. Top clicked elements
    const topClicks = await query(
        `SELECT event_target, page, COUNT(*) as clicks
         FROM page_events
         WHERE event_type = 'click' AND event_target IS NOT NULL AND created_at >= $1 AND created_at <= $2
         GROUP BY event_target, page ORDER BY clicks DESC LIMIT 10`,
        [dateFrom, dateTo]
    );

    // 10. Avg session duration per page
    const avgDuration = await query(
        `SELECT page, ROUND(AVG(duration_seconds), 0) as avg_seconds
         FROM page_events
         WHERE event_type = 'session_end' AND duration_seconds > 0 AND created_at >= $1 AND created_at <= $2
         GROUP BY page ORDER BY avg_seconds DESC`,
        [dateFrom, dateTo]
    );

    // 11. Daily visitors trend (last 7 days)
    const dailyTrend = await query(
        `SELECT date(created_at) as day, COUNT(DISTINCT session_id) as visitors
         FROM page_events
         WHERE created_at >= date('now', '-6 days')
         GROUP BY date(created_at) ORDER BY day ASC`
    );

    // Fill missing days
    const trend = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayStr = d.toISOString().split('T')[0];
        const found = (dailyTrend.rows || dailyTrend).find(r => r.day === dayStr);
        trend.push({
            day: dayStr,
            label: d.toLocaleDateString('es-CO', { weekday: 'short' }),
            visitors: found ? found.visitors : 0
        });
    }

    const r = (result) => (result.rows || result);
    const n = (result) => (result.rows || result)[0]?.total || 0;

    res.json({
        period: { from: dateFrom, to: dateTo },
        active_visitors: n(activeVisitors),
        total_sessions: n(totalSessions),
        total_pageviews: n(totalPageviews),
        by_page: r(byPage),
        section_heat: r(sectionHeat),
        by_device: r(byDevice),
        by_browser: r(byBrowser),
        by_os: r(byOS),
        top_clicks: r(topClicks),
        avg_duration: r(avgDuration),
        daily_trend: trend
    });
}));

module.exports = router;
