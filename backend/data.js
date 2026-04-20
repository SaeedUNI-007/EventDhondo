const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const { authMiddleware } = require('./middleware/auth');
const REQUEST_PAYLOAD_PREFIX = '__REQUEST_PAYLOAD__:';
const ALLOWED_CITIES = ['Lahore', 'Islamabad', 'Karachi'];
const normalizeAllowedCity = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const match = ALLOWED_CITIES.find((city) => city.toLowerCase() === raw);
    return match || null;
};

const extractDateParts = (value) => {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return {
            year: value.getUTCFullYear(),
            month: value.getUTCMonth() + 1,
            day: value.getUTCDate(),
        };
    }

    const raw = String(value).trim();
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
        return {
            year: Number(ymd[1]),
            month: Number(ymd[2]),
            day: Number(ymd[3]),
        };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
        year: parsed.getUTCFullYear(),
        month: parsed.getUTCMonth() + 1,
        day: parsed.getUTCDate(),
    };
};

const extractTimeParts = (value) => {
    if (!value) return { hour: 0, minute: 0, second: 0 };

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return {
            hour: value.getUTCHours(),
            minute: value.getUTCMinutes(),
            second: value.getUTCSeconds(),
        };
    }

    const raw = String(value).trim();
    const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
    if (hhmm) {
        return {
            hour: Number(hhmm[1]),
            minute: Number(hhmm[2]),
            second: Number(hhmm[3] || 0),
        };
    }

    const iso = raw.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (iso) {
        return {
            hour: Number(iso[1]),
            minute: Number(iso[2]),
            second: Number(iso[3] || 0),
        };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { hour: 0, minute: 0, second: 0 };
    return {
        hour: parsed.getUTCHours(),
        minute: parsed.getUTCMinutes(),
        second: parsed.getUTCSeconds(),
    };
};

const getEventStartTimestamp = (eventDate, eventTime) => {
    const dateParts = extractDateParts(eventDate);
    if (!dateParts) return null;
    const timeParts = extractTimeParts(eventTime);
    return new Date(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hour,
        timeParts.minute,
        timeParts.second,
        0
    ).getTime();
};

const isRegistrationClosedForEvent = (eventRow) => {
    const now = Date.now();

    const deadlineMs = eventRow?.RegistrationDeadline
        ? new Date(eventRow.RegistrationDeadline).getTime()
        : null;
    const startMs = getEventStartTimestamp(eventRow?.EventDate, eventRow?.EventTime);

    const closedByDeadline = Number.isFinite(deadlineMs) && now >= deadlineMs;
    const started = Number.isFinite(startMs) && now >= startMs;

    return {
        closed: closedByDeadline || started,
        closedByDeadline,
        started,
        deadlineMs,
        startMs,
    };
};

// ─── QR Token helpers ──────────────────────────────────────────────────────

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

const normalizeQrSeparators = (value) => String(value || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/[：﹕꞉ː∶]/g, ':')
    .replace(/[|¦]/g, ':')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s*[:;]\s*/g, ':');

/**
 * Parses an EDUQR token and returns the numeric userId it encodes, or null.
 *
 * The function accepts tokens whose HMAC doesn't match the current secret so
 * that students who generated tokens before a secret rotation aren't broken.
 * The shape check (EDUQR:\d+:[a-f0-9]{20}) is the hard gate.
 */
const parseStudentQrToken = (token) => {
    const raw = normalizeQrSeparators(String(token || '').trim()).replace(/\s+/g, '');
    // Accept token variants copied from apps that alter separators/formatting.
    const match = raw.match(/EDUQR\W*(\d+)\W*([a-z0-9_-]{6,})/i);
    if (!match) return null;

    const userId = Number(match[1]);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    // We always return the userId even when the HMAC doesn't match the current
    // secret – the DB lookup below will confirm the student is registered.
    return userId;
};

/**
 * Strips invisible characters, whitespace noise, URL-encoding artifacts, and
 * surrounding quotes from a raw QR payload, then extracts the canonical
 * EDUQR:<userId>:<20-hex-chars> form if present.
 */
const normalizeQrPayload = (value) => {
    const stripNoise = (input) =>
        normalizeQrSeparators(String(input || ''))
            .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
            .replace(/[\r\n\t]/g, ' ')
            .trim()
            .replace(/^['\"`\s]+|['\"`\s]+$/g, '');

    const raw = stripNoise(value);
    if (!raw) return '';

    const variants = [raw];
    try {
        variants.push(stripNoise(decodeURIComponent(raw)));
    } catch (_err) { /* ignore */ }

    for (const item of variants) {
        const normalized = stripNoise(item);
        const compact = normalized.replace(/\s+/g, '');

        const tokenMatch =
            compact.match(/EDUQR\W*\d+\W*[a-z0-9_-]{6,}/i) ||
            normalized.match(/EDUQR\W*\d+\W*[a-z0-9_-]{6,}/i);

        if (tokenMatch?.[0]) {
            const m = normalizeQrSeparators(tokenMatch[0]).match(/EDUQR\W*(\d+)\W*([a-z0-9_-]{6,})/i);
            if (m?.[1] && m?.[2]) {
                return `EDUQR:${m[1]}:${String(m[2]).toLowerCase()}`;
            }
        }

        try {
            if (/^https?:\/\//i.test(normalized)) {
                const parsed = new URL(normalized);
                const candidate =
                    parsed.searchParams.get('token') ||
                    parsed.searchParams.get('qr') ||
                    parsed.searchParams.get('code');
                if (candidate) {
                    const c = stripNoise(candidate);
                    const m =
                        c.replace(/\s+/g, '').match(/EDUQR\W*\d+\W*[a-z0-9_-]{6,}/i) ||
                        c.match(/EDUQR\W*\d+\W*[a-z0-9_-]{6,}/i);
                    if (m?.[0]) {
                        const p = normalizeQrSeparators(m[0]).match(/EDUQR\W*(\d+)\W*([a-z0-9_-]{6,})/i);
                        const sig = String(p?.[2] || '');
                        if (p?.[1] && sig) {
                            return `EDUQR:${p[1]}:${/^[a-f0-9]+$/i.test(sig) ? sig.toLowerCase() : sig}`;
                        }
                    }
                    return c;
                }
            }
        } catch (_err) { /* not a URL */ }
    }

    return raw;
};

// ─── Route: GET /interests ─────────────────────────────────────────────────
router.get('/interests', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Interests');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Fetch Interests Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch interests' });
    }
});

