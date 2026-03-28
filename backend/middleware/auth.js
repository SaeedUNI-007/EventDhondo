// middleware/auth.js
const { poolPromise, sql } = require('../db');

/**
 * Middleware to verify user authentication
 * Expects userId in headers (x-user-id) or request body
 * Verifies user exists and attaches user info to request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Get userId from headers or query params
        const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;

        if (!userId || !Number.isInteger(Number(userId))) {
            return res.status(401).json({ success: false, message: 'User authentication required' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, Number(userId))
            .query('SELECT UserID, Email, Role, VerificationStatus FROM Users WHERE UserID = @UserID');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // Attach user info to request
        req.user = result.recordset[0];
        next();
    } catch (err) {
        console.error('Auth Middleware Error:', err);
        res.status(500).json({ success: false, message: 'Authentication failed' });
    }
};

/**
 * Middleware to verify admin role
 * Must be used AFTER authMiddleware
 */
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    if (req.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    next();
};

/**
 * Middleware to verify organizer role
 * Must be used AFTER authMiddleware
 */
const organizerMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    if (req.user.Role !== 'Organizer') {
        return res.status(403).json({ success: false, message: 'Organizer access required' });
    }

    next();
};

/**
 * Middleware to verify student role
 * Must be used AFTER authMiddleware
 */
const studentMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    if (req.user.Role !== 'Student') {
        return res.status(403).json({ success: false, message: 'Student access required' });
    }

    next();
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    organizerMiddleware,
    studentMiddleware,
};
