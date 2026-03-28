// routes/admin.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const { authenticateToken, authorizeRole } = require('./middleware/auth');

// GET Admin Stats
router.get('/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM [dbo].[Users] WHERE Role = 'Student') as totalStudents,
                (SELECT COUNT(*) FROM [dbo].[Events]) as totalEvents,
                (SELECT COUNT(*) FROM [dbo].[Registrations]) as totalRegistrations
        `);
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// GET Recent Activity
router.get('/recent-activity', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TOP 10 Title, CreatedAt, 'Event Created' as Action 
            FROM [dbo].[Events] ORDER BY CreatedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// GET Student Requests
router.get('/requests', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM [dbo].[EventRequests] WHERE Status = 'Pending'");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// PUT Cancel Event
router.put('/cancel-event', async (req, res) => {
    const { eventId } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('EventID', sql.Int, eventId)
            .execute('dbo.sp_CancelEvent');
        res.json({ success: true, message: "Event cancelled successfully" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// PUT Reject Organizer
router.put('/reject-organizer/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`UPDATE [dbo].[OrganizerProfiles] SET VerificationStatus = 'Rejected' WHERE UserID = @UserID`);
        res.json({ success: true, message: "Organizer rejected" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// PUT Approve/Reject Event Request
router.put('/requests/:id', async (req, res) => {
    const { status, adminNotes } = req.body; // e.g., status: 'Approved'
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('RequestID', sql.Int, req.params.id)
            .input('Status', sql.NVarChar(10), status)
            .input('AdminNotes', sql.NVarChar(sql.MAX), adminNotes)
            .query(`UPDATE [dbo].[EventRequests] 
                    SET Status = @Status, AdminNotes = @AdminNotes 
                    WHERE RequestID = @RequestID`);
        res.json({ success: true, message: `Request ${status} successfully` });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;