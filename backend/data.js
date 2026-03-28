// routes/data.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db'); // Import everything ONCE at the top
const { authenticateToken } = require('./middleware/auth');

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
        const { category, search, date, organizerId } = req.query;
        const hasOrganizerFilter = Number.isInteger(Number(organizerId));

        // Student dashboard consumes published events from view.
        // Organizer dashboard requests organizerId and gets raw events (including drafts).
        let query = hasOrganizerFilter
            ? `
                SELECT
                    e.EventID,
                    e.OrganizerID,
                    e.Title,
                    e.Description,
                    e.EventType,
                    e.EventDate,
                    e.EventTime,
                    e.Venue,
                    e.Capacity,
                    e.Status,
                    e.PosterURL,
                    o.OrganizationName AS Organizer,
                    o.ContactEmail AS OrganizerEmail,
                    o.ProfilePictureURL AS OrganizerLogo,
                    NULL AS Category
                FROM Events e
                JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
                WHERE e.OrganizerID = @OrganizerID AND e.Status <> 'Cancelled'
            `
            : `SELECT * FROM vw_UpcomingEvents WHERE 1=1`;

        const pool = await poolPromise;
        const request = pool.request();

        if (hasOrganizerFilter) {
            request.input('OrganizerID', sql.Int, Number(organizerId));
        }

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

// 2.1 POST Create Event (Organizer)
router.post('/events', async (req, res) => {
    const {
        organizerId,
        title,
        description,
        eventType,
        eventDate,
        eventTime,
        venue,
        capacity,
        registrationDeadline,
        posterURL,
        status,
    } = req.body || {};

    const parsedOrganizerId = Number(organizerId);
    const parsedCapacity = Number(capacity);
    const normalizedTitle = String(title || '').trim();
    const normalizedType = String(eventType || '').trim();
    const normalizedVenue = venue === undefined ? null : (String(venue || '').trim() || null);
    const normalizedDescription = description === undefined ? null : (String(description || '').trim() || null);
    const normalizedPoster = posterURL === undefined ? null : (String(posterURL || '').trim() || null);
    const normalizedStatus = String(status || 'Published').trim() || 'Published';

    const normalizeDateInput = (value) => {
        if (!value) return null;
        const raw = String(value).trim();

        // yyyy-mm-dd (native input[type=date])
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }

        // dd/mm/yyyy (common locale display format)
        const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) {
            const day = Number(dmy[1]);
            const month = Number(dmy[2]);
            const year = Number(dmy[3]);

            if (month < 1 || month > 12 || day < 1 || day > 31) return null;
            return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
    };

    const normalizeTimeInput = (value) => {
        if (!value) return null;
        const raw = String(value).trim().toLowerCase();

        // HH:mm or HH:mm:ss
        const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (hhmm) {
            const h = Number(hhmm[1]);
            const m = Number(hhmm[2]);
            const s = Number(hhmm[3] || 0);
            if (h > 23 || m > 59 || s > 59) return null;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        // h:mm am/pm
        const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
        if (ampm) {
            let h = Number(ampm[1]);
            const m = Number(ampm[2]);
            const suffix = ampm[3].toLowerCase();
            if (h < 1 || h > 12 || m > 59) return null;
            if (suffix === 'pm' && h !== 12) h += 12;
            if (suffix === 'am' && h === 12) h = 0;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        }

        return null;
    };

    const normalizedEventDate = normalizeDateInput(eventDate);
    const normalizedEventTime = normalizeTimeInput(eventTime);
    const toDateOnlyLocal = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    if (!Number.isInteger(parsedOrganizerId) || parsedOrganizerId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid organizerId is required' });
    }
    if (!normalizedTitle) {
        return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (!normalizedType) {
        return res.status(400).json({ success: false, message: 'eventType is required' });
    }
    if (!normalizedEventDate) {
        return res.status(400).json({ success: false, message: 'Valid eventDate is required' });
    }
    if (!normalizedEventTime) {
        return res.status(400).json({ success: false, message: 'eventTime is required' });
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
        return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
    }

    // DB requires RegistrationDeadline. Default to event day start-time so it always satisfies CK_Events_Dates.
    const fallbackDeadlineRaw = `${normalizedEventDate}T00:00:00`;
    const parsedDeadline = new Date(registrationDeadline || fallbackDeadlineRaw);
    if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
    }

    const deadlineDateOnly = toDateOnlyLocal(parsedDeadline);
    if (deadlineDateOnly > normalizedEventDate) {
        return res.status(400).json({
            success: false,
            message: 'Registration deadline date cannot be after event date.',
        });
    }

    try {
        const pool = await poolPromise;

        const organizerProfileCheck = await pool.request()
            .input('UserID', sql.Int, parsedOrganizerId)
            .query(`
                SELECT TOP 1 UserID
                FROM [dbo].[OrganizerProfiles]
                WHERE UserID = @UserID
            `);

        if (!organizerProfileCheck.recordset?.length) {
            return res.status(400).json({
                success: false,
                message: 'Selected user is not an organizer profile. Please login with an organizer account.',
            });
        }

        const result = await pool.request()
            .input('OrganizerID', sql.Int, parsedOrganizerId)
            .input('Title', sql.NVarChar(200), normalizedTitle)
            .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
            .input('EventType', sql.NVarChar(20), normalizedType)
            .input('EventDate', sql.Date, normalizedEventDate)
            .input('EventTime', sql.NVarChar(20), normalizedEventTime)
            .input('Venue', sql.NVarChar(150), normalizedVenue)
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, parsedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(255), normalizedPoster)
            .query(`
                INSERT INTO [dbo].[Events]
                    (OrganizerID, Title, Description, EventType, EventDate, EventTime, Venue, Capacity, RegistrationDeadline, Status, PosterURL)
                OUTPUT
                    INSERTED.EventID,
                    INSERTED.OrganizerID,
                    INSERTED.Title,
                    INSERTED.Description,
                    INSERTED.EventType,
                    INSERTED.EventDate,
                    INSERTED.EventTime,
                    INSERTED.Venue,
                    INSERTED.Capacity,
                    INSERTED.RegistrationDeadline,
                    INSERTED.Status,
                    INSERTED.PosterURL
                VALUES
                    (@OrganizerID, @Title, @Description, @EventType, @EventDate, CAST(@EventTime AS TIME), @Venue, @Capacity, @RegistrationDeadline, @Status, @PosterURL)
            `);

        return res.status(201).json({ success: true, event: result.recordset?.[0] || null });
    } catch (err) {
        console.error('Create Event Error:', err);
        if (err?.number === 547) {
            return res.status(400).json({
                success: false,
                message: 'Organizer profile was not found for this user. Please complete organizer registration/profile first.',
            });
        }
        return res.status(500).json({ success: false, message: err.message || 'Failed to create event' });
    }
});

