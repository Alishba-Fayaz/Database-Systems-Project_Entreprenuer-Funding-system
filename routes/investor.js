// routes/investor.js
const express              = require('express');
const router               = express.Router();
const db                   = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(3));

// -------------------------------------------------------
// GET /api/investor/stats
// CRUD: READ
// -------------------------------------------------------
router.get('/stats', async (req, res) => {
    const id = req.session.user.user_id;
    try {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(i.investment_id)                                        AS total_investments,
                COALESCE(SUM(i.amount), 0)                                    AS total_invested,
                COUNT(DISTINCT i.project_id)                                  AS projects_backed,
                COUNT(DISTINCT CASE WHEN p.status = 'Funded' THEN p.project_id END) AS funded_count
            FROM INVESTMENT i
            JOIN PROJECT p ON i.project_id = p.project_id
            WHERE i.investor_id = ?
        `, [id]);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/investor/search?title=&category_id=&page=1
// Browse active projects - PAGINATED
// CRUD: READ
// -------------------------------------------------------
router.get('/search', async (req, res) => {
    const { title, category_id } = req.query;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    // Build WHERE clause dynamically but safely using parameterized values
    let where  = "WHERE p.status = 'Active' AND p.deadline >= CURDATE()";
    const vals = [];

    if (category_id) { where += ' AND p.category_id = ?';    vals.push(category_id); }
    if (title)        { where += ' AND p.title LIKE ?';       vals.push('%' + title + '%'); }

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM PROJECT p ${where}`,
            vals
        );

        const [projects] = await db.query(`
            SELECT p.project_id, p.title, p.description, p.funding_goal, p.deadline, p.status,
                   c.category_name, u.name AS entrepreneur_name,
                   COALESCE(ft.total_collected,  0)             AS total_collected,
                   COALESCE(ft.remaining_amount, p.funding_goal) AS remaining_amount,
                   ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
            FROM PROJECT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN USERS u     ON p.entrepreneur_id = u.user_id
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            ${where}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [...vals, limit, offset]);

        res.json({ success: true, projects, total, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// POST /api/investor/invest
// Make an investment in a project
// CRUD: CREATE
// -------------------------------------------------------
router.post('/invest', async (req, res) => {
    const { project_id, amount } = req.body;
    const investor_id = req.session.user.user_id;

    if (!project_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid project ID and amount are required.' });
    }

    try {
        // Make sure project exists and is still active
        const [[project]] = await db.query(
            "SELECT * FROM PROJECT WHERE project_id = ? AND status = 'Active' AND deadline >= CURDATE()",
            [project_id]
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found or no longer accepting investments.' });
        }

        // CRUD: CREATE - insert investment row
        await db.query(
            'INSERT INTO INVESTMENT (amount, project_id, investor_id) VALUES (?, ?, ?)',
            [amount, project_id, investor_id]
        );

        // Update FUNDING_TRACKER totals
        const [[tracker]] = await db.query(
            'SELECT * FROM FUNDING_TRACKER WHERE project_id = ?',
            [project_id]
        );

        const newTotal     = parseFloat(tracker.total_collected) + parseFloat(amount);
        const newRemaining = Math.max(0, parseFloat(project.funding_goal) - newTotal);

        await db.query(
            'UPDATE FUNDING_TRACKER SET total_collected = ?, remaining_amount = ? WHERE project_id = ?',
            [newTotal, newRemaining, project_id]
        );

        // Auto-mark project as Funded if goal reached
        if (newTotal >= parseFloat(project.funding_goal)) {
            await db.query("UPDATE PROJECT SET status = 'Funded' WHERE project_id = ?", [project_id]);
        }

        res.json({ success: true, message: 'Investment recorded successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/investor/history?page=1
// View own investment history - PAGINATED
// CRUD: READ
// -------------------------------------------------------
router.get('/history', async (req, res) => {
    const investor_id = req.session.user.user_id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    try {
        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM INVESTMENT WHERE investor_id = ?',
            [investor_id]
        );

        const [investments] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at,
                   p.title AS project_title, p.status AS project_status,
                   c.category_name,
                   ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
            FROM INVESTMENT i
            JOIN PROJECT p  ON i.project_id  = p.project_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE i.investor_id = ?
            ORDER BY i.invested_at DESC
            LIMIT ? OFFSET ?
        `, [investor_id, limit, offset]);

        res.json({ success: true, investments, total, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// DELETE /api/investor/invest/:id
// Remove an investment record
// CRUD: DELETE
// -------------------------------------------------------
router.delete('/invest/:id', async (req, res) => {
    const investment_id = req.params.id;
    const investor_id   = req.session.user.user_id;

    try {
        // Check it belongs to this investor
        const [[inv]] = await db.query(
            'SELECT i.*, ft.total_collected, p.funding_goal FROM INVESTMENT i JOIN FUNDING_TRACKER ft ON i.project_id = ft.project_id JOIN PROJECT p ON i.project_id = p.project_id WHERE i.investment_id = ? AND i.investor_id = ?',
            [investment_id, investor_id]
        );
        if (!inv) {
            return res.status(403).json({ success: false, message: 'Investment not found.' });
        }

        // CRUD: DELETE
        await db.query('DELETE FROM INVESTMENT WHERE investment_id = ?', [investment_id]);

        // Recalculate funding tracker
        const newTotal     = Math.max(0, parseFloat(inv.total_collected) - parseFloat(inv.amount));
        const newRemaining = Math.max(0, parseFloat(inv.funding_goal) - newTotal);
        await db.query(
            'UPDATE FUNDING_TRACKER SET total_collected = ?, remaining_amount = ? WHERE project_id = ?',
            [newTotal, newRemaining, inv.project_id]
        );
        // If it was funded, revert to Active
        await db.query(
            "UPDATE PROJECT SET status = 'Active' WHERE project_id = ? AND status = 'Funded'",
            [inv.project_id]
        );

        res.json({ success: true, message: 'Investment removed.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