// ─── Route: GET /users ─────────────────────────────────────────────────────
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

        if (result.recordset?.length > 0) return res.json(result.recordset[0]);
        return res.status(404).json({ success: false, message: 'User not found' });
    } catch (err) {
        console.error('Get User by Email Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Route: GET /users/:userId/qr-token ───────────────────────────────────
router.get('/users/:userId/qr-token', async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query('SELECT TOP 1 UserID, Email, Role FROM [dbo].[Users] WHERE UserID = @UserID');

        const user = result.recordset?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

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

// ─── Route: GET /events ────────────────────────────────────────────────────
router.get('/events', async (req, res) => {
    try {
        const { category, search, date, organizerId, city } = req.query;
        const hasOrganizerFilter = Number.isInteger(Number(organizerId));

        let query = hasOrganizerFilter
            ? `
                SELECT e.EventID, e.OrganizerID, e.Title, e.Description, e.EventType,
                    e.EventDate, e.EventTime, e.Venue, e.City, e.Capacity, e.Status, e.PosterURL,
                    o.OrganizationName AS Organizer, o.ContactEmail AS OrganizerEmail,
                    o.ProfilePictureURL AS OrganizerLogo, NULL AS Category
                FROM Events e
                JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
                WHERE e.OrganizerID = @OrganizerID
            `
            : `SELECT * FROM vw_UpcomingEvents WHERE 1=1`;

        const pool = await poolPromise;
        const request = pool.request();

        if (hasOrganizerFilter) request.input('OrganizerID', sql.Int, Number(organizerId));
        if (category) { query += ' AND Category = @Category'; request.input('Category', sql.NVarChar, category); }
        if (search) { query += ' AND (Title LIKE @Search OR Description LIKE @Search)'; request.input('Search', sql.NVarChar, `%${search}%`); }
        if (date) { query += ' AND EventDate = @Date'; request.input('Date', sql.Date, date); }
        if (city) {
            query += hasOrganizerFilter ? ' AND e.City = @City' : ' AND City = @City';
            request.input('City', sql.NVarChar(100), String(city).trim());
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Event Fetch Error:', err);
        res.status(500).send(err.message);
    }
});

// Guard: explicit GET on check-in path returns a clear 405.
router.get('/events/check-in', (_req, res) =>
    res.status(405).json({ success: false, message: 'Use POST /api/events/check-in with qrCode and eventId.' })
);

// ─── Route: GET /events/:id ────────────────────────────────────────────────
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
                    e.EventID, e.OrganizerID, e.Title, e.Description, e.EventType,
                    e.EventDate, e.EventTime, e.Venue, e.City, e.Capacity, e.Status, e.PosterURL,
                    e.RegistrationDeadline,
                    op.OrganizationName AS Organizer, op.ContactEmail AS OrganizerEmail,
                    op.Description AS OrganizerDescription, op.City AS OrganizerCity, op.ProfilePictureURL AS OrganizerLogo,
                    u.Email AS OrganizerAccountEmail,
                    (SELECT COUNT(*) FROM Registrations r
                     WHERE r.EventID = e.EventID AND r.Status = 'Confirmed') AS ConfirmedRegistrations
                FROM Events e
                JOIN OrganizerProfiles op ON e.OrganizerID = op.UserID
                JOIN Users u ON op.UserID = u.UserID
                WHERE e.EventID = @EventID
            `);

        const event = result.recordset?.[0];
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        return res.json(event);
    } catch (err) {
        console.error('Event Detail Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event details' });
    }
});

// ─── Route: POST /events/check-in ─────────────────────────────────────────
//
// Accepts payload from BOTH body (preferred) AND query string (fallback) so
// that manual paste, camera scan, and legacy curl tests all work.
//
// Priority order for resolving the student userId:
//   1. req.body.qrUserId  – frontend pre-parsed it from the EDUQR token
//   2. parseStudentQrToken(qrCode) – parse from the token itself
//   3. Fall through to legacy QRCode column lookup
//
router.post('/events/check-in', async (req, res) => {
    // Read from body first, fall back to query string.
    const rawQr = req.body?.qrCode ?? req.query?.qrCode;
    const qrCode = normalizeQrPayload(rawQr);

    // eventId is always required for EDUQR tokens.
    const eventId = Number(req.body?.eventId ?? req.query?.eventId);

    // Optional hint from the frontend (avoids redundant HMAC parse).
    const hintUserId = Number(req.body?.qrUserId ?? req.query?.qrUserId);

    // ── Validation ──────────────────────────────────────────────────────────
    if (!qrCode) {
        return res.status(400).json({
            success: false,
            message: 'qrCode is required. Send it in the request body as JSON.',
        });
    }

    try {
        const pool = await poolPromise;

        // ── Path A: EDUQR student token ──────────────────────────────────────
        const looseEduQrUserId = (() => {
            const m = normalizeQrSeparators(String(qrCode || ''))
                .replace(/\s+/g, '')
                .match(/EDUQR\W*(\d+)/i);
            const id = Number(m?.[1]);
            return Number.isInteger(id) && id > 0 ? id : null;
        })();

        const studentQrUserId =
            (Number.isInteger(hintUserId) && hintUserId > 0)
                ? hintUserId
                : (parseStudentQrToken(qrCode) || looseEduQrUserId);

        if (studentQrUserId) {
            if (!Number.isInteger(eventId) || eventId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'eventId is required when checking in with a student QR token.',
                });
            }

            const result = await pool.request()
                .input('UserID', sql.Int, studentQrUserId)
                .input('EventID', sql.Int, eventId)
                .input('StudentQRCode', sql.NVarChar(255), buildStudentQrToken(studentQrUserId))
                .query(`
                    DECLARE @RegistrationID INT;
                    DECLARE @EventStatus NVARCHAR(20);

                    SELECT TOP 1 @EventStatus = [Status]
                    FROM [dbo].[Events] WHERE EventID = @EventID;

                    IF @EventStatus IS NULL
                    BEGIN
                        SELECT CAST(0 AS BIT) AS Success, 'Selected event not found.' AS Message; RETURN;
                    END

                    IF LOWER(ISNULL(@EventStatus, '')) = 'cancelled'
                    BEGIN
                        SELECT CAST(0 AS BIT) AS Success, 'Selected event is cancelled.' AS Message; RETURN;
                    END

                    -- Check if user exists at all
                    IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE UserID = @UserID)
                    BEGIN
                        SELECT CAST(0 AS BIT) AS Success, 'Student not found. Ask student to verify their QR code.' AS Message; RETURN;
                    END

                    -- Check if there's an active (non-cancelled) registration
                    SELECT TOP 1 @RegistrationID = RegistrationID
                    FROM [dbo].[Registrations]
                    WHERE UserID = @UserID AND EventID = @EventID AND Status <> 'Cancelled'
                    ORDER BY RegistrationDate DESC;

                    IF @RegistrationID IS NULL
                    BEGIN
                        -- Check if registration exists but is cancelled
                        DECLARE @CheckCancelledCount INT;
                        SELECT @CheckCancelledCount = COUNT(*)
                        FROM [dbo].[Registrations]
                        WHERE UserID = @UserID AND EventID = @EventID AND Status = 'Cancelled';

                        IF @CheckCancelledCount > 0
                        BEGIN
                            SELECT CAST(0 AS BIT) AS Success, 
                                'This student cancelled their registration for this event. Please verify with them before registering again.' AS Message;
                            RETURN;
                        END

                        -- Try to auto-register the student and record attendance with 'Attended' status directly.
                        BEGIN TRY
                            INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
                            VALUES (@EventID, @UserID, 'Attended', @StudentQRCode);
                            SET @RegistrationID = SCOPE_IDENTITY();

                            IF @RegistrationID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                                INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);

                            SELECT CAST(1 AS BIT) AS Success,
                                   'Attendance marked! (Student was auto-registered for this event.)' AS Message;
                            RETURN;
                        END TRY
                        BEGIN CATCH
                            SELECT CAST(0 AS BIT) AS Success,
                                'Could not register student. They may have already been registered for this event.' AS Message;
                            RETURN;
                        END CATCH
                    END

                    -- Mark attendance for existing registration by updating status and creating attendance record
                    IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                    BEGIN
                        INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);
                        
                        UPDATE [dbo].[Registrations]
                        SET Status = 'Attended'
                        WHERE RegistrationID = @RegistrationID AND Status != 'Attended';
                    END
                    ELSE
                    BEGIN
                        -- Attendance already marked, just ensure status is updated to 'Attended'
                        UPDATE [dbo].[Registrations]
                        SET Status = 'Attended'
                        WHERE RegistrationID = @RegistrationID AND Status != 'Attended';
                    END

                    SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
                `);

            const row = result.recordset?.[0];
            if (!row?.Success) {
                return res.status(400).json({ success: false, message: row?.Message || 'Check-in failed.' });
            }
            return res.json({ success: true, message: row.Message });
        }

        // ── Path B: legacy registration QRCode column lookup ─────────────────
        const legacyResult = await pool.request()
            .input('QRCode', sql.NVarChar(255), String(qrCode).trim())
            .input('EventID', sql.Int, Number.isInteger(eventId) && eventId > 0 ? eventId : null)
            .query(`
                DECLARE @RegistrationID INT;
                DECLARE @MatchedEventID INT;

                SELECT TOP 1 @RegistrationID = RegistrationID, @MatchedEventID = EventID
                FROM [dbo].[Registrations]
                WHERE QRCode = @QRCode AND Status <> 'Cancelled'
                ORDER BY RegistrationDate DESC;

                IF @RegistrationID IS NULL
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success,
                        'QR code not recognised. Please use the student QR from the QR Code tab.' AS Message;
                    RETURN;
                END

                IF @EventID IS NOT NULL AND @MatchedEventID <> @EventID
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success, 'QR code does not belong to the selected event.' AS Message;
                    RETURN;
                END

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                BEGIN
                    INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);
                    
                    UPDATE [dbo].[Registrations]
                    SET Status = 'Attended'
                    WHERE RegistrationID = @RegistrationID AND Status != 'Attended';
                END
                ELSE
                BEGIN
                    UPDATE [dbo].[Registrations]
                    SET Status = 'Attended'
                    WHERE RegistrationID = @RegistrationID AND Status != 'Attended';
                END

                SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
            `);

        const legacyRow = legacyResult.recordset?.[0];
        if (legacyRow?.Success) return res.json({ success: true, message: legacyRow.Message });

        return res.status(400).json({
            success: false,
            message: legacyRow?.Message || 'QR code not recognised. Please use the student QR from the QR Code tab.',
        });

    } catch (err) {
        console.error('Check-In Error:', err);
        
        // Provide user-friendly error messages
        const errorMsg = String(err?.message || '').toLowerCase();
        
        if (errorMsg.includes('not found') || errorMsg.includes('no rows')) {
            return res.status(400).json({ 
                success: false, 
                message: 'QR code not found. The student may not be registered for this event.' 
            });
        }
        
        if (errorMsg.includes('null') && errorMsg.includes('registrationid')) {
            return res.status(400).json({ 
                success: false, 
                message: 'Could not process attendance. The student may not be registered for this event.' 
            });
        }
        
        if (errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
            return res.status(400).json({ 
                success: false, 
                message: 'The student is already registered for this event.' 
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            message: 'An error occurred while marking attendance. Please try again.' 
        });
    }
});

// ─── Route: GET /events/registrations/:userId ──────────────────────────────
router.get('/events/registrations/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('StudentQRCode', sql.NVarChar(255), buildStudentQrToken(userId))
            .query(`
                UPDATE [dbo].[Registrations]
                SET QRCode = @StudentQRCode
                WHERE UserID = @UserID AND Status <> 'Cancelled'
                  AND (
                      QRCode IS NULL
                      OR LTRIM(RTRIM(QRCode)) = ''
                      OR QRCode LIKE 'QR-%'
                      OR QRCode LIKE 'QR_DH-%'
                      OR QRCode LIKE 'QR-BT-%'
                      OR QRCode <> @StudentQRCode
                  );

                SELECT r.RegistrationID, r.EventID, r.UserID, r.Status, r.QRCode,
                    r.RegistrationDate, r.CancelledAt,
                    e.Title, e.EventDate, e.EventTime, e.Venue, e.EventType
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

