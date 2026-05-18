// middleware/auth.js
// Checks if the user is logged in before allowing access to
// protected API routes. If not logged in, returns 401.

// Check if user is logged in (any role)
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Not logged in. Please sign in first.' });
    }
    next();
}

// Check if logged-in user has the correct role
// Usage: requireRole(2) for Entrepreneur, requireRole(3) for Investor, etc.
function requireRole(roleId) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ success: false, message: 'Not logged in.' });
        }
        if (req.session.user.role_id !== roleId) {
            return res.status(403).json({ success: false, message: 'Access denied. Wrong role.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
