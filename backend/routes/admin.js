// routes/admin.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const bcrypt = require('bcrypt');

const SYSTEM_STUDENT_EVENTS_EMAIL = 'student.events@eventdhondo.local';
const SYSTEM_STUDENT_EVENTS_ORG = 'Student Event Desk';
const REQUEST_PAYLOAD_PREFIX = '__REQUEST_PAYLOAD__:';
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];
const normalizeAllowedCity = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const match = ALLOWED_CITIES.find((city) => city.toLowerCase() === raw);
    return match || null;
};

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

        const result = await pool.request()
            .input('Limit', sql.Int, limit)
            .query(`
                WITH Activity AS (
                    SELECT
                        'Event' AS [Type],
                        ISNULL(op.OrganizationName, 'Organizer') AS Actor,
                        CONCAT('Created: ', e.Title) AS [Target],
                        COALESCE(e.UpdatedAt, e.CreatedAt) AS [At]
                    FROM Events e
                    LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID

                    UNION ALL

                    SELECT
                        'Registration' AS [Type],
                        u.Email AS Actor,
                        CONCAT('Registered for: ', e.Title) AS [Target],
                        r.RegistrationDate AS [At]
                    FROM Registrations r
                    JOIN Users u ON u.UserID = r.UserID
                    JOIN Events e ON e.EventID = r.EventID

                    UNION
                    SELECT
                    'Unregistration' AS [Type],
                    u.Email AS Actor,
                    CONCAT('Unregistered from: ', e.Title) AS [Target],
                    r.CancelledAt AS [At]
                    FROM Registrations r
                    JOIN Users u ON u.UserID = r.UserID
                    JOIN Events e ON e.EventID = r.EventID
                    WHERE r.Status = 'Cancelled'
                    AND r.CancelledAt IS NOT NULL

                    UNION ALL

                    SELECT
                        'Request' AS [Type],
                        su.Email AS Actor,
                        CONCAT('Event request ', er.Status, ': ', er.Title) AS [Target],
                        er.SubmittedAt AS [At]
                    FROM EventRequests er
                    JOIN Users su ON su.UserID = er.StudentID
                )
                SELECT TOP (@Limit)
                    [Type] AS [type],
                    Actor AS [actor],
                    [Target] AS [target],
                    CONVERT(VARCHAR, [At], 120) AS [at]
                FROM Activity
                ORDER BY [At] DESC
            `);

        res.json(result.recordset || []);
    } catch (err) {
        console.error('Admin Activity Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch activity' });
    }
});

const ensureStudentEventsOrganizer = async (pool) => {
    const existing = await pool.request()
        .input('Email', sql.NVarChar(255), SYSTEM_STUDENT_EVENTS_EMAIL)
        .query(`
            SELECT TOP 1 u.UserID
            FROM Users u
            JOIN OrganizerProfiles op ON op.UserID = u.UserID
            WHERE u.Email = @Email
        `);

    const existingId = Number(existing.recordset?.[0]?.UserID);
    if (Number.isInteger(existingId) && existingId > 0) {
        return existingId;
    }

    const passwordHash = await bcrypt.hash('StudentEventsDesk!2026', 10);

    const createdUser = await pool.request()
        .input('Email', sql.NVarChar(255), SYSTEM_STUDENT_EVENTS_EMAIL)
        .input('PasswordHash', sql.NVarChar(255), passwordHash)
        .query(`
            IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
            BEGIN
                SELECT TOP 1 UserID FROM Users WHERE Email = @Email;
            END
            ELSE
            BEGIN
                INSERT INTO Users (Email, PasswordHash, Role, VerificationStatus)
                VALUES (@Email, @PasswordHash, 'Organizer', 'Verified');
                SELECT CAST(SCOPE_IDENTITY() AS INT) AS UserID;
            END
        `);

    const userId = Number(createdUser.recordset?.[0]?.UserID);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('Failed to create system organizer user');
    }

    await pool.request()
        .input('UserID', sql.Int, userId)
        .input('OrganizationName', sql.NVarChar(150), SYSTEM_STUDENT_EVENTS_ORG)
        .input('Description', sql.NVarChar(sql.MAX), 'Auto-managed organizer profile for approved student event requests.')
        .input('ContactEmail', sql.NVarChar(100), SYSTEM_STUDENT_EVENTS_EMAIL)
        .input('City', sql.NVarChar(100), 'Lahore')
        .query(`
            IF NOT EXISTS (SELECT 1 FROM OrganizerProfiles WHERE UserID = @UserID)
            BEGIN
                INSERT INTO OrganizerProfiles (UserID, OrganizationName, Description, ContactEmail, City, VerificationStatus)
                VALUES (@UserID, @OrganizationName, @Description, @ContactEmail, @City, 'Verified');
            END
            ELSE
            BEGIN
                UPDATE OrganizerProfiles
                SET VerificationStatus = 'Verified',
                    City = COALESCE(NULLIF(City, ''), @City)
                WHERE UserID = @UserID;
            END

            UPDATE Users
            SET Role = 'Organizer', VerificationStatus = 'Verified'
            WHERE UserID = @UserID;
        `);

    return userId;
};

