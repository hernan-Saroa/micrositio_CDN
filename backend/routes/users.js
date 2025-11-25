const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
router.get('/', asyncHandler(async (req, res) => {
    const result = await query('SELECT id, email, name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
}));
module.exports = router;
