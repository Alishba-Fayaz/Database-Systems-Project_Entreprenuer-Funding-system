// routes/auth.js
// Handles: Sign Up, Sign In, Logout, Get current session user

//   All queries use parameterized queries (the ? placeholders).
//   User input is NEVER concatenated into SQL strings directly.
//   This makes the app safe from SQL Injection attacks.

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/auth/roles
// Returns all roles so the signup form can show them as options
router.get('/roles', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT role_id, role_name FROM ROLE');
        res.json({ success: true, roles: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/signup
// Registers a new user
// CRUD: CREATE - inserts one row into USERS
router.post('/signup', async (req, res) => {
    const { name, email, password, role_id } = req.body;

    // Basic validation
    if (!name || !email || !password || !role_id) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Email format check (must contain @)
    if (!email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    try {
        // Check if email already exists
        // PARAMETERIZED QUERY - safe from SQL injection
        const [existing] = await db.query(
            'SELECT user_id FROM USERS WHERE email = ?',
            [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }

        // Insert the new user (password stored as plain text per project requirement)
        await db.query(
            'INSERT INTO USERS (name, email, password, role_id) VALUES (?, ?, ?, ?)',
            [name, email, password, role_id]
        );

        res.json({ success: true, message: 'Account created successfully! Please sign in.' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/login
// Checks credentials and creates a session
// CRUD: READ - selects from USERS
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    try {
        // PARAMETERIZED QUERY - the email value is passed separately, not concatenated
        const [rows] = await db.query(
            'SELECT u.user_id, u.name, u.email, u.password, u.role_id, r.role_name FROM USERS u JOIN ROLE r ON u.role_id = r.role_id WHERE u.email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'No account found with this email.' });
        }

        const user = rows[0];

        // Plain text password comparison
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }

        // Save user info to session (do not save password)
        req.session.user = {
            user_id:   user.user_id,
            name:      user.name,
            email:     user.email,
            role_id:   user.role_id,
            role_name: user.role_name
        };

        // Redirect path based on role
        let redirect = '/dashboard';
        if (user.role_id === 2) redirect = '/entrepreneur';
        if (user.role_id === 3) redirect = '/investor';

        res.json({ success: true, redirect, user: req.session.user });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// GET /api/auth/me
// Returns the logged-in user from session (used by dashboards on load)
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not logged in.' });
    }
});

module.exports = router;
