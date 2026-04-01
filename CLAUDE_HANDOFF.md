# EventDhondo Claude Handoff

Use this document as a one-shot handoff for Claude.

## 1) Files To Share

Send these files exactly:

1. backend/data.js
2. backend/server.js
3. backend/db.js
4. backend/package.json
5. frontend/app/attendanceO/page.js
6. frontend/app/profileO/page.js
7. frontend/app/qr-code/page.js
8. frontend/app/profile/page.js
9. frontend/app/layout.js
10. frontend/package.json
11. package.json

## 2) Prompt For Claude (Copy/Paste)

```text
I need you to fix a persistent QR check-in bug in my EventDhondo project (Windows, Next.js frontend + Express backend + SQL Server).

Current symptom in organizer attendance page: when I paste student QR value EDUQR:4:d70fa5c2da701e58cbdd, API returns error "Invalid QR format. Use the student QR from the QR Code tab."

Student is already registered in selected event (eventId 12).

There is also frequent backend/frontend start instability where commands return exit code 1.

Please do all of the following:
1. Reproduce the issue from code and request path, not assumptions.
2. Trace exact check-in flow from frontend -> backend and identify why this token is rejected in UI path but accepted in direct API tests.
3. Fix check-in so pasted EDUQR tokens always work for registered students.
4. Keep event selection required.
5. Keep compatibility with legacy registration QR values if possible.
6. Make error messages precise and user-facing.
7. Ensure backend startup behavior is deterministic and logs clear reason on failure.
8. Ensure frontend attendance page sends stable payload for manual paste and scan.
9. Return a minimal patch list with file-by-file diffs and why each change is needed.
10. Provide a final verification checklist with exact commands and expected outputs.

Use these files as source of truth:
- backend/data.js
- backend/server.js
- backend/db.js
- backend/package.json
- frontend/app/attendanceO/page.js
- frontend/app/profileO/page.js
- frontend/app/qr-code/page.js
- frontend/app/profile/page.js
- frontend/app/layout.js
- frontend/package.json
- package.json
```

## 3) Runtime Context To Share With Claude

Add these details with your message:

1. Exact QR pasted during failure: `EDUQR:4:d70fa5c2da701e58cbdd`
2. Selected event id during failure: `12`
3. Error shown in organizer attendance UI: `Invalid QR format. Use the student QR from the QR Code tab.`
4. Browser console often shows repeated `POST /api/events/check-in` failures.
5. Backend startup frequently exits with code `1` after running `node server.js`.
6. Frontend dev server (`npm run dev`) also frequently exits with code `1`.

## 4) Quick Send Instructions

1. Open this file: `CLAUDE_HANDOFF.md`
2. Share the file list from section 1 and attach those files.
3. Paste section 2 prompt as your message.
4. Paste section 3 runtime context below that prompt.

## 5) File Contents Bundle

Below are current contents of all required files.

### backend/data.js

```
// routes/data.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sql, poolPromise } = require('./db'); // Import everything ONCE at the top
const { authMiddleware } = require('./middleware/auth'); // Import auth middleware
const REQUEST_PAYLOAD_PREFIX = '__REQUEST_PAYLOAD__:';

const buildStudentQrToken = (userId) => {
    const secret = process.env.QR_SECRET || process.env.JWT_SECRET || 'eventdhondo-qr-secret';
    const normalizedUserId = String(Number(userId));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(normalizedUserId)
        .digest('hex')
        .slice(0, 20);
    return `EDUQR:${normalizedUserId}:${signature}`;
};

const parseStudentQrToken = (token) => {
    const raw = String(token || '').trim();
    const match = raw.match(/^EDUQR:(\d+):([a-f0-9]{20})$/i);
    if (!match) return null;

    const userId = Number(match[1]);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const provided = `EDUQR:${userId}:${String(match[2] || '').toLowerCase()}`;
    const expected = buildStudentQrToken(userId);
    // Prefer strict verification, but accept valid EDUQR shape as compatibility fallback
    // because existing generated tokens may come from older secret/config values.
    if (expected.toLowerCase() === provided.toLowerCase()) {
        return userId;
    }

    return userId;
};

const normalizeQrPayload = (value) => {
    const stripNoise = (input) => String(input || '')
        .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
        .replace(/[\r\n\t]/g, ' ')
        .trim()
        .replace(/^['\"`\s]+|['\"`\s]+$/g, '');

    const raw = stripNoise(value);
    if (!raw) return '';

    const variants = [raw];
    try {
        variants.push(stripNoise(decodeURIComponent(raw)));
    } catch (_err) {
        // Ignore decode errors.
    }

    for (const item of variants) {
        const normalized = stripNoise(item);
        const compact = normalized.replace(/\s+/g, '');

        const tokenMatch = compact.match(/EDUQR:\d+:[a-f0-9]{20}/i)
            || normalized.match(/EDUQR:\d+:[a-f0-9]{20}/i);
        if (tokenMatch?.[0]) {
            const parts = tokenMatch[0].split(':');
            return `EDUQR:${parts[1]}:${String(parts[2] || '').toLowerCase()}`;
        }

        try {
            if (/^https?:\/\//i.test(normalized)) {
                const parsed = new URL(normalized);
                const candidate = parsed.searchParams.get('token')
                    || parsed.searchParams.get('qr')
                    || parsed.searchParams.get('code');
                if (candidate) {
                    const c = stripNoise(candidate);
                    const m = c.replace(/\s+/g, '').match(/EDUQR:\d+:[a-f0-9]{20}/i)
                        || c.match(/EDUQR:\d+:[a-f0-9]{20}/i);
                    if (m?.[0]) {
                        const p = m[0].split(':');
                        return `EDUQR:${p[1]}:${String(p[2] || '').toLowerCase()}`;
                    }
                    return c;
                }
            }
        } catch (_err) {
            // Not a URL, keep checking.
        }
    }

    return raw;
};

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

// 1a. GET Users by email (for team invitations)
router.get('/users', async (req, res) => {
    const email = req.query.email;

    if (!email || !String(email).trim()) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVarChar(255), String(email).trim().toLowerCase())
            .query(`
                SELECT TOP 1
                    u.UserID as id,
                    u.UserID as userId,
                    u.Email as email,
                    COALESCE(
                        CONCAT(sp.FirstName, ' ', sp.LastName),
                        op.OrganizationName,
                        u.Email
                    ) as name,
                    u.Role as role
                FROM Users u
                LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
                LEFT JOIN OrganizerProfiles op ON u.UserID = op.UserID
                WHERE LOWER(u.Email) = @Email
            `);

        if (result.recordset && result.recordset.length > 0) {
            return res.json(result.recordset[0]);
        }

        return res.status(404).json({ success: false, message: 'User not found' });
    } catch (err) {
        console.error("Get User by Email Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 1b. GET stable student QR token by user ID
router.get('/users/:userId/qr-token', async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT TOP 1 UserID, Email, Role
                FROM [dbo].[Users]
                WHERE UserID = @UserID
            `);

        const user = result.recordset?.[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            userId: user.UserID,
            email: user.Email,
            role: user.Role,
            qrToken: buildStudentQrToken(user.UserID),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
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
                WHERE e.OrganizerID = @OrganizerID
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

// 2.0b GET Event Details by ID (full detail page)
router.get('/events/check-in', async (_req, res) => {
    return res.status(405).json({
        success: false,
        message: 'Use POST /api/events/check-in with qrCode and eventId.',
    });
});

router.get('/events/:id', async (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid event id is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1
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
                    e.RegistrationDeadline,
                    op.OrganizationName AS Organizer,
                    op.ContactEmail AS OrganizerEmail,
                    op.Description AS OrganizerDescription,
                    op.ProfilePictureURL AS OrganizerLogo,
                    u.Email AS OrganizerAccountEmail,
                    (
                        SELECT COUNT(*)
                        FROM Registrations r
                        WHERE r.EventID = e.EventID
                          AND r.Status = 'Confirmed'
                    ) AS ConfirmedRegistrations
                FROM Events e
                JOIN OrganizerProfiles op ON e.OrganizerID = op.UserID
                JOIN Users u ON op.UserID = u.UserID
                WHERE e.EventID = @EventID
            `);

        const event = result.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        return res.json(event);
    } catch (err) {
        console.error('Event Detail Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event details' });
    }
});

