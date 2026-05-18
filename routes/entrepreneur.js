// routes/entrepreneur.js
const express              = require('express');
const router               = express.Router();
const db                   = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes in this file require: logged in + Entrepreneur role
router.use(requireAuth);
router.use(requireRole(2));

// -------------------------------------------------------
// GET /api/entrepreneur/stats
// Summary counts for the dashboard overview cards
// CRUD: READ
// -------------------------------------------------------
router.get('/stats', async (req, res) => {
    const id = req.session.user.user_id;
    try {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(p.project_id)                                              AS total_projects,
                COUNT(CASE WHEN p.status = 'Active' THEN 1 END)                 AS active_projects,
                COUNT(CASE WHEN p.status = 'Funded' THEN 1 END)                 AS funded_projects,
                COALESCE(SUM(ft.total_collected), 0)                             AS total_raised
            FROM PROJECT p
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE p.entrepreneur_id = ?
        `, [id]);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/entrepreneur/projects?page=1&limit=5
// Returns own projects with funding info - PAGINATED
router.get('/projects', async (req, res) => {
    const id    = req.session.user.user_id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    try {
        // Total count for pagination controls
        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM PROJECT WHERE entrepreneur_id = ?',
            [id]
        );

        // Paginated project list
        const [projects] = await db.query(`
            SELECT
                p.project_id, p.title, p.description, p.funding_goal,
                p.deadline, p.status, p.created_at,
                c.category_name,
                COALESCE(ft.total_collected,  0)             AS total_collected,
                COALESCE(ft.remaining_amount, p.funding_goal) AS remaining_amount,
                ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
            FROM PROJECT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE p.entrepreneur_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [id, limit, offset]);

        res.json({ success: true, projects, total, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// POST /api/entrepreneur/projects
// Create a new project
// CRUD: CREATE
// -------------------------------------------------------
router.post('/projects', async (req, res) => {
    const { title, description, funding_goal, deadline, category_id } = req.body;
    const entrepreneur_id = req.session.user.user_id;

    if (!title || !funding_goal || !deadline || !category_id) {
        return res.status(400).json({ success: false, message: 'Title, funding goal, deadline, and category are required.' });
    }
    if (parseFloat(funding_goal) <= 0) {
        return res.status(400).json({ success: false, message: 'Funding goal must be greater than 0.' });
    }

    try {
        // CRUD: CREATE - insert into PROJECT
        const [result] = await db.query(
            'INSERT INTO PROJECT (title, description, funding_goal, deadline, entrepreneur_id, category_id) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description || '', funding_goal, deadline, entrepreneur_id, category_id]
        );

        // Also create an entry in FUNDING_TRACKER for this new project
        await db.query(
            'INSERT INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount) VALUES (?, 0, ?)',
            [result.insertId, funding_goal]
        );

        res.json({ success: true, message: 'Project created successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// PUT /api/entrepreneur/projects/:id
// Edit a project (title, description, funding_goal, deadline, category, status)
// CRUD: UPDATE
// -------------------------------------------------------
router.put('/projects/:id', async (req, res) => {
    const project_id      = req.params.id;
    const entrepreneur_id = req.session.user.user_id;
    const { title, description, funding_goal, deadline, category_id, status } = req.body;

    if (!title || !funding_goal || !deadline || !category_id) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        // Make sure this project belongs to the logged-in entrepreneur
        const [check] = await db.query(
            'SELECT project_id FROM PROJECT WHERE project_id = ? AND entrepreneur_id = ?',
            [project_id, entrepreneur_id]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Project not found or not yours.' });
        }

        // CRUD: UPDATE - update PROJECT row
        await db.query(
            'UPDATE PROJECT SET title = ?, description = ?, funding_goal = ?, deadline = ?, category_id = ?, status = ? WHERE project_id = ?',
            [title, description || '', funding_goal, deadline, category_id, status || 'Active', project_id]
        );

        // Also update remaining_amount in FUNDING_TRACKER
        await db.query(
            'UPDATE FUNDING_TRACKER SET remaining_amount = funding_goal - total_collected WHERE project_id = ? AND remaining_amount > 0',
            [project_id]
        );

        res.json({ success: true, message: 'Project updated successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// DELETE /api/entrepreneur/projects/:id
// Delete a project
// CRUD: DELETE
// -------------------------------------------------------
router.delete('/projects/:id', async (req, res) => {
    const project_id      = req.params.id;
    const entrepreneur_id = req.session.user.user_id;

    try {
        // Verify ownership before deleting
        const [check] = await db.query(
            'SELECT project_id FROM PROJECT WHERE project_id = ? AND entrepreneur_id = ?',
            [project_id, entrepreneur_id]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Project not found or not yours.' });
        }

        // CRUD: DELETE
        // FUNDING_TRACKER and INVESTMENT rows cascade-delete automatically (FK ON DELETE CASCADE)
        await db.query('DELETE FROM PROJECT WHERE project_id = ?', [project_id]);

        res.json({ success: true, message: 'Project deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// -------------------------------------------------------
// GET /api/entrepreneur/projects/:id/investments?page=1
// See who invested in a specific project - PAGINATED
// CRUD: READ
// -------------------------------------------------------
router.get('/projects/:id/investments', async (req, res) => {
    const project_id      = req.params.id;
    const entrepreneur_id = req.session.user.user_id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    try {
        // Confirm this project belongs to the entrepreneur
        const [check] = await db.query(
            'SELECT project_id FROM PROJECT WHERE project_id = ? AND entrepreneur_id = ?',
            [project_id, entrepreneur_id]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Not your project.' });
        }

        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM INVESTMENT WHERE project_id = ?',
            [project_id]
        );

        const [investments] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at, u.name AS investor_name
            FROM INVESTMENT i
            JOIN USERS u ON i.investor_id = u.user_id
            WHERE i.project_id = ?
            ORDER BY i.invested_at DESC
            LIMIT ? OFFSET ?
        `, [project_id, limit, offset]);

        res.json({ success: true, investments, total, page, limit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