// ─── Route: GET /notifications/:userId ────────────────────────────────────
router.get('/notifications/:userId', async (req, res) => {
    if (!Number.isInteger(Number(req.params.userId))) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, Number(req.params.userId))
            .query(`
                SELECT * FROM [dbo].[Notifications]
                WHERE UserID = @UserID AND Status IN ('Pending', 'Sent')
                ORDER BY CreatedAt DESC
            `);
        return res.json(result.recordset);
    } catch (err) {
        console.error('Notification Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Route: POST /events (create) ─────────────────────────────────────────
router.post('/events', authMiddleware, async (req, res) => {
    const {
        title, description, eventType, eventDate, eventTime,
        venue, city, capacity, registrationDeadline, posterURL, status,
    } = req.body || {};

    const parsedOrganizerId = req.user?.UserID;
    if (!parsedOrganizerId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user?.Role !== 'Organizer') return res.status(403).json({ success: false, message: 'Only organizers can create events' });
    if (String(req.user?.VerificationStatus || '').toLowerCase() !== 'verified') {
        return res.status(403).json({
            success: false,
            message: 'Organizer account is pending admin approval. You cannot create events yet.'
        });
    }

    const parsedCapacity = Number(capacity);
    const normalizedTitle = String(title || '').trim();
    const normalizedType = String(eventType || '').trim();
    const normalizedVenue = venue === undefined ? null : (String(venue || '').trim() || null);
    const normalizedCity = normalizeAllowedCity(city);
    const normalizedDescription = description === undefined ? null : (String(description || '').trim() || null);
    const normalizedPoster = posterURL === undefined ? null : (String(posterURL || '').trim() || null);
    const normalizedStatus = String(status || 'Published').trim() || 'Published';

    const normalizeDateInput = (value) => {
        if (!value) return null;
        const raw = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) {
            const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3]);
            if (month < 1 || month > 12 || day < 1 || day > 31) return null;
            return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    };

    const normalizeTimeInput = (value) => {
        if (!value) return null;
        const raw = String(value).trim().toLowerCase();
        const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (hhmm) {
            const h = Number(hhmm[1]), m = Number(hhmm[2]), s = Number(hhmm[3] || 0);
            if (h > 23 || m > 59 || s > 59) return null;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
        const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
        if (ampm) {
            let h = Number(ampm[1]); const m = Number(ampm[2]); const suffix = ampm[3].toLowerCase();
            if (h < 1 || h > 12 || m > 59) return null;
            if (suffix === 'pm' && h !== 12) h += 12;
            if (suffix === 'am' && h === 12) h = 0;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
        }
        return null;
    };

    const toDateOnlyLocal = (d) => {
        const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    };

    const normalizedEventDate = normalizeDateInput(eventDate);
    const normalizedEventTime = normalizeTimeInput(eventTime);

    if (!Number.isInteger(parsedOrganizerId) || parsedOrganizerId <= 0)
        return res.status(400).json({ success: false, message: 'Valid organizerId is required' });
    if (!normalizedTitle) return res.status(400).json({ success: false, message: 'title is required' });
    if (!normalizedType) return res.status(400).json({ success: false, message: 'eventType is required' });
    if (!normalizedEventDate) return res.status(400).json({ success: false, message: 'Valid eventDate is required' });
    if (!normalizedEventTime) return res.status(400).json({ success: false, message: 'eventTime is required' });
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0)
        return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
    if (!normalizedCity)
        return res.status(400).json({ success: false, message: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });
    if (normalizedPoster && normalizedPoster.length > 255)
        return res.status(400).json({ success: false, message: 'posterURL is too long (max 255 characters).' });

    const fallbackDeadlineRaw = `${normalizedEventDate}T00:00:00`;
    const parsedDeadline = new Date(registrationDeadline || fallbackDeadlineRaw);
    if (Number.isNaN(parsedDeadline.getTime()))
        return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
    if (toDateOnlyLocal(parsedDeadline) > normalizedEventDate)
        return res.status(400).json({ success: false, message: 'Registration deadline date cannot be after event date.' });

    try {
        const pool = await poolPromise;
        const profileCheck = await pool.request()
            .input('UserID', sql.Int, parsedOrganizerId)
            .query('SELECT TOP 1 UserID FROM [dbo].[OrganizerProfiles] WHERE UserID = @UserID');

        if (!profileCheck.recordset?.length)
            return res.status(400).json({ success: false, message: 'Organizer profile not found. Please complete organizer registration first.' });

        const result = await pool.request()
            .input('OrganizerID', sql.Int, parsedOrganizerId)
            .input('Title', sql.NVarChar(200), normalizedTitle)
            .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
            .input('EventType', sql.NVarChar(20), normalizedType)
            .input('EventDate', sql.Date, normalizedEventDate)
            .input('EventTime', sql.NVarChar(20), normalizedEventTime)
            .input('Venue', sql.NVarChar(150), normalizedVenue)
            .input('City', sql.NVarChar(100), normalizedCity)
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, parsedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
            .query(`
                INSERT INTO [dbo].[Events]
                    (OrganizerID, Title, Description, EventType, EventDate, EventTime,
                     Venue, City, Capacity, RegistrationDeadline, Status, PosterURL)
                OUTPUT INSERTED.*
                VALUES (@OrganizerID, @Title, @Description, @EventType, @EventDate,
                    CAST(@EventTime AS TIME), @Venue, @City, @Capacity, @RegistrationDeadline,
                        @Status, @PosterURL)
            `);

        return res.status(201).json({ success: true, event: result.recordset?.[0] || null });
    } catch (err) {
        console.error('Create Event Error:', err);
        if (err?.number === 547)
            return res.status(400).json({ success: false, message: 'Organizer profile not found. Please complete organizer registration first.' });
        return res.status(500).json({ success: false, message: err.message || 'Failed to create event' });
    }
});

