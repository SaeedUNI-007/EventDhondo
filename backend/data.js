// routes/data.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db'); // Import everything ONCE at the top

// 1. GET Interests
router.get('/interests', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Interests');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Fetch Interests Error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch interests" });
    }
});

// 2. GET Events (Advanced Search & Filter)
router.get('/events', async (req, res) => {
    try {
        const { category, search, date } = req.query;
        // vw_UpcomingEvents columns: Title, EventType, EventDate, Venue, Status, Category, etc.
        let query = `SELECT * FROM vw_UpcomingEvents WHERE 1=1`;

        const pool = await poolPromise;
        const request = pool.request();

        if (category) {
            query += ` AND Category = @Category`; // Corrected: Using 'Category' from the View
            request.input('Category', sql.NVarChar, category);
        }
        if (search) {
            query += ` AND (Title LIKE @Search OR Description LIKE @Search)`;
            request.input('Search', sql.NVarChar, `%${search}%`);
        }
        if (date) {
            query += ` AND EventDate = @Date`;
            request.input('Date', sql.Date, date);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("Event Fetch Error:", err);
        res.status(500).send(err.message);
    }
});

// 3. GET Profile (Uses StudentProfiles table)
router.get('/profile/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`SELECT u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy 
                    FROM Users u 
                    JOIN StudentProfiles s ON u.UserID = s.UserID 
                    WHERE u.UserID = @UserID`); // Changed Table name to StudentProfiles
        
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. PUT Profile
router.put('/profile/:id', async (req, res) => {
    // Expecting firstName and lastName from frontend
    const { firstName, lastName, year, interests } = req.body; 
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .input('FirstName', sql.NVarChar, firstName)
            .input('LastName', sql.NVarChar, lastName)
            .input('Year', sql.Int, year)
            .query(`
                UPDATE StudentProfiles 
                SET FirstName = @FirstName, LastName = @LastName, YearOfStudy = @Year 
                WHERE UserID = @UserID;
                DELETE FROM UserInterests WHERE UserID = @UserID;`);
        
        for (let interestId of interests) {
            await pool.request()
                .input('UserID', sql.Int, req.params.id)
                .input('InterestID', sql.Int, interestId)
                .query(`INSERT INTO UserInterests (UserID, InterestID) VALUES (@UserID, @InterestID)`);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. PUT Admin Verification
router.put('/admin/verify-organizer/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`UPDATE OrganizerProfiles SET VerificationStatus = 'Verified' WHERE UserID = @UserID`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;