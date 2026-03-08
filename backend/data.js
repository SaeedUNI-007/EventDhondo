// routes/data.js
const express = require('express');
const router = express.Router();
const { poolPromise } = require('./db');

// Task 2: GET /api/interests
// Frontend needs this for the registration dropdown
router.get('/interests', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Interests');
        
        res.status(200).json(result.recordset); // Send array of interests to frontend
    } catch (err) {
        console.error("Fetch Interests Error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch interests" });
    }
});

// Task 4: GET /api/events
// Frontend needs this for Dashboard.js event cards
router.get('/events', async (req, res) => {
    try {
        const pool = await poolPromise;
        
        // Calling the View created by Hamid
        const result = await pool.request().query('SELECT * FROM vw_UpcomingEvents');
        
        res.status(200).json(result.recordset); // Send array of events to frontend
    } catch (err) {
        console.error("Fetch Events Error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch upcoming events" });
    }
});

module.exports = router;