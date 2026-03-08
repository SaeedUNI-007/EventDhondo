// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 1. IMPORT DATABASE CONNECTION
const { poolPromise } = require('./db');

// 2. IMPORT ROUTE FILES
const authRoutes = require('./auth');
const dataRoutes = require('./data');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// 3. REGISTER YOUR NEW ROUTES
app.use('/api/auth', authRoutes); // All routes in auth.js will start with /api/auth
app.use('/api', dataRoutes);      // All routes in data.js will start with /api

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

const PORT = Number(process.env.API_PORT || process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});