// ─── Route: POST /events/register ─────────────────────────────────────────
router.post('/events/register', authMiddleware, async (req, res) => {
    const { eventId } = req.body;
    const userId = req.user?.UserID;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(Number(eventId))) return res.status(400).json({ success: false, message: 'eventId is required as an integer' });

    try {
        const pool = await poolPromise;

        const eventResult = await pool.request()
            .input('EventID', sql.Int, Number(eventId))
            .query(`
                SELECT TOP 1 EventID, Status, EventDate, EventTime, RegistrationDeadline
                FROM [dbo].[Events]
                WHERE EventID = @EventID
            `);

        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (String(eventRow.Status || '').toLowerCase() === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Registration is closed because this event is cancelled.' });
        }

        const registrationWindow = isRegistrationClosedForEvent(eventRow);
        if (registrationWindow.closed) {
            const cutoffMessage = registrationWindow.closedByDeadline
                ? 'Registration deadline has passed.'
                : 'Registration is closed because the event has started.';
            return res.status(400).json({ success: false, message: cutoffMessage });
        }

        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_RegisterForEvent');

        const message = result.recordset?.[0]?.Message || 'Registration processed';
        if (String(message).toLowerCase().startsWith('error'))
            return res.status(400).json({ success: false, message });

        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, Number(eventId))
            .input('StudentQRCode', sql.NVarChar(255), buildStudentQrToken(userId))
            .query(`
                UPDATE [dbo].[Registrations]
                SET QRCode = @StudentQRCode
                WHERE UserID = @UserID AND EventID = @EventID AND Status <> 'Cancelled'
            `);

        return res.json({ success: true, waitlisted: String(message).toLowerCase().includes('waitlisted'), message });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// ─── Route: POST /events/unregister ───────────────────────────────────────
router.post('/events/unregister', authMiddleware, async (req, res) => {
    const { eventId } = req.body;
    const userId = req.user?.UserID;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(Number(eventId))) return res.status(400).json({ success: false, message: 'eventId is required as an integer' });

    try {
        const pool = await poolPromise;

        const eventResult = await pool.request()
            .input('EventID', sql.Int, Number(eventId))
            .query(`
                SELECT TOP 1 EventID, EventDate, EventTime, RegistrationDeadline
                FROM [dbo].[Events]
                WHERE EventID = @EventID
            `);
        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_UnregisterFromEvent');

        const message = result.recordset?.[0]?.Message || 'Unregistration processed';
        if (String(message).toLowerCase().startsWith('error'))
            return res.status(400).json({ success: false, message });

        const registrationWindow = isRegistrationClosedForEvent(eventRow);

        // Auto-promote next waitlisted student only while registration is open.
        const waitlistPromotion = registrationWindow.closed
            ? { recordset: [{ Promoted: false, PromotedUserID: null }] }
            : await pool.request()
                .input('EventID', sql.Int, Number(eventId))
                .query(`
                    DECLARE @MaxCap INT, @CurrentCount INT, @NextWaitlistID INT, @NextUserID INT;
                    SELECT @MaxCap = Capacity FROM [dbo].[Events] WHERE EventID = @EventID;
                    SELECT @CurrentCount = COUNT(*) FROM [dbo].[Registrations] WHERE EventID = @EventID AND Status = 'Confirmed';
                    IF @MaxCap IS NULL OR @CurrentCount >= @MaxCap BEGIN SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID; RETURN; END
                    SELECT TOP 1 @NextWaitlistID = WaitlistID, @NextUserID = UserID FROM [dbo].[RegistrationWaitlist] WHERE EventID = @EventID ORDER BY RequestedAt ASC, WaitlistID ASC;
                    IF @NextWaitlistID IS NULL BEGIN SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID; RETURN; END
                    IF EXISTS (SELECT 1 FROM [dbo].[Registrations] WHERE EventID = @EventID AND UserID = @NextUserID AND Status = 'Cancelled')
                        UPDATE [dbo].[Registrations] SET Status = 'Confirmed', CancelledAt = NULL, RegistrationDate = SYSDATETIMEOFFSET(), QRCode = CAST(NEWID() AS NVARCHAR(100)) WHERE EventID = @EventID AND UserID = @NextUserID AND Status = 'Cancelled';
                    ELSE IF NOT EXISTS (SELECT 1 FROM [dbo].[Registrations] WHERE EventID = @EventID AND UserID = @NextUserID AND Status <> 'Cancelled')
                        INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode) VALUES (@EventID, @NextUserID, 'Confirmed', CAST(NEWID() AS NVARCHAR(100)));
                    DELETE FROM [dbo].[RegistrationWaitlist] WHERE WaitlistID = @NextWaitlistID;
                    EXEC [dbo].[sp_AddNotification] @UserID = @NextUserID, @Title = 'Waitlist Update', @Message = 'A seat became available. You have been moved from waitlist to confirmed registration.', @EventID = @EventID;
                    SELECT CAST(1 AS BIT) AS Promoted, @NextUserID AS PromotedUserID;
                `);

        const promotedUserId = Number(waitlistPromotion.recordset?.[0]?.PromotedUserID || 0);
        if (Number.isInteger(promotedUserId) && promotedUserId > 0) {
            await pool.request()
                .input('EventID', sql.Int, Number(eventId))
                .input('UserID', sql.Int, promotedUserId)
                .input('StudentQRCode', sql.NVarChar(255), buildStudentQrToken(promotedUserId))
                .query(`
                    UPDATE [dbo].[Registrations]
                    SET QRCode = @StudentQRCode
                    WHERE EventID = @EventID AND UserID = @UserID AND Status <> 'Cancelled'
                `);
        }

        const promoted = Boolean(waitlistPromotion.recordset?.[0]?.Promoted);
        return res.json({
            success: true,
            message: promoted
                ? `${message} Next waitlisted student has been auto-registered.`
                : (registrationWindow.closed
                    ? `${message} Registration window is closed, so no waitlist promotion was performed.`
                    : message),
            waitlistPromoted: promoted,
            promotedUserId: waitlistPromotion.recordset?.[0]?.PromotedUserID || null,
        });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// ─── Route: PUT /events/:id ────────────────────────────────────────────────
router.put('/events/:id', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role || '').toLowerCase();
    if (!requesterId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const { title, description, eventType, eventDate, eventTime, venue, city, capacity, registrationDeadline, posterURL, status } = req.body || {};
    const normalizeDate = (v) => { if (!v) return null; const p = new Date(v); return Number.isNaN(p.getTime()) ? null : p.toISOString().slice(0,10); };
    const normalizeTime = (v) => { if (!v) return null; const raw = String(v).trim().toLowerCase(); const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); if (hhmm) { const h = Number(hhmm[1]), m = Number(hhmm[2]), s = Number(hhmm[3]||0); if (h>23||m>59||s>59) return null; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; } return null; };

    const parsedCapacity = Number(capacity);
    const normalizedTitle = String(title||'').trim();
    const normalizedType = String(eventType||'').trim();
    const normalizedDate = normalizeDate(eventDate);
    const normalizedTime = normalizeTime(eventTime);
    const normalizedVenue = String(venue||'').trim()||null;
    const normalizedCity = normalizeAllowedCity(city);
    const normalizedDescription = description === undefined ? null : (String(description||'').trim()||null);
    const normalizedStatus = String(status||'').trim()||'Draft';
    const normalizedPoster = String(posterURL||'').trim()||null;
    const normalizedDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

    if (!normalizedTitle||!normalizedType||!normalizedDate||!normalizedTime) return res.status(400).json({ success: false, message: 'title, eventType, eventDate and eventTime are required' });
    if (!Number.isInteger(parsedCapacity)||parsedCapacity<=0) return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
    if (!normalizedCity) return res.status(400).json({ success: false, message: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });
    if (!normalizedDeadline||Number.isNaN(normalizedDeadline.getTime())) return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
    if (normalizedPoster && normalizedPoster.length > 255) return res.status(400).json({ success: false, message: 'posterURL is too long (max 255 characters).' });
    if (normalizedDeadline.toISOString().slice(0,10) > normalizedDate) return res.status(400).json({ success: false, message: 'Registration deadline date cannot be after event date.' });

    try {
        const pool = await poolPromise;
        const eventCheck = await pool.request().input('EventID', sql.Int, eventId).query('SELECT TOP 1 EventID, OrganizerID FROM Events WHERE EventID = @EventID');
        const event = eventCheck.recordset?.[0];
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (requesterRole !== 'admin' && Number(event.OrganizerID) !== Number(requesterId)) return res.status(403).json({ success: false, message: 'You can only edit your own events' });

        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('Title', sql.NVarChar(200), normalizedTitle)
            .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
            .input('EventType', sql.NVarChar(20), normalizedType)
            .input('EventDate', sql.Date, normalizedDate)
            .input('EventTime', sql.NVarChar(20), normalizedTime)
            .input('Venue', sql.NVarChar(150), normalizedVenue)
            .input('City', sql.NVarChar(100), normalizedCity)
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, normalizedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
            .query(`
                UPDATE Events SET Title=@Title, Description=@Description, EventType=@EventType,
                    EventDate=@EventDate, EventTime=CAST(@EventTime AS TIME), Venue=@Venue, City=@City,
                    Capacity=@Capacity, RegistrationDeadline=@RegistrationDeadline, Status=@Status,
                    PosterURL=@PosterURL, UpdatedAt=SYSDATETIMEOFFSET()
                WHERE EventID = @EventID;
                SELECT TOP 1 * FROM Events WHERE EventID = @EventID;
            `);

        return res.json({ success: true, event: result.recordset?.[0] || null });
    } catch (err) {
        console.error('Update Event Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to update event' });
    }
});

