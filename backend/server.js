// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 1. IMPORT DATABASE CONNECTION
const { poolPromise } = require('./db');

// 2. IMPORT ROUTE FILES
const authRoutes = require('./auth');
const dataRoutes = require('./data');
const teamRoutes = require('./team');

const app = express();

// Middleware
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(cors());

// 3. REGISTER YOUR NEW ROUTES
app.use('/api/auth', authRoutes); // All routes in auth.js will start with /api/auth
app.use('/api', dataRoutes);      // All routes in data.js will start with /api
app.use('/api/teams', teamRoutes);

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