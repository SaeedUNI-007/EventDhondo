// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 1. IMPORT DATABASE CONNECTION
const { poolPromise } = require('./db');
const { authenticateToken, authorizeRole } = require('./middleware/auth');

// 2. IMPORT ROUTE FILES
const authRoutes = require('./auth');
const dataRoutes = require('./data');
const teamRoutes = require('./team');
const adminRoutes = require('./admin');

const app = express();

// Middleware
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(cors());
app.use('/api/admin', authenticateToken, authorizeRole('Admin'), adminRoutes); // PROTECTED
app.use('/api/events/register', authenticateToken, dataRoutes); // PROTECTED

// 3. REGISTER YOUR NEW ROUTES
app.use('/api/auth', authRoutes); // Auth uses /api/auth/login, etc.
app.use('/api', dataRoutes);      // This makes /api/interests available!

// B. Protected Routes (Requiring Token)
app.use('/api/events/register', authenticateToken, dataRoutes); // If you have register here, keep it
app.use('/api/profile', authenticateToken, dataRoutes);         // Profile needs the token
app.use('/api/teams', authenticateToken, teamRoutes);
app.use('/api/admin', authenticateToken, authorizeRole('Admin'), adminRoutes);

// 4. TEST ROUTE: GET ALL USERS (Refactored to use the new poolPromise)
app.get('/api/users', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. TEST ROUTE: HELLO WORLD
app.get('/', (req, res) => {
    res.send('EventDhondo Backend is Live!');
});

// Return a friendly response when payload exceeds request body limit.
app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: `Request payload too large. Reduce image size or set REQUEST_BODY_LIMIT (current ${requestBodyLimit}).`,
        });
    }
    return next(err);
});

const PORT = Number(process.env.API_PORT || process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});