// 2.2 POST Register for Event (Sprint 2)
router.post('/events/register', async (req, res) => {
    const { userId, eventId } = req.body;

    if (!Number.isInteger(Number(userId)) || !Number.isInteger(Number(eventId))) {
        return res.status(400).json({ success: false, message: 'userId and eventId are required as integers' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, Number(userId))
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_RegisterForEvent');

        const message = result.recordset?.[0]?.Message || 'Registration processed';
        const lowered = String(message).toLowerCase();

        if (lowered.startsWith('error')) {
            return res.status(400).json({ success: false, message });
        }

        return res.json({
            success: true,
            waitlisted: lowered.includes('waitlisted'),
            message,
        });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// 2.2b POST Unregister from Event (uses existing SQL proc)
router.post('/events/unregister', async (req, res) => {
    const { userId, eventId } = req.body;

    if (!Number.isInteger(Number(userId)) || !Number.isInteger(Number(eventId))) {
        return res.status(400).json({ success: false, message: 'userId and eventId are required as integers' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, Number(userId))
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_UnregisterFromEvent');

        const message = result.recordset?.[0]?.Message || 'Unregistration processed';
        if (String(message).toLowerCase().startsWith('error')) {
            return res.status(400).json({ success: false, message });
        }

        return res.json({ success: true, message });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// 2.2c GET Student Registrations
router.get('/events/registrations/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT
                    r.RegistrationID,
                    r.EventID,
                    r.UserID,
                    r.Status,
                    r.RegistrationDate,
                    r.CancelledAt,
                    e.Title,
                    e.EventDate,
                    e.EventTime,
                    e.Venue,
                    e.EventType
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                WHERE r.UserID = @UserID
                ORDER BY r.RegistrationDate DESC
            `);

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2.3 POST Event Check-In by QR code (Sprint 2)
router.post('/events/check-in', async (req, res) => {
    const { qrCode } = req.body;

    if (!qrCode || !String(qrCode).trim()) {
        return res.status(400).json({ success: false, message: 'qrCode is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('QRCode', sql.NVarChar(255), String(qrCode).trim())
            .query(`
                DECLARE @RegistrationID INT;

                SELECT @RegistrationID = RegistrationID
                FROM [dbo].[Registrations]
                WHERE QRCode = @QRCode;

                IF @RegistrationID IS NULL
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success, 'Invalid QR code' AS Message;
                    RETURN;
                END

                UPDATE [dbo].[Registrations]
                SET Status = 'Attended'
                WHERE RegistrationID = @RegistrationID;

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                BEGIN
                    INSERT INTO [dbo].[Attendance] (RegistrationID)
                    VALUES (@RegistrationID);
                END

                SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
            `);

        const payload = result.recordset?.[0];
        if (!payload?.Success) {
            return res.status(404).json({ success: false, message: payload?.Message || 'Invalid QR code' });
        }

        return res.json({ success: true, message: payload.Message });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2.4 GET Notifications (Unread/unsent first) (Sprint 2)
router.get('/notifications/:userId', async (req, res) => {
    if (!Number.isInteger(Number(req.params.userId))) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, Number(req.params.userId))
            .query(`
                SELECT *
                FROM [dbo].[Notifications]
                WHERE UserID = @UserID
                  AND Status IN ('Pending', 'Sent')
                ORDER BY CreatedAt DESC
            `);
        return res.json(result.recordset);
    } catch (err) {
        console.error('Notification Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/events/:id', authenticateToken, async (req, res) => {
    const eventId = Number(req.params.id);
    const userId = req.user.userId; // Securely get ID from token

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    try {
        const pool = await poolPromise;

        // 1. OWNERSHIP CHECK (Must be done first!)
        const check = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT OrganizerID FROM [dbo].[Events] WHERE EventID = @EventID');
        
        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        if (check.recordset[0].OrganizerID !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized: You don't own this event" });
        }

        // 2. ATTEMPT DELETE
        try {
            const result = await pool.request()
                .input('EventID', sql.Int, eventId)
                .input('OrganizerID', sql.Int, userId)
                .query('DELETE FROM [dbo].[Events] WHERE EventID = @EventID AND OrganizerID = @OrganizerID');

            if (result.rowsAffected[0] > 0) {
                return res.json({ success: true, message: 'Event deleted successfully' });
            }
        } catch (deleteErr) {
            // 3. ARCHIVE ON FK CONSTRAINT VIOLATION (Error 547)
            if (deleteErr?.number === 547) {
                await pool.request()
                    .input('EventID', sql.Int, eventId)
                    .input('OrganizerID', sql.Int, userId)
                    .query("UPDATE [dbo].[Events] SET Status = 'Cancelled' WHERE EventID = @EventID AND OrganizerID = @OrganizerID");
                
                return res.json({
                    success: true,
                    softDeleted: true,
                    message: 'Event has registrations, so it was archived as Cancelled.',
                });
            }
            throw deleteErr; // Re-throw if it's a different error
        }
    } catch (err) {
        console.error('Delete Event Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// ... existing imports ...

// 3. GET Profile (Updated to return LinkedIn/GitHub)
router.get('/profile/:id', async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid user id is required' });
    }

    try {
        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`SELECT UserID, Email, Role FROM Users WHERE UserID = @UserID`);

        const user = userResult.recordset?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (String(user.Role || '').toLowerCase() === 'organizer') {
            const organizerResult = await pool.request()
                .input('UserID', sql.Int, userId)
                .query(`
                    SELECT
                        u.UserID,
                        u.Email,
                        u.Role,
                        o.OrganizationName,
                        o.Description,
                        o.ContactEmail,
                        o.ProfilePictureURL,
                        o.VerificationStatus
                    FROM Users u
                    JOIN OrganizerProfiles o ON u.UserID = o.UserID
                    WHERE u.UserID = @UserID
                `);

            const organizerProfile = organizerResult.recordset?.[0] || null;
            if (!organizerProfile) {
                return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            }

            return res.json(organizerProfile);
        }

        const studentResult = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
              SELECT u.UserID, u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy,
                                    s.DateOfBirth, s.ProfilePictureURL, s.LinkedInURL, s.GitHubURL
                FROM Users u 
                JOIN StudentProfiles s ON u.UserID = s.UserID 
                WHERE u.UserID = @UserID`);

        const studentProfile = studentResult.recordset?.[0] || null;
        if (!studentProfile) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        res.json(studentProfile);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. PUT Profile (Updated to save LinkedIn/GitHub)
router.put('/profile/:id', async (req, res) => {
    if (req.user.userId !== Number(req.params.id)) {
        return res.status(403).json({ success: false, message: "Unauthorized: You can only edit your own profile." });
    }
    const {
        role,
        firstName,
        lastName,
        department,
        year,
        dateOfBirth,
        profilePictureURL,
        linkedInURL,
        gitHubURL,
        interests,
        organizationName,
        description,
        contactEmail,
    } = req.body;

    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid user id is required' });
    }

    try {
        const pool = await poolPromise;

        const userResult = await pool.request()
            .input('UserID', sql.Int, userId)
            .query('SELECT UserID, Role FROM Users WHERE UserID = @UserID');

        const user = userResult.recordset?.[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const dbRole = String(user.Role || '').toLowerCase();
        const requestedRole = String(role || '').toLowerCase();
        const effectiveRole = requestedRole || dbRole;

        if (effectiveRole === 'organizer' || dbRole === 'organizer') {
            const normalizedOrgName = String(organizationName || '').trim() || null;
            const normalizedDescription = description === undefined ? undefined : (String(description || '').trim() || null);
            const normalizedContactEmail = String(contactEmail || '').trim() || null;
            const normalizedProfilePicture = profilePictureURL || null;

            const organizerUpdate = pool.request()
                .input('UserID', sql.Int, userId)
                .input('OrganizationName', sql.NVarChar(150), normalizedOrgName)
                .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
                .input('ContactEmail', sql.NVarChar(100), normalizedContactEmail)
                .input('ProfilePictureURL', sql.NVarChar(sql.MAX), normalizedProfilePicture)
                .query(`
                    UPDATE OrganizerProfiles
                    SET OrganizationName = COALESCE(@OrganizationName, OrganizationName),
                        Description = COALESCE(@Description, Description),
                        ContactEmail = COALESCE(@ContactEmail, ContactEmail),
                        ProfilePictureURL = @ProfilePictureURL
                    WHERE UserID = @UserID
                `);

            const result = await organizerUpdate;
            if ((result.rowsAffected?.[0] || 0) === 0) {
                return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            }

            return res.json({ success: true, role: 'Organizer' });
        }

        const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;

        if (dateOfBirth && Number.isNaN(parsedDob?.getTime())) {
            return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });
        }

        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('FirstName', sql.NVarChar(50), firstName || null)
            .input('LastName', sql.NVarChar(50), lastName || null)
            .input('Department', sql.NVarChar(100), department || null)
            .input('Year', sql.Int, Number.isInteger(Number(year)) ? Number(year) : null)
            .input('DateOfBirth', sql.Date, dateOfBirth ? parsedDob : null)
            .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL || null)
            .input('LinkedIn', sql.NVarChar(255), linkedInURL || null)
            .input('GitHub', sql.NVarChar(255), gitHubURL || null)
            .query(`UPDATE StudentProfiles 
                    SET FirstName = @FirstName, LastName = @LastName, 
                        Department = @Department, YearOfStudy = COALESCE(@Year, YearOfStudy),
                        DateOfBirth = @DateOfBirth, ProfilePictureURL = @ProfilePictureURL,
                        LinkedInURL = @LinkedIn, GitHubURL = @GitHub
                    WHERE UserID = @UserID`);
        
        // Interest deletion/insertion logic remains the same
        if (Array.isArray(interests)) {
            await pool.request().input('UserID', sql.Int, userId).query(`DELETE FROM UserInterests WHERE UserID = @UserID`);
            for (const interestId of interests) {
                await pool.request().input('UserID', sql.Int, userId).input('InterestID', sql.Int, interestId).query(`INSERT INTO UserInterests (UserID, InterestID) VALUES (@UserID, @InterestID)`);
            }
        }
        res.json({ success: true, role: 'Student' });
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

// GET Registrations for a specific Event (Organizer side)
router.get('/organizer/registrations/:eventId', async (req, res) => {
    try {
        const pool = await poolPromise;
        // Verify owner first if you have time, otherwise simple fetch:
        const result = await pool.request()
            .input('EventID', sql.Int, req.params.eventId)
            .query(`SELECT r.*, u.Email 
                    FROM [dbo].[Registrations] r
                    JOIN [dbo].[Users] u ON r.UserID = u.UserID
                    WHERE r.EventID = @EventID`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

router.post('/events/request', authenticateToken, async (req, res) => {
    const { title, description, suggestedDate } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('StudentID', sql.Int, req.user.userId) // Uses JWT, not body
            .input('Title', sql.NVarChar, title)
            .input('Description', sql.NVarChar, description)
            .input('SuggestedDate', sql.Date, suggestedDate)
            .query(`INSERT INTO [dbo].[EventRequests] (StudentID, Title, Description, SuggestedDate, Status) 
                    VALUES (@StudentID, @Title, @Description, @SuggestedDate, 'Pending')`);
        res.json({ success: true, message: "Request submitted" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;