const toDateOnly = (value) => {
    const dateObj = value ? new Date(value) : new Date();
    if (Number.isNaN(dateObj.getTime())) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
};

const normalizeTimeInput = (value) => {
    if (!value) return null;
    const raw = String(value).trim().toLowerCase();

    const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hhmm) {
        const h = Number(hhmm[1]);
        const m = Number(hhmm[2]);
        const s = Number(hhmm[3] || 0);
        if (h > 23 || m > 59 || s > 59) return null;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    return null;
};

const parseRequestPayload = (adminNotesRaw) => {
    const raw = String(adminNotesRaw || '');
    if (!raw.startsWith(REQUEST_PAYLOAD_PREFIX)) return {};

    try {
        return JSON.parse(raw.slice(REQUEST_PAYLOAD_PREFIX.length));
    } catch (_err) {
        return {};
    }
};

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
                CASE
                    WHEN LEFT(COALESCE(er.AdminNotes, ''), ${REQUEST_PAYLOAD_PREFIX.length}) = '${REQUEST_PAYLOAD_PREFIX}'
                    THEN NULL
                    ELSE er.AdminNotes
                END AS AdminNotes
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

const fetchPendingOrganizers = async (pool) => {
    const result = await pool.request().query(`
        SELECT
            op.UserID,
            op.OrganizationName,
            op.ContactEmail,
            op.Description,
            CONVERT(VARCHAR, COALESCE(u.CreatedAt, SYSDATETIMEOFFSET()), 120) AS RequestedDate,
            op.VerificationStatus
        FROM OrganizerProfiles op
        JOIN Users u ON op.UserID = u.UserID
        WHERE op.VerificationStatus = 'Pending'
        ORDER BY u.CreatedAt DESC
    `);

    return result.recordset;
};

/**
 * GET /api/admin/pending-organizers
 * Returns pending organizer verification requests
 */
router.get('/pending-organizers', async (req, res) => {
    try {
        const pool = await poolPromise;
        const rows = await fetchPendingOrganizers(pool);
        res.json(rows);
    } catch (err) {
        console.error('Admin Pending Organizers Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch pending organizers' });
    }
});

// Backward-compatible aliases used by some older frontend pages.
router.get('/pending-organizer', async (req, res) => {
    try {
        const pool = await poolPromise;
        const rows = await fetchPendingOrganizers(pool);
        res.json(rows);
    } catch (err) {
        console.error('Admin Pending Organizer Alias Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch pending organizers' });
    }
});

