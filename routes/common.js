const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/common/categories
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT category_id, category_name FROM CATEGORY ORDER BY category_name ASC');
        res.json({ success: true, categories: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
