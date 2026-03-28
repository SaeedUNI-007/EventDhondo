// routes/admin.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/stats
 * Returns dashboard statistics for admin dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const pool = await poolPromise;

        // Get total users by role
        const usersResult = await pool.request().query(`
            SELECT 
                Role,
                COUNT(*) AS Count
            FROM Users
            GROUP BY Role
        `);

        // Get total events
        const eventsResult = await pool.request().query(`
            SELECT COUNT(*) AS TotalEvents FROM Events
        `);

        // Get total registrations
        const registrationsResult = await pool.request().query(`
            SELECT COUNT(*) AS TotalRegistrations FROM Registrations
        `);

        // Get pending organizer verifications
        const pendingResult = await pool.request().query(`
            SELECT COUNT(*) AS PendingVerifications
            FROM OrganizerProfiles
            WHERE VerificationStatus = 'Pending'
        `);

        // Get total attendees
        const attendanceResult = await pool.request().query(`
            SELECT COUNT(*) AS TotalAttendees FROM Attendance
        `);

        // Build stats object
        const roleStats = {};
        usersResult.recordset.forEach(row => {
            roleStats[row.Role] = row.Count;
        });

        res.json({
            totalUsers: (roleStats['Student'] || 0) + (roleStats['Organizer'] || 0) + (roleStats['Admin'] || 0),
            activeEvents: eventsResult.recordset[0]?.TotalEvents || 0,
            totalRegistrations: registrationsResult.recordset[0]?.TotalRegistrations || 0,
            pendingOrganizers: pendingResult.recordset[0]?.PendingVerifications || 0,
            totalAttendees: attendanceResult.recordset[0]?.TotalAttendees || 0,
        });
    } catch (err) {
        console.error('Admin Stats Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch stats' });
    }
});

/**
 * GET /api/admin/recent-activity
 * Returns recent activity log (registrations, events created, etc.)
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const pool = await poolPromise;
        const limit = Number(req.query.limit) || 20;

        // Get recent events created
        const eventsActivity = await pool.request()
            .input('Limit', sql.Int, limit)
            .query(`
                SELECT TOP (@Limit)
                    'Event Created' AS ActivityType,
                    e.Title AS Description,
                    o.OrganizationName AS Source,
                    e.CreatedAt AS Timestamp
                FROM Events e
                JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
                ORDER BY e.CreatedAt DESC
            `);

        // Get recent registrations
        const registrationsActivity = await pool.request()
            .input('Limit', sql.Int, limit)
            .query(`
                SELECT TOP (@Limit)
                    'New Registration' AS ActivityType,
                    e.Title AS Description,
                    u.Email AS Source,
                    r.RegistrationDate AS Timestamp
                FROM Registrations r
                JOIN Events e ON r.EventID = e.EventID
                JOIN Users u ON r.UserID = u.UserID
                ORDER BY r.RegistrationDate DESC
            `);

        // Get organizer verifications/rejections
        const verificationsActivity = await pool.request()
            .input('Limit', sql.Int, limit)
            .query(`
                SELECT TOP (@Limit)
                    'Organizer ' + op.VerificationStatus AS ActivityType,
                    op.OrganizationName AS Description,
                    u.Email AS Source,
                    op.VerificationStatus + ' at ' + CONVERT(VARCHAR, GETDATE(), 121) AS Timestamp
                FROM OrganizerProfiles op
                JOIN Users u ON op.UserID = u.UserID
                WHERE op.VerificationStatus IN ('Verified', 'Rejected', 'Pending')
                ORDER BY u.CreatedAt DESC
            `);

        // Combine and sort by timestamp (most recent first)
        const allActivity = [
            ...eventsActivity.recordset,
            ...registrationsActivity.recordset,
            ...verificationsActivity.recordset,
        ];

        allActivity.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        const recentActivity = allActivity.slice(0, limit);

        res.json(recentActivity);
    } catch (err) {
        console.error('Admin Activity Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch activity' });
    }
});

/**
 * GET /api/admin/requests
 * Returns pending student event requests
 */
router.get('/requests', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT
                er.RequestID,
                er.StudentID,
                u.Email AS StudentEmail,
                sp.FirstName + ' ' + sp.LastName AS StudentName,
                er.Title,
                er.Description,
                er.SuggestedDate,
                er.Status,
                CONVERT(VARCHAR, er.SubmittedAt, 120) AS SubmittedAt,
                er.AdminNotes
            FROM EventRequests er
            JOIN Users u ON er.StudentID = u.UserID
            LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
            WHERE er.Status = 'Pending'
            ORDER BY er.SubmittedAt DESC
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Admin Requests Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch requests' });
    }
});