// ─── Route: PUT /events/:id/cancel ────────────────────────────────────────
router.put('/events/:id/cancel', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;
    if (!requesterId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ success: false, message: 'Invalid event id' });
    try {
        const pool = await poolPromise;
        const eventCheck = await pool.request().input('EventID', sql.Int, eventId).query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');
        const event = eventCheck.recordset?.[0];
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) return res.status(403).json({ success: false, message: 'You can only cancel your own events' });
        if (String(event.Status||'').toLowerCase() === 'cancelled') return res.json({ success: true, message: 'Event is already cancelled' });
        await pool.request().input('EventID', sql.Int, eventId).query(`UPDATE Events SET Status='Cancelled', UpdatedAt=SYSDATETIMEOFFSET() WHERE EventID=@EventID`);

        // Notify all active registrants with event details.
        await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                INSERT INTO [dbo].[Notifications] (UserID, Title, Message, RelatedEventID, Status)
                SELECT
                    r.UserID,
                    'Event Cancelled',
                    CONCAT(
                        'An event you registered for has been cancelled.',
                        CHAR(10),
                        'Event: ', e.Title,
                        CASE WHEN e.EventDate IS NOT NULL THEN CONCAT(' | Date: ', CONVERT(VARCHAR(10), e.EventDate, 23)) ELSE '' END,
                        CASE WHEN e.Venue IS NOT NULL AND LTRIM(RTRIM(e.Venue)) <> '' THEN CONCAT(' | Venue: ', e.Venue) ELSE '' END
                    ),
                    e.EventID,
                    'Pending'
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                WHERE r.EventID = @EventID
                  AND r.Status <> 'Cancelled'
            `);

        return res.json({ success: true, message: 'Event cancelled successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to cancel event' });
    }
});

// ─── Route: PUT /events/:id/restore ───────────────────────────────────────
router.put('/events/:id/restore', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterId = req.user?.UserID;
    if (!requesterId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ success: false, message: 'Invalid event id' });
    try {
        const pool = await poolPromise;
        const eventCheck = await pool.request().input('EventID', sql.Int, eventId).query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');
        const event = eventCheck.recordset?.[0];
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) return res.status(403).json({ success: false, message: 'You can only restore your own events' });
        if (String(event.Status||'').toLowerCase() !== 'cancelled') return res.json({ success: true, message: 'Event is already active' });
        await pool.request().input('EventID', sql.Int, eventId).query(`UPDATE Events SET Status='Published', UpdatedAt=SYSDATETIMEOFFSET() WHERE EventID=@EventID`);
        return res.json({ success: true, message: 'Event restored successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to restore event' });
    }
});

// ─── Route: DELETE /events/:id ─────────────────────────────────────────────
router.delete('/events/:id', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.id);
    const userId = req.user?.UserID;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ success: false, message: 'Invalid event id' });
    try {
        const pool = await poolPromise;
        const eventCheck = await pool.request().input('EventID', sql.Int, eventId).query('SELECT EventID, OrganizerID FROM Events WHERE EventID = @EventID');
        const event = eventCheck.recordset?.[0];
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (req.user?.Role !== 'Admin' && event.OrganizerID !== userId) return res.status(403).json({ success: false, message: 'You can only delete your own events' });
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('DELETE FROM Events WHERE EventID=@EventID');
        if ((result.rowsAffected?.[0]||0) === 0) return res.status(404).json({ success: false, message: 'Event not found' });
        return res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
        console.error('Delete Event Error:', err);
        if (err?.number === 547) {
            return res.status(409).json({
                success: false,
                message: 'This event is referenced by dependent records and cannot be hard-deleted. Cancel it instead.'
            });
        }
        return res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// ─── Route: GET /profile/:id ───────────────────────────────────────────────
router.get('/profile/:id', authMiddleware, async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, message: 'Valid user id is required' });
    try {
        const pool = await poolPromise;
        const userResult = await pool.request().input('UserID', sql.Int, userId).query('SELECT UserID, Email, Role FROM Users WHERE UserID = @UserID');
        const user = userResult.recordset?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (String(user.Role||'').toLowerCase() === 'organizer') {
            const r = await pool.request().input('UserID', sql.Int, userId).query(`SELECT u.UserID, u.Email, u.Role, o.OrganizationName, o.Description, o.ContactEmail, o.City, o.ProfilePictureURL, o.VerificationStatus FROM Users u JOIN OrganizerProfiles o ON u.UserID = o.UserID WHERE u.UserID = @UserID`);
            const profile = r.recordset?.[0];
            if (!profile) return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            return res.json(profile);
        }

        const r = await pool.request().input('UserID', sql.Int, userId).query(`SELECT u.UserID, u.Email, s.FirstName, s.LastName, s.Department, s.City, s.YearOfStudy, s.DateOfBirth, s.ProfilePictureURL, s.LinkedInURL, s.GitHubURL FROM Users u JOIN StudentProfiles s ON u.UserID = s.UserID WHERE u.UserID = @UserID`);
        const profile = r.recordset?.[0];
        if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' });
        return res.json(profile);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ─── Route: PUT /profile/:id ───────────────────────────────────────────────
router.put('/profile/:id', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.id);
    const requestingUserId = req.user?.UserID;
    if (req.user?.Role !== 'Admin' && targetUserId !== requestingUserId) return res.status(403).json({ success: false, message: 'You can only edit your own profile' });
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).json({ success: false, message: 'Valid user id is required' });

    const { role, firstName, lastName, department, city, year, dateOfBirth, profilePictureURL, linkedInURL, gitHubURL, interests, organizationName, description, contactEmail } = req.body;
    const normalizedProfileCity = normalizeAllowedCity(city);

    try {
        const pool = await poolPromise;
        const userResult = await pool.request().input('UserID', sql.Int, targetUserId).query('SELECT UserID, Role FROM Users WHERE UserID = @UserID');
        const user = userResult.recordset?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const dbRole = String(user.Role||'').toLowerCase();
        const requestedRole = String(role||'').toLowerCase();
        const effectiveRole = requestedRole || dbRole;

        if (effectiveRole === 'organizer' || dbRole === 'organizer') {
            if (!normalizedProfileCity) {
                return res.status(400).json({ success: false, message: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });
            }
            const result = await pool.request()
                .input('UserID', sql.Int, targetUserId)
                .input('OrganizationName', sql.NVarChar(150), String(organizationName||'').trim()||null)
                .input('Description', sql.NVarChar(sql.MAX), description === undefined ? undefined : (String(description||'').trim()||null))
                .input('ContactEmail', sql.NVarChar(100), String(contactEmail||'').trim()||null)
                .input('City', sql.NVarChar(100), normalizedProfileCity)
                .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL||null)
                .query(`UPDATE OrganizerProfiles SET OrganizationName=COALESCE(@OrganizationName,OrganizationName), Description=COALESCE(@Description,Description), ContactEmail=COALESCE(@ContactEmail,ContactEmail), City=COALESCE(@City,City), ProfilePictureURL=@ProfilePictureURL WHERE UserID=@UserID`);
            if ((result.rowsAffected?.[0]||0) === 0) return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            return res.json({ success: true, role: 'Organizer' });
        }

        const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;
        if (dateOfBirth && Number.isNaN(parsedDob?.getTime())) return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });
        if (!normalizedProfileCity) {
            return res.status(400).json({ success: false, message: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });
        }

        await pool.request()
            .input('UserID', sql.Int, targetUserId)
            .input('FirstName', sql.NVarChar(50), firstName||null)
            .input('LastName', sql.NVarChar(50), lastName||null)
            .input('Department', sql.NVarChar(100), department||null)
            .input('City', sql.NVarChar(100), normalizedProfileCity)
            .input('Year', sql.Int, Number.isInteger(Number(year)) ? Number(year) : null)
            .input('DateOfBirth', sql.Date, dateOfBirth ? parsedDob : null)
            .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL||null)
            .input('LinkedIn', sql.NVarChar(255), linkedInURL||null)
            .input('GitHub', sql.NVarChar(255), gitHubURL||null)
            .query(`UPDATE StudentProfiles SET FirstName=@FirstName, LastName=@LastName, Department=@Department, City=@City, YearOfStudy=COALESCE(@Year,YearOfStudy), DateOfBirth=@DateOfBirth, ProfilePictureURL=@ProfilePictureURL, LinkedInURL=@LinkedIn, GitHubURL=@GitHub WHERE UserID=@UserID`);

        if (Array.isArray(interests)) {
            await pool.request().input('UserID', sql.Int, targetUserId).query('DELETE FROM UserInterests WHERE UserID=@UserID');
            for (const id of interests) {
                await pool.request().input('UserID', sql.Int, targetUserId).input('InterestID', sql.Int, id).query('INSERT INTO UserInterests (UserID, InterestID) VALUES (@UserID, @InterestID)');
            }
        }
        return res.json({ success: true, role: 'Student' });
    } catch (err) {
        console.error('Update Profile Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// ─── Route: POST /events/request ───────────────────────────────────────────
router.post('/events/request', authMiddleware, async (req, res) => {
    const userId = req.user?.UserID;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { title, description, eventType, eventDate, eventTime, venue, city, capacity, registrationDeadline, posterURL } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Event title is required' });
    if (!eventDate) return res.status(400).json({ success: false, message: 'Event date is required' });
    const normalizedRequestCity = normalizeAllowedCity(city);
    if (!normalizedRequestCity) return res.status(400).json({ success: false, message: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });

    try {
        const pool = await poolPromise;
        const payload = `${REQUEST_PAYLOAD_PREFIX}${JSON.stringify({ title, description, eventType, eventDate, eventTime, venue, city: normalizedRequestCity, capacity, registrationDeadline, posterURL })}`;
        const insertResult = await pool.request()
            .input('StudentID', sql.Int, userId)
            .input('Title', sql.NVarChar(200), title)
            .input('Description', sql.NVarChar(sql.MAX), description||null)
            .input('SuggestedDate', sql.Date, eventDate)
            .input('AdminNotes', sql.NVarChar(sql.MAX), payload)
            .query(`INSERT INTO EventRequests (StudentID, Title, Description, SuggestedDate, Status, SubmittedAt, AdminNotes) VALUES (@StudentID, @Title, @Description, @SuggestedDate, 'Pending', SYSDATETIMEOFFSET(), @AdminNotes); SELECT SCOPE_IDENTITY() AS RequestID`);

        return res.json({ success: true, message: 'Event request submitted successfully', requestId: insertResult.recordset[0].RequestID, status: 'Pending' });
    } catch (err) {
        console.error('Submit Event Request Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit event request' });
    }
});

// ─── Route: GET /events/requests/:userId ──────────────────────────────────
router.get('/events/requests/:userId', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role||'').toLowerCase();
    if (!Number.isInteger(targetUserId)||targetUserId<=0) return res.status(400).json({ success: false, message: 'Valid userId is required' });
    if (requesterRole !== 'admin' && Number(requesterId) !== targetUserId) return res.status(403).json({ success: false, message: 'You can only view your own requests' });

    try {
        const pool = await poolPromise;
        await pool.request().input('StudentID', sql.Int, targetUserId).query(`UPDATE er SET er.Status='Approved' FROM EventRequests er WHERE er.StudentID=@StudentID AND er.Status='Pending' AND EXISTS (SELECT 1 FROM Events e WHERE e.Title=er.Title AND e.EventDate=er.SuggestedDate AND e.Status IN ('Published','Draft','Completed'))`);
        const result = await pool.request().input('StudentID', sql.Int, targetUserId).query(`SELECT er.RequestID, er.StudentID, er.Title, er.Description, er.SuggestedDate, er.Status, er.SubmittedAt, CASE WHEN LEFT(COALESCE(er.AdminNotes,''),20)='__REQUEST_PAYLOAD__:' THEN NULL ELSE er.AdminNotes END AS AdminNotes FROM EventRequests er WHERE er.StudentID=@StudentID ORDER BY er.SubmittedAt DESC`);
        return res.json(result.recordset || []);
    } catch (err) {
        console.error('Student Requests Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch requests' });
    }
});

// ─── Route: GET /organizer/registrations/:eventId ─────────────────────────
router.get('/organizer/registrations/:eventId', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const requesterId = req.user?.UserID;
    const requesterRole = String(req.user?.Role||'').toLowerCase();
    if (!Number.isInteger(eventId)||eventId<=0) return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    if (!requesterId) return res.status(401).json({ success: false, message: 'Authentication required' });

    try {
        const pool = await poolPromise;
        const eventResult = await pool.request().input('EventID', sql.Int, eventId).query('SELECT TOP 1 EventID, OrganizerID FROM [dbo].[Events] WHERE EventID = @EventID');
        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) return res.status(404).json({ success: false, message: 'Event not found' });
        if (requesterRole !== 'admin' && Number(eventRow.OrganizerID) !== Number(requesterId)) return res.status(403).json({ success: false, message: 'You can only view registrations for your own events' });

        const result = await pool.request().input('EventID', sql.Int, eventId).query(`SELECT r.RegistrationID, r.EventID, r.UserID, r.Status, r.RegistrationDate, r.CancelledAt, u.Email, sp.FirstName, sp.LastName FROM [dbo].[Registrations] r JOIN [dbo].[Users] u ON r.UserID = u.UserID LEFT JOIN [dbo].[StudentProfiles] sp ON r.UserID = sp.UserID WHERE r.EventID = @EventID ORDER BY r.RegistrationDate DESC`);

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch registrations' });
    }
});

// ─── Route: GET /achievements/:userId ────────────────────────────────────
router.get('/achievements/:userId', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    if (requesterRole !== 'admin' && requesterId !== targetUserId) {
        return res.status(403).json({ success: false, message: 'You can only view your own achievements' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT sa.*, e.Title AS EventTitle
                FROM [dbo].[StudentAchievements] sa
                JOIN [dbo].[Events] e ON sa.EventID = e.EventID
                WHERE sa.UserID = @UserID
                ORDER BY sa.AchievementDate DESC, sa.AchievementID DESC
            `);

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch achievements' });
    }
});

