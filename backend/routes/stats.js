const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/dashboard', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM dashboard_stats');
    res.json(result.rows[0]);
}));

router.get('/traffic', asyncHandler(async (req, res) => {
    const { department, limit = 10 } = req.query;
    let queryStr = `SELECT sector_name, department, AVG(average_speed) as avg_speed,
                    SUM(total_vehicles) as total_vehicles,
                    SUM(vehicles_over_limit) as vehicles_over_limit
                    FROM traffic_stats WHERE date >= CURRENT_DATE - INTERVAL '30 days'`;
    const params = [];
    if (department) {
        params.push(department);
        queryStr += ` AND department = \$${params.length}`;
    }
    queryStr += ` GROUP BY sector_name, department ORDER BY total_vehicles DESC`;
    params.push(limit);
    queryStr += ` LIMIT \$${params.length}`;
    const result = await query(queryStr, params);
    res.json(result.rows);
}));

module.exports = router;