/**
 * PUT /api/admin/event-request/:id
 * Approve or reject a student event request
 * Body: { status: 'Approved' | 'Rejected', adminNotes?: string }
 */
router.put('/event-request/:id', async (req, res) => {
    const requestId = Number(req.params.id);
    const { status, adminNotes } = req.body;

    if (!Number.isInteger(requestId)) {
        return res.status(400).json({ success: false, message: 'Invalid request ID' });
    }

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be "Approved" or "Rejected"' });
    }

    try {
        const pool = await poolPromise;

        // First, get the request details
        const requestResult = await pool.request()
            .input('RequestID', sql.Int, requestId)
            .query(`SELECT * FROM EventRequests WHERE RequestID = @RequestID`);

        if (!requestResult.recordset || requestResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Event request not found' });
        }

        const eventRequest = requestResult.recordset[0];

        if (status === 'Approved') {
            // Create an actual event from the request
            const studentId = eventRequest.StudentID;
            
            // Insert into Events table - use StudentID as the organizer for now
            const eventResult = await pool.request()
                .input('Title', sql.NVarChar(200), eventRequest.Title)
                .input('Description', sql.NVarChar(sql.MAX), eventRequest.Description)
                .input('EventDate', sql.Date, eventRequest.SuggestedDate)
                .input('OrganizerID', sql.Int, studentId)
                .input('Capacity', sql.Int, 100) // Default capacity
                .input('RegistrationDeadline', sql.DateTime2, eventRequest.SuggestedDate) // Default to event date
                .input('Venue', sql.NVarChar(200), 'TBD')
                .input('Status', sql.NVarChar(20), 'Draft')
                .query(`
                    INSERT INTO Events (Title, Description, EventDate, OrganizerID, Capacity, RegistrationDeadline, Venue, Status)
                    VALUES (@Title, @Description, @EventDate, @OrganizerID, @Capacity, @RegistrationDeadline, @Venue, @Status);
                    SELECT SCOPE_IDENTITY() AS EventID;
                `);

            const eventId = eventResult.recordset[0]?.EventID;

            // Update the request status
            await pool.request()
                .input('RequestID', sql.Int, requestId)
                .input('Status', sql.NVarChar(10), 'Approved')
                .input('AdminNotes', sql.NVarChar(sql.MAX), adminNotes || null)
                .query(`
                    UPDATE EventRequests
                    SET Status = @Status, AdminNotes = @AdminNotes
                    WHERE RequestID = @RequestID
                `);

            res.json({
                success: true,
                message: 'Event request approved and event created',
                eventId,
                status: 'Approved',
            });
        } else {
            // Reject the request
            await pool.request()
                .input('RequestID', sql.Int, requestId)
                .input('Status', sql.NVarChar(10), 'Rejected')
                .input('AdminNotes', sql.NVarChar(sql.MAX), adminNotes || null)
                .query(`
                    UPDATE EventRequests
                    SET Status = @Status, AdminNotes = @AdminNotes
                    WHERE RequestID = @RequestID
                `);

            res.json({
                success: true,
                message: 'Event request rejected',
                status: 'Rejected',
            });
        }
    } catch (err) {
        console.error('Event Request Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to process request' });
    }
});

/**
 * PUT /api/admin/verify-organizer/:id
 * Verify or reject an organizer application
 * Body: { status: 'Verified' | 'Rejected', reason?: string }
 */
router.put('/verify-organizer/:id', async (req, res) => {
    const organizerId = Number(req.params.id);
    const { status, reason } = req.body;

    if (!Number.isInteger(organizerId)) {
        return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
    }

    if (!['Verified', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be "Verified" or "Rejected"' });
    }

    try {
        const pool = await poolPromise;

        if (status === 'Verified') {
            // Use sp_VerifyOrganizer procedure
            const result = await pool.request()
                .input('OrganizerID', sql.Int, organizerId)
                .input('Status', sql.NVarChar(10), 'Verified')
                .execute('dbo.sp_VerifyOrganizer');

            res.json({
                success: true,
                message: 'Organizer verified successfully',
                status: 'Verified',
            });
        } else if (status === 'Rejected') {
            // Use sp_RejectOrganizer procedure
            const result = await pool.request()
                .input('OrganizerID', sql.Int, organizerId)
                .input('RejectionReason', sql.NVarChar(sql.MAX), reason || null)
                .execute('dbo.sp_RejectOrganizer');

            const message = result.recordset?.[0]?.Message || 'Organizer rejected successfully';

            if (String(message).toLowerCase().startsWith('error')) {
                return res.status(400).json({ success: false, message });
            }

            res.json({
                success: true,
                message,
                status: 'Rejected',
            });
        }
    } catch (err) {
        console.error('Admin Verify Organizer Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to update organizer' });
    }
});

module.exports = router;