router.get('/organizer-requests', async (req, res) => {
    try {
        const pool = await poolPromise;
        const rows = await fetchPendingOrganizers(pool);
        res.json(rows);
    } catch (err) {
        console.error('Admin Organizer Requests Alias Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch pending organizers' });
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
        const payload = parseRequestPayload(eventRequest.AdminNotes);

        if (status === 'Approved') {
            // Always mark the request approved first.
            await pool.request()
                .input('RequestID', sql.Int, requestId)
                .input('Status', sql.NVarChar(10), 'Approved')
                .input('AdminNotes', sql.NVarChar(sql.MAX), adminNotes || null)
                .query(`
                    UPDATE EventRequests
                    SET Status = @Status, AdminNotes = @AdminNotes
                    WHERE RequestID = @RequestID
                `);

            const organizerId = await ensureStudentEventsOrganizer(pool);

            const requestedType = String(payload.eventType || '').trim();
            const allowedTypes = new Set(['Competition', 'Workshop', 'Seminar', 'Cultural', 'Sports']);
            const eventType = allowedTypes.has(requestedType) ? requestedType : 'Seminar';

            const eventDateOnly = toDateOnly(payload.eventDate || eventRequest.SuggestedDate);
            const eventTime = normalizeTimeInput(payload.eventTime) || '12:00:00';
            const venue = String(payload.venue || '').trim() || 'TBD';
            const city = normalizeAllowedCity(payload.city) || 'Lahore';
            const capacity = Math.max(1, Number.parseInt(payload.capacity, 10) || 100);

            const requestedDeadline = payload.registrationDeadline ? new Date(payload.registrationDeadline) : null;
            let registrationDeadline = `${eventDateOnly}T00:00:00+00:00`;
            if (requestedDeadline && !Number.isNaN(requestedDeadline.getTime())) {
                const deadlineDateOnly = toDateOnly(requestedDeadline);
                registrationDeadline = deadlineDateOnly > eventDateOnly
                    ? `${eventDateOnly}T00:00:00+00:00`
                    : requestedDeadline;
            }

            const posterURLRaw = String(payload.posterURL || '').trim() || null;
            if (posterURLRaw && posterURLRaw.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: 'posterURL is too long (max 255 characters). Please use a shorter hosted URL in the request.',
                });
            }
            const eventResult = await pool.request()
                .input('OrganizerID', sql.Int, organizerId)
                .input('Title', sql.NVarChar(200), eventRequest.Title)
                .input('Description', sql.NVarChar(sql.MAX), payload.description || eventRequest.Description || null)
                .input('EventType', sql.NVarChar(20), eventType)
                .input('EventDate', sql.Date, eventDateOnly)
                .input('EventTime', sql.NVarChar(20), eventTime)
                .input('Venue', sql.NVarChar(150), venue)
                .input('City', sql.NVarChar(100), city)
                .input('Capacity', sql.Int, capacity)
                .input('RegistrationDeadline', sql.DateTimeOffset, registrationDeadline)
                .input('Status', sql.NVarChar(20), 'Published')
                .input('PosterURL', sql.NVarChar(sql.MAX), posterURLRaw)
                .query(`
                    INSERT INTO Events (
                        OrganizerID,
                        Title,
                        Description,
                        EventType,
                        EventDate,
                        EventTime,
                        Venue,
                        City,
                        Capacity,
                        RegistrationDeadline,
                        Status,
                        PosterURL
                    )
                    VALUES (
                        @OrganizerID,
                        @Title,
                        @Description,
                        @EventType,
                        @EventDate,
                        CAST(@EventTime AS TIME),
                        @Venue,
                        @City,
                        @Capacity,
                        @RegistrationDeadline,
                        @Status,
                        @PosterURL
                    );

                    SELECT CAST(SCOPE_IDENTITY() AS INT) AS EventID;
                `);

            const eventId = eventResult.recordset?.[0]?.EventID || null;
            res.json({
                success: true,
                message: eventId
                    ? 'Event request approved and published event created.'
                    : 'Event request approved.',
                eventId,
                status: 'Approved',
                eventCreated: Boolean(eventId),
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

            // Keep both status columns in sync even if procedure implementation differs.
            await pool.request()
                .input('OrganizerID', sql.Int, organizerId)
                .query(`
                    UPDATE OrganizerProfiles
                    SET VerificationStatus = 'Verified'
                    WHERE UserID = @OrganizerID;

                    UPDATE Users
                    SET VerificationStatus = 'Verified'
                    WHERE UserID = @OrganizerID;
                `);

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

/**
 * GET /api/admin/student-events
 * Returns events generated from student requests (managed by Student Event Desk organizer)
 */
router.get('/student-events', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar(255), SYSTEM_STUDENT_EVENTS_EMAIL)
            .query(`
                SELECT
                    e.EventID,
                    e.Title,
                    e.Description,
                    e.EventType,
                    e.EventDate,
                    e.EventTime,
                    e.Venue,
                    e.Capacity,
                    e.RegistrationDeadline,
                    e.Status,
                    e.PosterURL,
                    op.OrganizationName AS Organizer,
                    op.ContactEmail AS OrganizerEmail
                FROM Events e
                JOIN Users u ON u.UserID = e.OrganizerID
                LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                WHERE u.Email = @Email
                ORDER BY e.EventDate DESC, e.EventTime DESC
            `);

        res.json(result.recordset || []);
    } catch (err) {
        console.error('Admin Student Events Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to fetch student events' });
    }
});

module.exports = router;