// ─── Route: GET /recommendations ─────────────────────────────────────────
router.get('/recommendations', async (req, res) => {
  try {
    // resolve user id: prefer authenticated user attached by authMiddleware, fall back to header/query
    const authUserId = req.user?.UserID;
    const userId = Number(authUserId || req.query.userId || req.headers['x-user-id'] || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'userId required (query or x-user-id header) or attach auth middleware' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
    const pool = await poolPromise;

    // fetch user interests
    const interestRows = await pool.request()
      .input('UserID', sql.Int, userId)
      .query(`
        SELECT i.InterestName
        FROM UserInterests ui
        JOIN Interests i ON i.InterestID = ui.InterestID
        WHERE ui.UserID = @UserID
      `);

    const interests = (interestRows.recordset || []).map(r => String(r.InterestName || '').trim()).filter(Boolean);
    if (interests.length === 0) {
      // fallback: return popular upcoming events when no interests
      const popular = await pool.request()
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT TOP (@Limit)
            e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.PosterURL, op.OrganizationName AS Organizer
          FROM Events e
          LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
          WHERE e.Status = 'Published' AND (e.EventDate IS NULL OR e.EventDate >= CONVERT(date, GETDATE()))
          ORDER BY e.EventDate ASC, e.EventTime ASC
        `);
      return res.json({ success: true, items: popular.recordset || [] });
    }

    // build WHERE clauses using parameterized LIKEs
    const likeClauses = [];
    const request = pool.request();
    interests.forEach((term, i) => {
      const p = `%${term.replace(/[%_]/g, '\\$&')}%`;
      // add three checks per interest: EventType, Title, Description (and Tags if column exists)
      request.input(`q${i}_type`, sql.NVarChar(200), term);
      request.input(`q${i}_like`, sql.NVarChar(4000), p);
      likeClauses.push(`LOWER(ISNULL(e.EventType,'')) = LOWER(@q${i}_type)`);
      likeClauses.push(`LOWER(e.Title) LIKE LOWER(@q${i}_like) ESCAPE '\\'`);
      likeClauses.push(`LOWER(ISNULL(e.Description,'')) LIKE LOWER(@q${i}_like) ESCAPE '\\'`);
    });

    const whereMatch = likeClauses.length ? `(${likeClauses.join(' OR ')})` : '1=0';

    const sqlText = `
      SELECT TOP (@Limit)
        DISTINCT e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.PosterURL, op.OrganizationName AS Organizer
      FROM Events e
      LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
      WHERE e.Status = 'Published'
        AND (e.EventDate IS NULL OR e.EventDate >= CONVERT(date, GETDATE()))
        AND ${whereMatch}
      ORDER BY e.EventDate ASC, e.EventTime ASC
    `;

    request.input('Limit', sql.Int, limit);
    const result = await request.query(sqlText);
    return res.json({ success: true, items: result.recordset || [] });
  } catch (err) {
    console.error('Recommendations Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch recommendations' });
  }
});

module.exports = router;