// 2.1 POST Create Event (Organizer)
// Requires authentication - organizer can only create events for themselves
router.post('/events', authMiddleware, async (req, res) => {
    const {
        organizerId,  // Deprecated: ignored, use authenticated user ID
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

    // Use authenticated user's ID instead of trusting client-provided organizerId
    const parsedOrganizerId = req.user?.UserID;
    
    if (!parsedOrganizerId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user?.Role !== 'Organizer') {
        return res.status(403).json({ success: false, message: 'Only organizers can create events' });
    }

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
    if (normalizedPoster && normalizedPoster.length > 255) {
        return res.status(400).json({
            success: false,
            message: 'posterURL is too long (max 255 characters). Please use a shorter hosted URL.',
        });
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
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
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
                    (
                        @OrganizerID,
                        @Title,
                        @Description,
                        @EventType,
                        @EventDate,
                        CAST(@EventTime AS TIME),
                        @Venue,
                        @Capacity,
                        @RegistrationDeadline,
                        @Status,
                        @PosterURL
                    )
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
// Requires authentication - user can only register themselves
router.post('/events/register', authMiddleware, async (req, res) => {
    const { eventId } = req.body;
    const userId = req.user?.UserID;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(Number(eventId))) {
        return res.status(400).json({ success: false, message: 'eventId is required as an integer' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
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
// Requires authentication - user can only unregister themselves
router.post('/events/unregister', authMiddleware, async (req, res) => {
    const { eventId } = req.body;
    const userId = req.user?.UserID;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(Number(eventId))) {
        return res.status(400).json({ success: false, message: 'eventId is required as an integer' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_UnregisterFromEvent');

        const message = result.recordset?.[0]?.Message || 'Unregistration processed';
        if (String(message).toLowerCase().startsWith('error')) {
            return res.status(400).json({ success: false, message });
        }

        // Auto-promote next user from waitlist in FIFO order when a seat is freed.
        const waitlistPromotion = await pool.request()
            .input('EventID', sql.Int, Number(eventId))
            .query(`
                DECLARE @MaxCap INT;
                DECLARE @CurrentCount INT;
                DECLARE @NextWaitlistID INT;
                DECLARE @NextUserID INT;

                SELECT @MaxCap = Capacity
                FROM [dbo].[Events]
                WHERE EventID = @EventID;

                SELECT @CurrentCount = COUNT(*)
                FROM [dbo].[Registrations]
                WHERE EventID = @EventID AND Status = 'Confirmed';

                IF @MaxCap IS NULL OR @CurrentCount >= @MaxCap
                BEGIN
                    SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID;
                    RETURN;
                END

                SELECT TOP 1
                    @NextWaitlistID = WaitlistID,
                    @NextUserID = UserID
                FROM [dbo].[RegistrationWaitlist]
                WHERE EventID = @EventID
                ORDER BY RequestedAt ASC, WaitlistID ASC;

                IF @NextWaitlistID IS NULL OR @NextUserID IS NULL
                BEGIN
                    SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID;
                    RETURN;
                END

                IF EXISTS (
                    SELECT 1
                    FROM [dbo].[Registrations]
                    WHERE EventID = @EventID AND UserID = @NextUserID AND Status = 'Cancelled'
                )
                BEGIN
                    UPDATE [dbo].[Registrations]
                    SET
                        Status = 'Confirmed',
                        CancelledAt = NULL,
                        RegistrationDate = SYSDATETIMEOFFSET(),
                        QRCode = CAST(NEWID() AS NVARCHAR(100))
                    WHERE EventID = @EventID
                      AND UserID = @NextUserID
                      AND Status = 'Cancelled';
                END
                ELSE IF NOT EXISTS (
                    SELECT 1
                    FROM [dbo].[Registrations]
                    WHERE EventID = @EventID AND UserID = @NextUserID AND Status <> 'Cancelled'
                )
                BEGIN
                    INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
                    VALUES (@EventID, @NextUserID, 'Confirmed', CAST(NEWID() AS NVARCHAR(100)));
                END

                DELETE FROM [dbo].[RegistrationWaitlist]
                WHERE WaitlistID = @NextWaitlistID;

                EXEC [dbo].[sp_AddNotification]
                    @UserID = @NextUserID,
                    @Title = 'Waitlist Update',
                    @Message = 'A seat became available. You have been moved from waitlist to confirmed registration.',
                    @EventID = @EventID;

                SELECT CAST(1 AS BIT) AS Promoted, @NextUserID AS PromotedUserID;
            `);

        const promoted = Boolean(waitlistPromotion.recordset?.[0]?.Promoted);

        return res.json({
            success: true,
            message: promoted ? `${message} Next waitlisted student has been auto-registered.` : message,
            waitlistPromoted: promoted,
            promotedUserId: waitlistPromotion.recordset?.[0]?.PromotedUserID || null,
        });
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
                UPDATE [dbo].[Registrations]
                SET QRCode = CAST(NEWID() AS NVARCHAR(255))
                WHERE UserID = @UserID
                  AND Status <> 'Cancelled'
                  AND (QRCode IS NULL OR LTRIM(RTRIM(QRCode)) = '');

                SELECT
                    r.RegistrationID,
                    r.EventID,
                    r.UserID,
                    r.Status,
                    r.QRCode,
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
    const qrCode = normalizeQrPayload(req.body?.qrCode || req.query?.qrCode);
    const eventId = Number(req.body?.eventId ?? req.query?.eventId);
    const qrUserId = Number(req.body?.qrUserId ?? req.query?.qrUserId);

    if (!qrCode || !String(qrCode).trim()) {
        return res.status(400).json({ success: false, message: 'qrCode is required' });
    }

    try {
        const pool = await poolPromise;

        const studentQrUserId = Number.isInteger(qrUserId) && qrUserId > 0
            ? qrUserId
            : parseStudentQrToken(qrCode);
        if (studentQrUserId) {
            if (!Number.isInteger(eventId) || eventId <= 0) {
                return res.status(400).json({ success: false, message: 'eventId is required for student QR check-in' });
            }

            const byStudentToken = await pool.request()
                .input('UserID', sql.Int, studentQrUserId)
                .input('EventID', sql.Int, eventId)
                .query(`
                    DECLARE @RegistrationID INT;
                    DECLARE @EventStatus NVARCHAR(20);

                    SELECT TOP 1 @EventStatus = [Status]
                    FROM [dbo].[Events]
                    WHERE EventID = @EventID;

                    IF @EventStatus IS NULL
                    BEGIN
                        SELECT CAST(0 AS BIT) AS Success, 'Selected event not found' AS Message;
                        RETURN;
                    END

                    IF LOWER(ISNULL(@EventStatus, '')) = 'cancelled'
                    BEGIN
                        SELECT CAST(0 AS BIT) AS Success, 'Selected event is cancelled' AS Message;
                        RETURN;
                    END

                    SELECT TOP 1 @RegistrationID = RegistrationID
                    FROM [dbo].[Registrations]
                    WHERE UserID = @UserID
                      AND EventID = @EventID
                      AND Status <> 'Cancelled'
                    ORDER BY RegistrationDate DESC;

                    IF @RegistrationID IS NULL
                    BEGIN
                        INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
                        VALUES (@EventID, @UserID, 'Attended', CAST(NEWID() AS NVARCHAR(255)));

                        SET @RegistrationID = SCOPE_IDENTITY();

                        IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                        BEGIN
                            INSERT INTO [dbo].[Attendance] (RegistrationID)
                            VALUES (@RegistrationID);
                        END

                        SELECT CAST(1 AS BIT) AS Success, 'Attendance marked! (Auto-registered for event)' AS Message;
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

            const payload = byStudentToken.recordset?.[0];
            if (!payload?.Success) {
                return res.status(400).json({ success: false, message: payload?.Message || 'Invalid QR code' });
            }

            return res.json({ success: true, message: payload.Message });
        }

        const legacyResult = await pool.request()
            .input('QRCode', sql.NVarChar(255), String(qrCode).trim())
            .input('EventID', sql.Int, Number.isInteger(eventId) && eventId > 0 ? eventId : null)
            .query(`
                DECLARE @RegistrationID INT;
                DECLARE @MatchedEventID INT;

                SELECT TOP 1
                    @RegistrationID = RegistrationID,
                    @MatchedEventID = EventID
                FROM [dbo].[Registrations]
                WHERE QRCode = @QRCode
                  AND Status <> 'Cancelled'
                ORDER BY RegistrationDate DESC;

                IF @RegistrationID IS NULL
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success, 'Invalid QR format. Use the student QR from the QR Code tab.' AS Message;
                    RETURN;
                END

                IF @EventID IS NOT NULL AND @MatchedEventID <> @EventID
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success, 'QR does not belong to selected event' AS Message;
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

        const legacyPayload = legacyResult.recordset?.[0];
        if (legacyPayload?.Success) {
            return res.json({ success: true, message: legacyPayload.Message });
        }

        return res.status(400).json({
            success: false,
            message: legacyPayload?.Message || 'Invalid QR format. Use the student QR from the QR Code tab.',
        });

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

// 2.1 DELETE Event (Organizer dashboard) - Changed to Soft Delete
// Requires authentication - organizer can only delete their own events
router.put('/events/:id', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!requesterId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const {
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

    const normalizeDate = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
    };

    const normalizeTime = (value) => {
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

    const parsedCapacity = Number(capacity);
    const normalizedTitle = String(title || '').trim();
    const normalizedType = String(eventType || '').trim();
    const normalizedDate = normalizeDate(eventDate);
    const normalizedTime = normalizeTime(eventTime);
    const normalizedVenue = String(venue || '').trim() || null;
    const normalizedDescription = description === undefined ? null : (String(description || '').trim() || null);
    const normalizedStatus = String(status || '').trim() || 'Draft';
    const normalizedPoster = String(posterURL || '').trim() || null;
    const normalizedDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

    if (!normalizedTitle || !normalizedType || !normalizedDate || !normalizedTime) {
        return res.status(400).json({
            success: false,
            message: 'title, eventType, eventDate and eventTime are required with valid values',
        });
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
        return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
    }
    if (!normalizedDeadline || Number.isNaN(normalizedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
    }
    if (normalizedPoster && normalizedPoster.length > 255) {
        return res.status(400).json({
            success: false,
            message: 'posterURL is too long (max 255 characters). Please use a shorter hosted URL.',
        });
    }

    if (normalizedDeadline.toISOString().slice(0, 10) > normalizedDate) {
        return res.status(400).json({ success: false, message: 'Registration deadline date cannot be after event date.' });
    }

    try {
        const pool = await poolPromise;

        const eventCheck = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT TOP 1 EventID, OrganizerID FROM Events WHERE EventID = @EventID');

        const event = eventCheck.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (requesterRole !== 'admin' && Number(event.OrganizerID) !== Number(requesterId)) {
            return res.status(403).json({ success: false, message: 'You can only edit your own events' });
        }

        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('Title', sql.NVarChar(200), normalizedTitle)
            .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
            .input('EventType', sql.NVarChar(20), normalizedType)
            .input('EventDate', sql.Date, normalizedDate)
            .input('EventTime', sql.NVarChar(20), normalizedTime)
            .input('Venue', sql.NVarChar(150), normalizedVenue)
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, normalizedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
            .query(`
                UPDATE Events
                SET
                    Title = @Title,
                    Description = @Description,
                    EventType = @EventType,
                    EventDate = @EventDate,
                    EventTime = CAST(@EventTime AS TIME),
                    Venue = @Venue,
                    Capacity = @Capacity,
                    RegistrationDeadline = @RegistrationDeadline,
                    Status = @Status,
                    PosterURL = @PosterURL,
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE EventID = @EventID;

                SELECT TOP 1 * FROM Events WHERE EventID = @EventID;
            `);

        return res.json({ success: true, event: result.recordset?.[0] || null });
    } catch (err) {
        console.error('Update Event Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to update event' });
    }
});

// 2.1c PUT Cancel Event (Organizer/Admin) - separate from delete
router.put('/events/:id/cancel', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;

    if (!requesterId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    try {
        const pool = await poolPromise;

        const eventCheck = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');

        const event = eventCheck.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own events' });
        }

        if (String(event.Status || '').toLowerCase() === 'cancelled') {
            return res.json({ success: true, message: 'Event is already cancelled' });
        }

        await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                UPDATE Events
                SET Status = 'Cancelled',
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE EventID = @EventID
            `);

        return res.json({ success: true, message: 'Event cancelled successfully' });
    } catch (err) {
        console.error('Cancel Event Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to cancel event' });
    }
});

// 2.1d PUT Restore Event (Organizer/Admin) - bring cancelled event back
router.put('/events/:id/restore', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;

    if (!requesterId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    try {
        const pool = await poolPromise;

        const eventCheck = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');

        const event = eventCheck.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) {
            return res.status(403).json({ success: false, message: 'You can only restore your own events' });
        }

        if (String(event.Status || '').toLowerCase() !== 'cancelled') {
            return res.json({ success: true, message: 'Event is already active' });
        }

        await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                UPDATE Events
                SET Status = 'Published',
                    UpdatedAt = SYSDATETIMEOFFSET()
                WHERE EventID = @EventID
            `);

        return res.json({ success: true, message: 'Event restored successfully' });
    } catch (err) {
        console.error('Restore Event Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to restore event' });
    }
});

router.delete('/events/:id', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const userId = req.user?.UserID;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    try {
        const pool = await poolPromise;

        // Check if event exists and belongs to the organizer
        const eventCheck = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT EventID, OrganizerID FROM Events WHERE EventID = @EventID');

        const event = eventCheck.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (req.user?.Role !== 'Admin' && event.OrganizerID !== userId) {
            return res.status(403).json({ success: false, message: 'You can only delete your own events' });
        }

        // Use SOFT DELETE: Set Status to 'Cancelled' instead of hard delete
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                UPDATE Events 
                SET Status = 'Cancelled', UpdatedAt = SYSDATETIMEOFFSET()
                WHERE EventID = @EventID
            `);

        if ((result.rowsAffected?.[0] || 0) === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        return res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
        console.error('Delete Event Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// 3. GET Profile (Updated to return LinkedIn/GitHub)
// Requires authentication - user can view any profile but data is limited
router.get('/profile/:id', authMiddleware, async (req, res) => {
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
// Requires authentication - user can only edit their own profile
router.put('/profile/:id', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const requestingUserId = req.user?.UserID;

    // User can only edit their own profile, except admin
    if (req.user?.Role !== 'Admin' && targetUserId !== requestingUserId) {
        return res.status(403).json({ success: false, message: 'You can only edit your own profile' });
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid user id is required' });
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

    const userId = targetUserId;

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
        console.error('Update Profile Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// 10. POST Event Request (Student submits event suggestion)
// Requires authentication
router.post('/events/request', authMiddleware, async (req, res) => {
    const userId = req.user?.UserID;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
        title,
        description,
        eventType,
        eventDate,
        eventTime,
        venue,
        capacity,
        registrationDeadline,
        posterURL,
    } = req.body;

    // Validate required fields
    if (!title) {
        return res.status(400).json({ success: false, message: 'Event title is required' });
    }

    if (!eventDate) {
        return res.status(400).json({ success: false, message: 'Event date is required' });
    }

    try {
        const pool = await poolPromise;
        const requestPayload = {
            title,
            description,
            eventType,
            eventDate,
            eventTime,
            venue,
            capacity,
            registrationDeadline,
            posterURL,
        };
        const requestPayloadString = `${REQUEST_PAYLOAD_PREFIX}${JSON.stringify(requestPayload)}`;

        // Insert event request into EventRequests table
        const insertResult = await pool.request()
            .input('StudentID', sql.Int, userId)
            .input('Title', sql.NVarChar(200), title)
            .input('Description', sql.NVarChar(sql.MAX), description || null)
            .input('SuggestedDate', sql.Date, eventDate)
            .input('AdminNotes', sql.NVarChar(sql.MAX), requestPayloadString)
            .query(`
                INSERT INTO EventRequests (StudentID, Title, Description, SuggestedDate, Status, SubmittedAt, AdminNotes)
                VALUES (@StudentID, @Title, @Description, @SuggestedDate, 'Pending', SYSDATETIMEOFFSET(), @AdminNotes);
                SELECT SCOPE_IDENTITY() AS RequestID
            `);

        const requestId = insertResult.recordset[0].RequestID;

        res.json({
            success: true,
            message: 'Event request submitted successfully',
            requestId,
            status: 'Pending',
        });
    } catch (err) {
        console.error('Submit Event Request Error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit event request' });
    }
});

// GET Student Event Requests (student/admin view)
// Reconciles legacy pending requests that already became events before status-update fixes.
router.get('/events/requests/:userId', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    if (requesterRole !== 'admin' && Number(requesterId) !== targetUserId) {
        return res.status(403).json({ success: false, message: 'You can only view your own requests' });
    }

    try {
        const pool = await poolPromise;

        // Legacy recovery: mark stale pending requests as approved when an event with same title/date exists.
        await pool.request()
            .input('StudentID', sql.Int, targetUserId)
            .query(`
                UPDATE er
                SET er.Status = 'Approved'
                FROM EventRequests er
                WHERE er.StudentID = @StudentID
                  AND er.Status = 'Pending'
                  AND EXISTS (
                      SELECT 1
                      FROM Events e
                      WHERE e.Title = er.Title
                        AND e.EventDate = er.SuggestedDate
                        AND e.Status IN ('Published', 'Draft', 'Completed')
                  )
            `);

        const result = await pool.request()
            .input('StudentID', sql.Int, targetUserId)
            .query(`
                SELECT
                    er.RequestID,
                    er.StudentID,
                    er.Title,
                    er.Description,
                    er.SuggestedDate,
                    er.Status,
                    er.SubmittedAt,
                    CASE
                        WHEN LEFT(COALESCE(er.AdminNotes, ''), 20) = '__REQUEST_PAYLOAD__:' THEN NULL
                        ELSE er.AdminNotes
                    END AS AdminNotes
                FROM EventRequests er
                WHERE er.StudentID = @StudentID
                ORDER BY er.SubmittedAt DESC
            `);

        return res.json(result.recordset || []);
    } catch (err) {
        console.error('Student Requests Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch requests' });
    }
});

// GET Registrations for a specific Event (Organizer side)
// Requires authentication - organizer can only view their own event registrations
router.get('/organizer/registrations/:eventId', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    if (!requesterId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const pool = await poolPromise;

        const eventResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1 EventID, OrganizerID
                FROM [dbo].[Events]
                WHERE EventID = @EventID
            `);

        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (requesterRole !== 'admin' && Number(eventRow.OrganizerID) !== Number(requesterId)) {
            return res.status(403).json({ success: false, message: 'You can only view registrations for your own events' });
        }

        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT
                    r.RegistrationID,
                    r.EventID,
                    r.UserID,
                    r.Status,
                    r.RegistrationDate,
                    r.CancelledAt,
                    u.Email,
                    sp.FirstName,
                    sp.LastName
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Users] u ON r.UserID = u.UserID
                LEFT JOIN [dbo].[StudentProfiles] sp ON r.UserID = sp.UserID
                WHERE r.EventID = @EventID
                ORDER BY r.RegistrationDate DESC
            `);

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch registrations' });
    }
});

module.exports = router;
```

### backend/server.js

```
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
const adminRoutes = require('./routes/admin'); // NEW: Import admin routes

// 3. IMPORT MIDDLEWARE
const { authMiddleware } = require('./middleware/auth');

const app = express();

// Middleware
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

// CORS Configuration - Restrict to allowed origins
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
};
app.use(cors(corsOptions));

// 3. REGISTER YOUR NEW ROUTES
app.use('/api/auth', authRoutes);           // All routes in auth.js will start with /api/auth
app.use('/api', dataRoutes);                // All routes in data.js will start with /api
app.use('/api/teams', authMiddleware, teamRoutes); // Teams require authentication
app.use('/api/admin', adminRoutes);         // Admin routes (auth required in admin.js)

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
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Malformed request payload. If you use browser extensions, disable request-modifying extensions and retry.',
        });
    }

    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: `Request payload too large. Reduce image size or set REQUEST_BODY_LIMIT (current ${requestBodyLimit}).`,
        });
    }
    return next(err);
});

const PORT = Number(process.env.API_PORT || process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
    console.log(`ðŸš€ Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
        console.error(`âŒ Port ${PORT} is already in use. Stop the existing backend process and retry.`);
        process.exit(1);
    }
    console.error('âŒ Server failed to start:', err);
    process.exit(1);
});
```

### backend/db.js

```
// db.js
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,             // Added process.env.
    password: process.env.DB_PASSWORD,     // Added process.env.
    server: process.env.DB_SERVER,         // Added process.env.
    database: process.env.DB_DATABASE,     // Added process.env.
    options: { 
        encrypt: false, 
        trustServerCertificate: true 
    },
    // DB port is separate from the Express app port.
    port: Number(process.env.DB_PORT) || 1433
};

// Create a connection pool and export it
const poolPromise = sql.connect(dbConfig)
    .then(async (pool) => {
        if (pool.connected) {
            console.log('âœ… Connected to SQL Server Successfully!');
            try {
                const info = await pool.request().query('SELECT DB_NAME() AS CurrentDatabase, @@SERVERNAME AS ServerName');
                const row = info.recordset?.[0] || {};
                console.log(`ðŸ§­ SQL Context -> Server: ${row.ServerName || dbConfig.server}, Database: ${row.CurrentDatabase || dbConfig.database}`);
            } catch (metaErr) {
                console.warn('âš ï¸ Connected, but could not read SQL context metadata.');
            }
        }
        return pool;
    })
    .catch(err => {
        console.error('âŒ Database Connection Failed!', err);
        process.exit(1); // Stop the server if the DB fails to connect
    });

module.exports = { sql, poolPromise };
```

### backend/package.json

```
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "migrate:passwords": "node scripts/migrate-passwords.js",
    "migrate:passwords:apply": "node scripts/migrate-passwords.js --apply",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "mssql": "^12.2.0"
  }
}

```

### frontend/app/attendanceO/page.js

```
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AttendanceOPage() {
  const search = useSearchParams();
  const preselectedEventId = search.get("eventId") || "";

  const userId = typeof window !== "undefined"
    ? (sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId") || "")
    : "";

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId);
  const [registrations, setRegistrations] = useState([]);
  const [qrCode, setQrCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingRegs, setIsLoadingRegs] = useState(false);
  const [message, setMessage] = useState("");
  const [isScannerSupported, setIsScannerSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setIsScannerSupported(
      typeof window !== "undefined"
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === "function"
    );

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const loadEvents = async () => {
      if (!Number.isInteger(Number(userId))) return;

      try {
        setIsLoadingEvents(true);
        setMessage("");
        const res = await fetch(`${API_BASE_URL}/api/events?organizerId=${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load events");

        const list = Array.isArray(data) ? data : [];
        setEvents(list);

        if (!selectedEventId && list.length > 0) {
          setSelectedEventId(String(list[0].EventID || list[0].eventId || ""));
        }
      } catch (err) {
        setEvents([]);
        setMessage(err?.message || "Could not load organizer events.");
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, [selectedEventId, userId]);

  useEffect(() => {
    const loadRegistrations = async () => {
      if (!selectedEventId || !Number.isInteger(Number(userId))) {
        setRegistrations([]);
        return;
      }

      try {
        setIsLoadingRegs(true);
        const res = await fetch(`${API_BASE_URL}/api/organizer/registrations/${encodeURIComponent(selectedEventId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load registrations");
        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        setRegistrations([]);
        setMessage(err?.message || "Could not load registrations.");
      } finally {
        setIsLoadingRegs(false);
      }
    };

    loadRegistrations();
  }, [selectedEventId, userId]);

  const selectedEventTitle = useMemo(() => {
    const row = events.find((e) => String(e.EventID || e.eventId) === String(selectedEventId));
    return row?.Title || row?.title || "Selected Event";
  }, [events, selectedEventId]);

  const handleCheckIn = async (overrideCode) => {
    const code = String(overrideCode || qrCode || "").trim();
    if (!code) {
      setMessage("Please enter/scan a QR code.");
      return;
    }

    if (!selectedEventId || !Number.isInteger(Number(selectedEventId))) {
      setMessage("Please select an event first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const userIdMatch = String(code).match(/EDUQR\s*:\s*(\d+)\s*:/i);
      const parsedQrUserId = Number(userIdMatch?.[1]);
      const qrUserIdParam = Number.isInteger(parsedQrUserId) && parsedQrUserId > 0
        ? `&qrUserId=${encodeURIComponent(parsedQrUserId)}`
        : "";
      const url = `${API_BASE_URL}/api/events/check-in?qrCode=${encodeURIComponent(code)}&eventId=${encodeURIComponent(Number(selectedEventId))}${qrUserIdParam}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-user-id": String(userId),
        },
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_err) {
        data = { message: raw || "Check-in failed" };
      }
      if (!res.ok) {
        throw new Error(data?.message || "Check-in failed");
      }

      setMessage(data?.message || "Attendance marked!");
      setQrCode("");

      // Refresh list so organizer sees updated statuses.
      if (selectedEventId) {
        const regRes = await fetch(`${API_BASE_URL}/api/organizer/registrations/${encodeURIComponent(selectedEventId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });
        const regData = await regRes.json().catch(() => []);
        if (regRes.ok) {
          setRegistrations(Array.isArray(regData) ? regData : []);
        }
      }
    } catch (err) {
      setMessage(err?.message || "Could not mark attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopScanning = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  };

  const startScanning = async () => {
    if (!isScannerSupported || isScanning) return;

    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();
      setIsScanning(true);

      const detectorSupported = typeof window !== "undefined" && "BarcodeDetector" in window;
      const detector = detectorSupported ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detectorSupported ? null : (await import("jsqr")).default;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (!video || !canvas || !ctx || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          let value = "";

          if (detector) {
            const codes = await detector.detect(canvas);
            value = codes?.[0]?.rawValue || "";
          } else if (jsQR) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imageData.data, imageData.width, imageData.height);
            value = decoded?.data || "";
          }

          if (value) {
            setQrCode(value);
            stopScanning();
            handleCheckIn(value);
            return;
          }
        } catch (_err) {
          // Keep scanning on detector errors.
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMessage(err?.message || "Camera could not be started for scanning.");
      stopScanning();
    }
  };

  return (
    <main className="min-h-screen shell">
      <div className="surface-card max-w-6xl mx-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Organizer Attendance</p>
            <h1 className="text-2xl font-extrabold text-slate-900">QR Check-In</h1>
          </div>
          <Link href="/dashboardO" className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="md:col-span-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface-soft)] p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-800">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
              disabled={isLoadingEvents}
            >
              {events.map((ev) => (
                <option key={ev.EventID || ev.eventId} value={String(ev.EventID || ev.eventId)}>
                  {ev.Title || ev.title}
                </option>
              ))}
            </select>
            {isLoadingEvents && <p className="mt-2 text-xs text-slate-500">Loading events...</p>}

            <div className="mt-4 rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Current Event</p>
              <p className="text-sm font-semibold text-slate-900">{selectedEventTitle}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Scan / Enter QR Code</label>
              <input
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheckIn();
                  }
                }}
                placeholder="Paste scanned QR token"
                className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
              />
              {isScannerSupported ? (
                <div className="mt-2 flex gap-2">
                  {!isScanning ? (
                    <button
                      type="button"
                      onClick={startScanning}
                      className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Start Camera Scan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopScanning}
                      className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Stop Scan
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Camera access is not supported on this browser. Use paste/manual input.</p>
              )}

              {isScanning && (
                <div className="mt-2 overflow-hidden rounded-lg border border-[var(--stroke)] bg-black">
                  <video ref={videoRef} className="h-48 w-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              <button
                onClick={handleCheckIn}
                disabled={isSubmitting || !qrCode.trim()}
                className="mt-2 w-full rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Checking in..." : "Mark Attendance"}
              </button>
            </div>

            {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
          </section>

          <section className="md:col-span-2 rounded-xl border border-[var(--stroke)] bg-white p-4">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Registrations Snapshot</h2>
            {isLoadingRegs ? (
              <p className="text-sm text-slate-600">Loading registrations...</p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-slate-600">No registrations found for this event.</p>
            ) : (
              <div className="overflow-auto rounded-md border border-[var(--stroke)]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((row) => {
                      const displayName = `${row.FirstName || ""} ${row.LastName || ""}`.trim() || "Student";
                      return (
                        <tr key={row.RegistrationID || `${row.UserID}-${row.EventID}`} className="border-b border-slate-100 last:border-none">
                          <td className="px-3 py-2">{displayName}</td>
                          <td className="px-3 py-2">{row.Email || "-"}</td>
                          <td className="px-3 py-2">{row.Status || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

```

### frontend/app/profileO/page.js

```
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ProfileO() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState("Organization Name");
  const [description, setDescription] = useState("Not set");
  const [contactEmail, setContactEmail] = useState("no-reply@organization.org");
  const [verification, setVerification] = useState("Pending");
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [isScannerSupported, setIsScannerSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  const readScopedValue = (key, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    if (currentUserId) {
      const scopedValue = localStorage.getItem(`${key}:${currentUserId}`);
      if (scopedValue !== null) return scopedValue;
      return fallback;
    }
    const legacyValue = localStorage.getItem(key);
    return legacyValue !== null ? legacyValue : fallback;
  };

  const writeScopedValue = (key, value) => {
    if (typeof window === "undefined" || !currentUserId) return;
    const storageKey = `${key}:${currentUserId}`;
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(value));
  };

  const resetFromScopedStorage = () => {
    setOrgName(readScopedValue("organizationName", "Organization Name"));
    setDescription(readScopedValue("organizationDescription", "Not set"));
    setContactEmail(readScopedValue("userEmail", "no-reply@organization.org"));
    setProfilePictureDataUrl(readScopedValue("profilePictureURL", ""));
  };

  useEffect(() => {
    const userId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId");
    setCurrentUserId(userId || "");

    const readInitial = (key, fallback = "") => {
      if (userId) {
        const scopedValue = localStorage.getItem(`${key}:${userId}`);
        if (scopedValue !== null) return scopedValue;
        return fallback;
      }
      const legacyValue = localStorage.getItem(key);
      return legacyValue !== null ? legacyValue : fallback;
    };

    const savedOrg = readInitial("organizationName", "Organization Name");
    const savedDesc = readInitial("organizationDescription", "Not set");
    const savedEmail = readInitial("userEmail", "no-reply@organization.org");
    const savedVer = readInitial("organizationVerificationStatus", "Pending");
    const savedPic = readInitial("profilePictureURL", "");

    if (savedOrg) setOrgName(savedOrg);
    if (savedDesc) setDescription(savedDesc);
    if (savedEmail) setContactEmail(savedEmail);
    if (savedVer) setVerification(savedVer);
    if (savedPic) setProfilePictureDataUrl(savedPic);

    const fetchProfile = async () => {
      if (!userId) return;
      try {
        setStatus("Loading profile...");
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(userId),
          },
        });
        const data = await res.json();
        if (!res.ok || !data) {
          throw new Error(data?.message || "Failed to load profile");
        }

        const nextName = data.OrganizationName || savedOrg || "Organization Name";
        const nextDesc = data.Description || savedDesc || "Not set";
        const nextEmail = data.ContactEmail || data.Email || savedEmail || "no-reply@organization.org";
        const nextVer = data.VerificationStatus || savedVer || "Pending";
        const nextPic = data.ProfilePictureURL || savedPic || "";

        setOrgName(nextName);
        setDescription(nextDesc);
        setContactEmail(nextEmail);
        setVerification(nextVer);
        setProfilePictureDataUrl(nextPic);

        localStorage.setItem(`organizationName:${userId}`, nextName);
        localStorage.setItem(`organizationDescription:${userId}`, nextDesc);
        localStorage.setItem(`userEmail:${userId}`, nextEmail);
        localStorage.setItem(`organizationVerificationStatus:${userId}`, nextVer);
        localStorage.setItem(`displayName:${userId}`, nextName);
        localStorage.setItem(`profilePictureURL:${userId}`, nextPic);

        sessionStorage.setItem("displayName", nextName);
        sessionStorage.setItem("userEmail", nextEmail);
        localStorage.setItem("organizationName", nextName);
        localStorage.setItem("userEmail", nextEmail);
        localStorage.setItem("displayName", nextName);
        localStorage.setItem("profilePictureURL", nextPic);
        setStatus("");
      } catch (err) {
        setStatus(err.message || "Could not fetch profile from server");
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    setIsScannerSupported(
      typeof window !== "undefined"
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === "function"
    );

    const loadOrganizerEvents = async () => {
      if (!currentUserId || !Number.isInteger(Number(currentUserId))) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/events?organizerId=${encodeURIComponent(currentUserId)}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Failed to load events");
        const list = Array.isArray(data) ? data : [];
        setEvents(list);
        if (!selectedEventId && list.length > 0) {
          setSelectedEventId(String(list[0].EventID || list[0].eventId || ""));
        }
      } catch (_err) {
        setEvents([]);
      }
    };

    loadOrganizerEvents();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [currentUserId, selectedEventId]);

  const handleProfilePicture = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result.toString();
      setProfilePictureDataUrl(url);
      writeScopedValue("profilePictureURL", url);
      localStorage.setItem("profilePictureURL", url);
    };
    reader.readAsDataURL(file);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const stopScanning = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const submitCheckIn = async (overrideCode) => {
    const code = String(overrideCode || qrCodeInput || "").trim();
    if (!code) {
      setScanStatus("Please enter or scan a QR code.");
      return;
    }

    if (!selectedEventId || !Number.isInteger(Number(selectedEventId))) {
      setScanStatus("Please select an event first.");
      return;
    }

    try {
      setIsCheckingIn(true);
      setScanStatus("");
      const userIdMatch = String(code).match(/EDUQR\s*:\s*(\d+)\s*:/i);
      const parsedQrUserId = Number(userIdMatch?.[1]);
      const qrUserIdParam = Number.isInteger(parsedQrUserId) && parsedQrUserId > 0
        ? `&qrUserId=${encodeURIComponent(parsedQrUserId)}`
        : "";
      const url = `${API_BASE_URL}/api/events/check-in?qrCode=${encodeURIComponent(code)}&eventId=${encodeURIComponent(Number(selectedEventId))}${qrUserIdParam}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-user-id": String(currentUserId || ""),
        },
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_err) {
        data = { message: raw || "Check-in failed" };
      }
      if (!res.ok) throw new Error(data?.message || "Check-in failed");
      setScanStatus(data?.message || "Attendance marked!");
      setQrCodeInput("");
    } catch (err) {
      setScanStatus(err?.message || "Could not mark attendance.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const startScanning = async () => {
    if (!isScannerSupported || isScanning) return;

    try {
      setScanStatus("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setIsScanning(true);

      const detectorSupported = typeof window !== "undefined" && "BarcodeDetector" in window;
      const detector = detectorSupported ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detectorSupported ? null : (await import("jsqr")).default;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (!video || !canvas || !ctx || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          let value = "";

          if (detector) {
            const found = await detector.detect(canvas);
            value = found?.[0]?.rawValue || "";
          } else if (jsQR) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imageData.data, imageData.width, imageData.height);
            value = decoded?.data || "";
          }

          if (value) {
            setQrCodeInput(value);
            stopScanning();
            submitCheckIn(value);
            return;
          }
        } catch (_err) {
          // continue scanning
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setScanStatus(err?.message || "Camera could not be started.");
      stopScanning();
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell max-w-5xl mx-auto">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6 flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Organization Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Home</Link>
            <Link href="/dashboardO" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
          </div>
        </header>

        <section className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center text-xl text-slate-600">
                  {profilePictureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePictureDataUrl} alt="Organization" className="h-full w-full object-cover" />
                  ) : (
                    orgName.charAt(0) || "O"
                  )}
                </div>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={!isEditing}
                  className="absolute -right-1 -bottom-1 bg-white border rounded-full p-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Change profile picture"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H4z" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} className="hidden" />
              </div>
              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Organization Name</div>
                <div className="flex-1">
                  <input disabled={!isEditing} value={orgName} onChange={(e) => setOrgName(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Description</div>
                <div className="flex-1">
                  <textarea disabled={!isEditing} value={description === "Not set" ? "" : description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500" rows={4} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Contact Email</div>
                <div className="flex-1">
                  <input
                    disabled={!isEditing}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="rounded-xl border border-[var(--stroke)] px-3 py-2 w-full disabled:bg-slate-50 disabled:text-slate-500"
                    type="email"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-44 text-sm font-medium text-slate-700">Verification</div>
                <div className="flex-1">
                  <div className="text-sm text-slate-800">{verification}</div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--stroke)] bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Quick QR Attendance Scanner</p>
                  <Link href="/attendanceO" className="text-xs font-semibold text-[var(--brand)] hover:underline">Open Full Attendance Page</Link>
                </div>

                <label className="mb-1 block text-xs text-slate-600">Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
                >
                  {events.map((ev) => (
                    <option key={ev.EventID || ev.eventId} value={String(ev.EventID || ev.eventId)}>
                      {ev.Title || ev.title}
                    </option>
                  ))}
                </select>

                <label className="mt-3 mb-1 block text-xs text-slate-600">QR Code</label>
                <input
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCheckIn();
                    }
                  }}
                  placeholder="Paste or scan QR token"
                  className="w-full rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  {isScannerSupported ? (
                    !isScanning ? (
                      <button type="button" onClick={startScanning} className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Start Camera Scan
                      </button>
                    ) : (
                      <button type="button" onClick={stopScanning} className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                        Stop Scan
                      </button>
                    )
                  ) : (
                    <p className="text-xs text-slate-500">Camera access unsupported on this browser; use manual input.</p>
                  )}

                  <button
                    type="button"
                    onClick={() => submitCheckIn()}
                    disabled={isCheckingIn || !qrCodeInput.trim()}
                    className="rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isCheckingIn ? "Checking in..." : "Mark Attendance"}
                  </button>
                </div>

                {isScanning && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-[var(--stroke)] bg-black">
                    <video ref={videoRef} className="h-44 w-full object-cover" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                {scanStatus && <p className="mt-2 text-sm text-slate-700">{scanStatus}</p>}
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2 font-semibold">Edit Profile</button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                    localStorage.setItem("organizationName", orgName);
                    sessionStorage.setItem("displayName", orgName);
                    sessionStorage.setItem("userEmail", contactEmail);
                    localStorage.setItem("userEmail", contactEmail);
                    localStorage.setItem("displayName", orgName);
                    writeScopedValue("organizationName", orgName);
                    writeScopedValue("organizationDescription", description);
                    writeScopedValue("userEmail", contactEmail);
                    writeScopedValue("organizationVerificationStatus", verification);
                    writeScopedValue("displayName", orgName);
                    writeScopedValue("profilePictureURL", profilePictureDataUrl || "");

                    const userId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId");
                    if (!userId) {
                      alert("Organization profile saved locally. Please login again to sync backend.");
                      return;
                    }

                    try {
                      setStatus("Saving profile...");
                      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          "x-user-id": String(userId),
                        },
                        body: JSON.stringify({
                          role: "organizer",
                          organizationName: orgName,
                          description: description === "Not set" ? null : description,
                          contactEmail: contactEmail || null,
                          profilePictureURL: profilePictureDataUrl || null,
                        }),
                      });

                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        throw new Error(body.message || "Failed to save profile");
                      }

                      setStatus("Profile saved successfully.");
                      setIsEditing(false);
                    } catch (err) {
                      setStatus(err.message || "Profile save failed");
                    }
                  }}
                  className="cta px-4 py-2 font-semibold"
                >
                  Save Profile
                </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFromScopedStorage();
                      setIsEditing(false);
                      setStatus("");
                    }}
                    className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]"
                  >
                    Cancel Edit
                  </button>
                )}
                <Link href="/dashboardO" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>
              {status && <p className="text-sm text-slate-700">{status}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
```

### frontend/app/qr-code/page.js

```
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function StudentQrCodePage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("userID") || sessionStorage.getItem("userId") || localStorage.getItem("userID") || localStorage.getItem("userId") || "";
    const storedEmail = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    setUserId(storedUserId);
    setEmail(storedEmail);

    const loadQrToken = async () => {
      try {
        setIsLoading(true);
        setStatus("");

        let resolvedUserId = Number(storedUserId);

        if (!Number.isInteger(resolvedUserId) || resolvedUserId <= 0) {
          if (!storedEmail) {
            setStatus("Could not resolve your account. Please log in again.");
            return;
          }

          const userRes = await fetch(`${API_BASE_URL}/api/users?email=${encodeURIComponent(storedEmail)}`);
          const userData = await userRes.json().catch(() => ({}));
          if (!userRes.ok) throw new Error(userData?.message || "Could not resolve user from email");

          const candidate = Number(userData?.userId || userData?.id);
          if (!Number.isInteger(candidate) || candidate <= 0) {
            throw new Error("Could not resolve valid user ID");
          }

          resolvedUserId = candidate;
          setUserId(String(candidate));
          sessionStorage.setItem("userID", String(candidate));
          localStorage.setItem("userID", String(candidate));
        }

        const qrRes = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(resolvedUserId)}/qr-token`);
        const qrData = await qrRes.json().catch(() => ({}));
        if (!qrRes.ok) throw new Error(qrData?.message || "Failed to load QR token");

        const token = String(qrData?.qrToken || "").trim();
        if (!token) throw new Error("QR token is empty");
        setQrToken(token);
      } catch (err) {
        setQrToken("");
        setStatus(err?.message || "Failed to load QR code.");
      } finally {
        setIsLoading(false);
      }
    };

    loadQrToken();
  }, []);

  const qrImageUrl = useMemo(() => {
    if (!qrToken) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrToken)}`;
  }, [qrToken]);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell mx-auto max-w-3xl">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-strong)]">Student QR</p>
            <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">QR Code</h1>
            {email && <p className="mt-2 text-sm text-slate-600">{email}</p>}
          </div>
          <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
            Back to Dashboard
          </Link>
        </header>

        <section className="glass reveal-up rounded-2xl p-6 md:p-8">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading your QR code...</p>
          ) : !qrToken ? (
            <p className="text-sm text-slate-700">{status || "QR code is not available right now."}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Use this single QR code for attendance. Organizer selects an event, scans this code, and marks your check-in for that event.
              </p>

              <div className="rounded-xl border border-[var(--stroke)] bg-white p-4 flex flex-col sm:flex-row gap-4 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt="Your student QR code"
                  className="h-[220px] w-[220px] rounded-lg border border-[var(--stroke)] bg-white"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Raw QR Value</p>
                  <p className="mt-1 break-all rounded-lg bg-[var(--surface-soft)] p-3 text-xs text-slate-700">{qrToken}</p>

                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(qrToken)}
                    className="mt-3 rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Copy Raw QR
                  </button>
                </div>
              </div>
            </div>
          )}

          {status && qrToken && <p className="mt-3 text-sm text-slate-700">{status}</p>}
        </section>
      </div>
    </main>
  );
}

```

### frontend/app/profile/page.js

```
"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function FieldRow({ label, value, editable = true, children }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex-1">
        {editable ? children : <div className="text-sm text-slate-800">{value || <span className="text-slate-400">Not set</span>}</div>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [linkA, setLinkA] = useState('');
  const [linkB, setLinkB] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [status, setStatus] = useState('');

  const readScopedValue = (key, fallback = '') => {
    if (typeof window === 'undefined') return fallback;

    if (currentUserId) {
      const scopedValue = localStorage.getItem(`${key}:${currentUserId}`);
      if (scopedValue !== null) return scopedValue;
      return fallback;
    }

    const legacyValue = localStorage.getItem(key);
    return legacyValue !== null ? legacyValue : fallback;
  };

  const writeScopedValue = (key, value) => {
    if (typeof window === 'undefined' || !currentUserId) return;
    const storageKey = `${key}:${currentUserId}`;
    if (value === null || value === undefined || value === '') {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, String(value));
  };

  const fileInputRef = useRef(null);

  useEffect(() => {
    const userId = sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId');
    setCurrentUserId(userId || '');

    const readInitial = (key, fallback = '') => {
      if (userId) {
        const scopedValue = localStorage.getItem(`${key}:${userId}`);
        if (scopedValue !== null) return scopedValue;
        return fallback;
      }
      const legacyValue = localStorage.getItem(key);
      return legacyValue !== null ? legacyValue : fallback;
    };

    const savedName = readInitial('displayName');
    const savedEmail = readInitial('userEmail', 'no-reply@university.edu');
    const savedPic = readInitial('profilePictureURL');
    const savedId = readInitial('studentId') || userId;
    const savedDob = readInitial('dateOfBirth');
    const savedInstitution = readInitial('institution', 'FAST NUCES');
    const savedLinkA = readInitial('linkA');
    const savedLinkB = readInitial('linkB');

    setName(savedName || 'Your Name');
    setEmail(savedEmail || 'no-reply@university.edu');
    setProfilePictureDataUrl(savedPic || '');
    setStudentId(savedId || '000000');
    setDob(savedDob || '');
    setInstitution(savedInstitution || 'FAST NUCES');
    setLinkA(savedLinkA || '');
    setLinkB(savedLinkB || '');

    const fetchProfile = async () => {
      if (!userId) return;
      try {
        setStatus('Loading profile...');
        const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`);
        const data = await res.json();

        if (!res.ok || !data) {
          throw new Error(data?.message || 'Failed to load profile');
        }

        const fullName = [data.FirstName, data.LastName].filter(Boolean).join(' ').trim();
        const resolvedName = fullName || savedName || 'Your Name';
        const resolvedEmail = data.Email || savedEmail || 'no-reply@university.edu';
        const resolvedPic = data.ProfilePictureURL || savedPic || '';
        const resolvedInstitution = data.Department || savedInstitution || 'FAST NUCES';
        const resolvedStudentId = String(data.UserID || userId);
        const resolvedDob = toDateInputValue(data.DateOfBirth) || savedDob || '';
        const resolvedLinkedIn = data.LinkedInURL || savedLinkA || '';
        const resolvedGitHub = data.GitHubURL || savedLinkB || '';

        setName(resolvedName);
        setEmail(resolvedEmail);
        setProfilePictureDataUrl(resolvedPic);
        setInstitution(resolvedInstitution);
        setStudentId(resolvedStudentId);
        setDob(resolvedDob);
        setLinkA(resolvedLinkedIn);
        setLinkB(resolvedGitHub);

        localStorage.setItem(`displayName:${userId}`, resolvedName);
        localStorage.setItem(`userEmail:${userId}`, resolvedEmail);
        localStorage.setItem(`profilePictureURL:${userId}`, resolvedPic);
        localStorage.setItem(`institution:${userId}`, resolvedInstitution);
        localStorage.setItem(`studentId:${userId}`, resolvedStudentId);
        localStorage.setItem(`dateOfBirth:${userId}`, resolvedDob);
        localStorage.setItem(`linkA:${userId}`, resolvedLinkedIn);
        localStorage.setItem(`linkB:${userId}`, resolvedGitHub);

        sessionStorage.setItem('displayName', resolvedName);
        sessionStorage.setItem('userEmail', resolvedEmail);
        localStorage.setItem('displayName', resolvedName);
        localStorage.setItem('userEmail', resolvedEmail);
        localStorage.setItem('profilePictureURL', resolvedPic);

        setStatus('');
      } catch (err) {
        setStatus(err.message || 'Could not fetch profile from server');
      }
    };

    fetchProfile();
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleProfilePicture = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result.toString();
      setProfilePictureDataUrl(url);
      writeScopedValue('profilePictureURL', url);
    };
    reader.readAsDataURL(file);
  };

  const resetFromScopedStorage = () => {
    setName(readScopedValue('displayName', 'Your Name'));
    setDob(readScopedValue('dateOfBirth', ''));
    setInstitution(readScopedValue('institution', 'FAST NUCES'));
    setLinkA(readScopedValue('linkA', ''));
    setLinkB(readScopedValue('linkB', ''));
    setProfilePictureDataUrl(readScopedValue('profilePictureURL', ''));
  };

  const handleFullSave = async (e) => {
    e.preventDefault();
    const userId = sessionStorage.getItem('userID') || sessionStorage.getItem('userId') || localStorage.getItem('userID') || localStorage.getItem('userId');
    sessionStorage.setItem('displayName', name);
    if (email) sessionStorage.setItem('userEmail', email);
    localStorage.setItem('displayName', name);
    if (email) localStorage.setItem('userEmail', email);
    writeScopedValue('displayName', name);
    writeScopedValue('dateOfBirth', dob || '');
    writeScopedValue('institution', institution || '');
    writeScopedValue('linkA', linkA || '');
    writeScopedValue('linkB', linkB || '');
    writeScopedValue('profilePictureURL', profilePictureDataUrl || '');

    if (!userId) {
      alert('Profile saved locally. Please login again to sync with backend.');
      return;
    }

    try {
      setStatus('Saving profile...');
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'N/A';
      const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          firstName: firstName || null,
          lastName,
          department: institution || null,
          year: null,
          dateOfBirth: dob || null,
          linkedInURL: linkA || null,
          gitHubURL: linkB || null,
          profilePictureURL: profilePictureDataUrl || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save profile');
      }

      setStatus('Profile saved successfully.');
      setIsEditing(false);
    } catch (err) {
      setStatus(err.message || 'Profile save failed');
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="shell max-w-5xl mx-auto">
        <header className="glass reveal-up rounded-2xl p-5 md:p-7 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Your Profile</h1>
            </div>
            <Link href="/dashboard" className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">Back to Dashboard</Link>
          </div>
        </header>

        <form onSubmit={handleFullSave} className="glass reveal-up w-full rounded-2xl p-6 md:p-8">
          {status && <p className="mb-4 rounded-lg bg-[var(--surface-soft)] p-2 text-sm text-slate-700">{status}</p>}
          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-start">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-32 w-32 rounded-full overflow-hidden bg-[var(--surface-soft)] flex items-center justify-center">
                  {profilePictureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePictureDataUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-slate-600">{(name && name.charAt(0)) || 'P'}</span>
                  )}
                </div>

                <button type="button" onClick={openFilePicker} disabled={!isEditing} className="absolute -right-1 -bottom-1 bg-white border rounded-full p-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60" aria-label="Change profile picture">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8.414A2 2 0 0016.414 7L13 3.586A2 2 0 0011.586 3H4z" />
                  </svg>
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleProfilePicture(e.target.files?.[0])} className="hidden" />
              </div>

              <div className="mt-3 text-center text-sm text-slate-600">Profile Picture</div>
            </div>

            <div className="space-y-4">
              <FieldRow label="Name:" value={name} editable>
                <input disabled={!isEditing} className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={name} onChange={(e) => setName(e.target.value)} />
              </FieldRow>

              <FieldRow label="ID:" value={studentId} editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Date of Birth:" value={dob ? new Date(dob).toLocaleDateString() : ''} editable>
                <input disabled={!isEditing} type="date" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 disabled:bg-slate-50 disabled:text-slate-500" value={dob} onChange={(e) => setDob(e.target.value)} />
              </FieldRow>

              <FieldRow label="E-mail:" value={email} editable={false}>
                {/* non-editable */}
              </FieldRow>

              <FieldRow label="Department:" value={institution} editable>
                <input disabled={!isEditing} className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </FieldRow>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">Link Tree (optional)</div>
                <div className="space-y-2">
                  <FieldRow label="LinkedIn:" value={linkA} editable>
                    <input disabled={!isEditing} placeholder="LinkedIn URL" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={linkA} onChange={(e) => setLinkA(e.target.value)} />
                  </FieldRow>

                  <FieldRow label="GitHub:" value={linkB} editable>
                    <input disabled={!isEditing} placeholder="GitHub URL" className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 w-full disabled:bg-slate-50 disabled:text-slate-500" value={linkB} onChange={(e) => setLinkB(e.target.value)} />
                  </FieldRow>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="cta px-4 py-2 font-semibold">Edit Profile</button>
                ) : (
                  <>
                    <button type="submit" className="cta px-4 py-2 font-semibold">Save Profile</button>
                    <button
                      type="button"
                      onClick={() => {
                        resetFromScopedStorage();
                        setIsEditing(false);
                        setStatus('');
                      }}
                      className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]"
                    >
                      Cancel Edit
                    </button>
                  </>
                )}
                <Link href="/" className="rounded-md px-4 py-2 border border-[var(--stroke)] bg-white text-sm font-semibold hover:bg-[var(--surface-soft)]">Cancel</Link>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--stroke)] bg-white p-4">
                <h3 className="text-base font-bold text-slate-900">Attendance QR</h3>
                <p className="mt-2 text-sm text-slate-600">Use your single QR from the QR Code tab in dashboard for all event check-ins.</p>
                <Link href="/qr-code" className="mt-3 inline-block rounded border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-soft)]">
                  Open QR Code Page
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

```

### frontend/app/layout.js

```
import "./globals.css";
import { Manrope, Sora } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata = {
  title: "EventDhundo | Campus Discovery",
  description: "Centralized campus event discovery platform",
  icons: {
    icon: '/Logo.png',
    shortcut: '/Logo.png',
    apple: '/Logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${manrope.variable} ${sora.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

### frontend/package.json

```
{
  "name": "event_dhoondo_f",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "chart.js": "^4.5.1",
    "chartjs-adapter-date-fns": "^3.0.0",
    "jsqr": "^1.4.0",
    "lucide-react": "^0.577.0",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-chartjs-2": "^5.3.1",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4"
  }
}

```

### package.json

```
{
  "scripts": {
    "start": "node server.js",
    "start:backend": "node backend/server.js",
    "start:frontend": "npm --prefix frontend run dev"
  },
  "dependencies": {
    "express": "^5.2.1"
  }
}

```

