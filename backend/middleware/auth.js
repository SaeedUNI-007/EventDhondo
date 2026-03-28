// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) return res.status(401).json({ success: false, message: "Access denied: No token provided" });

    jwt.verify(token, process.env.JWT_SECRET || 'supersecret', (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid or expired token" });
        req.user = user; // This attaches the user info (userId, role) to the request
        next();
    });
};

const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ success: false, message: "Access denied: Requires Admin role" });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };