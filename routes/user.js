
const express              = require('express');
const router               = express.Router();
const db                   = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(1));

// GET /api/user/verification
// Read own verification record
router.get('/verification', async (req, res) => {
    const user_id = req.session.user.user_id;
    try {
        const [rows] = await db.query(
            'SELECT * FROM VERIFICATION WHERE user_id = ?',
            [user_id]
        );
        res.json({ success: true, verification: rows.length > 0 ? rows[0] : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// POST /api/user/verification
// Submit new verification details
// CRUD: CREATE
// -------------------------------------------------------
router.post('/verification', async (req, res) => {
    const { id_type, id_number } = req.body;
    const user_id = req.session.user.user_id;

    if (!id_type || !id_number) {
        return res.status(400).json({ success: false, message: 'ID type and ID number are required.' });
    }

    try {
        // Check if a record already exists
        const [existing] = await db.query(
            'SELECT verification_id FROM VERIFICATION WHERE user_id = ?',
            [user_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Verification already submitted. Use update instead.' });
        }

        // CRUD: CREATE
        await db.query(
            'INSERT INTO VERIFICATION (user_id, id_type, id_number) VALUES (?, ?, ?)',
            [user_id, id_type, id_number]
        );
        res.json({ success: true, message: 'Verification submitted. Awaiting review.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// PUT /api/user/verification
// Update existing verification details
// CRUD: UPDATE
// -------------------------------------------------------
router.put('/verification', async (req, res) => {
    const { id_type, id_number } = req.body;
    const user_id = req.session.user.user_id;

    if (!id_type || !id_number) {
        return res.status(400).json({ success: false, message: 'ID type and ID number are required.' });
    }

    try {
        const [existing] = await db.query(
            'SELECT verification_id FROM VERIFICATION WHERE user_id = ?',
            [user_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'No verification record found. Submit first.' });
        }

        // CRUD: UPDATE - reset status to Pending on resubmit
        await db.query(
            "UPDATE VERIFICATION SET id_type = ?, id_number = ?, status = 'Pending' WHERE user_id = ?",
            [id_type, id_number, user_id]
        );
        res.json({ success: true, message: 'Verification details updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/user/projects?title=&category_id=&page=1
// Browse active projects - PAGINATED
// CRUD: READ
// -------------------------------------------------------
router.get('/projects', async (req, res) => {
    const { title, category_id } = req.query;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;

    let where  = "WHERE p.status = 'Active' AND p.deadline >= CURDATE()";
    const vals = [];

    if (category_id) { where += ' AND p.category_id = ?'; vals.push(category_id); }
    if (title)        { where += ' AND p.title LIKE ?';   vals.push('%' + title + '%'); }

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM PROJECT p ${where}`, vals
        );

        const [projects] = await db.query(`
            SELECT p.project_id, p.title, p.description, p.funding_goal, p.deadline,
                   c.category_name, u.name AS entrepreneur_name,
                   COALESCE(ft.total_collected,  0)              AS total_collected,
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
// POST /api/user/fund
// Contribute money to a project
// CRUD: CREATE (inserts into INVESTMENT table)
// -------------------------------------------------------
router.post('/fund', async (req, res) => {
    const { project_id, amount } = req.body;
    const user_id = req.session.user.user_id;

    if (!project_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Project and valid amount are required.' });
    }

    try {
        const [[project]] = await db.query(
            "SELECT * FROM PROJECT WHERE project_id = ? AND status = 'Active' AND deadline >= CURDATE()",
            [project_id]
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found or no longer active.' });
        }

        // CRUD: CREATE
        await db.query(
            'INSERT INTO INVESTMENT (amount, project_id, investor_id) VALUES (?, ?, ?)',
            [amount, project_id, user_id]
        );

        // Update funding tracker
        const [[tracker]] = await db.query(
            'SELECT * FROM FUNDING_TRACKER WHERE project_id = ?', [project_id]
        );
        const newTotal     = parseFloat(tracker.total_collected) + parseFloat(amount);
        const newRemaining = Math.max(0, parseFloat(project.funding_goal) - newTotal);

        await db.query(
            'UPDATE FUNDING_TRACKER SET total_collected = ?, remaining_amount = ? WHERE project_id = ?',
            [newTotal, newRemaining, project_id]
        );

        if (newTotal >= parseFloat(project.funding_goal)) {
            await db.query("UPDATE PROJECT SET status = 'Funded' WHERE project_id = ?", [project_id]);
        }

        res.json({ success: true, message: 'Contribution recorded!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/user/history?page=1
// Own contribution history - PAGINATED
// CRUD: READ
// -------------------------------------------------------
router.get('/history', async (req, res) => {
    const user_id = req.session.user.user_id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    try {
        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM INVESTMENT WHERE investor_id = ?',
            [user_id]
        );

        const [history] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at,
                   p.title AS project_title, p.status AS project_status,
                   c.category_name
            FROM INVESTMENT i
            JOIN PROJECT p  ON i.project_id  = p.project_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            WHERE i.investor_id = ?
            ORDER BY i.invested_at DESC
            LIMIT ? OFFSET ?
        `, [user_id, limit, offset]);

        res.json({ success: true, history, total, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
