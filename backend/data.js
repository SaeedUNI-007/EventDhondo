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

const DEFAULT_EVENT_SKILLS = {
    competition: ['Problem Solving', 'Teamwork'],
    workshop: ['Technical Learning', 'Collaboration'],
    seminar: ['Public Speaking', 'Communication'],
    sports: ['Sportsmanship', 'Teamwork'],
    cultural: ['Creativity', 'Collaboration'],
};

const inferSkillCategory = (skillName) => {
    const raw = String(skillName || '').toLowerCase();
    if (/(speaking|communication|teamwork|collaboration|leadership)/.test(raw)) return 'Soft Skills';
    if (/(sport|badminton|basketball|cricket)/.test(raw)) return 'Sports';
    if (/(design|photography|creativity)/.test(raw)) return 'Arts';
    return 'Technical';
};

const deriveEventSkills = (eventType, title, description) => {
    const typeKey = String(eventType || '').trim().toLowerCase();
    const text = `${eventType || ''} ${title || ''} ${description || ''}`.toLowerCase();
    const skills = new Set(DEFAULT_EVENT_SKILLS[typeKey] || []);

    if (/(coding|programming|problem)/.test(text)) skills.add('Problem Solving');
    if (/(web|react|node|frontend|backend)/.test(text)) skills.add('Web Development');
    if (/(ai|robotics|machine learning|ml\b)/.test(text)) skills.add('AI & Robotics');
    if (/(security|cyber)/.test(text)) skills.add('Cyber Security');
    if (/(public speaking|presentation|speech)/.test(text)) skills.add('Public Speaking');
    if (/(design|graphic)/.test(text)) skills.add('Graphic Design');
    if (/(photo|photography)/.test(text)) skills.add('Photography');

    return Array.from(skills).slice(0, 5);
};

const ensureEventSkillMappings = async (pool, eventId, eventType, title, description) => {
    if (!Number.isInteger(Number(eventId)) || Number(eventId) <= 0) return;

    const skillNames = deriveEventSkills(eventType, title, description);
    if (!skillNames.length) return;

    for (const skillName of skillNames) {
        const category = inferSkillCategory(skillName);
        const skillResult = await pool.request()
            .input('SkillName', sql.NVarChar(100), skillName)
            .input('Category', sql.NVarChar(50), category)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM [dbo].[Skills] WHERE SkillName = @SkillName)
                BEGIN
                    INSERT INTO [dbo].[Skills] (SkillName, Category)
                    VALUES (@SkillName, @Category);
                END

                SELECT TOP 1 SkillID
                FROM [dbo].[Skills]
                WHERE SkillName = @SkillName;
            `);

        const skillId = Number(skillResult.recordset?.[0]?.SkillID);
        if (!Number.isInteger(skillId) || skillId <= 0) continue;

        await pool.request()
            .input('EventID', sql.Int, Number(eventId))
            .input('SkillID', sql.Int, skillId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1
                    FROM [dbo].[EventSkillMapping]
                    WHERE EventID = @EventID AND SkillID = @SkillID
                )
                BEGIN
                    INSERT INTO [dbo].[EventSkillMapping] (EventID, SkillID)
                    VALUES (@EventID, @SkillID);
                END
            `);
    }
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

const isEventCompleted = (eventRow) => {
    const now = Date.now();
    const startMs = getEventStartTimestamp(eventRow?.EventDate, eventRow?.EventTime);
    return Number.isFinite(startMs) && now >= startMs;
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

// ─── Route: GET /skills ───────────────────────────────────────────────────
router.get('/skills', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT SkillID, SkillName, Category FROM [dbo].[Skills] ORDER BY SkillName ASC');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Fetch Skills Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch skills' });
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

        // Always use the base query (includes all events, not just upcoming)
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
            : `
                SELECT e.EventID, e.OrganizerID, e.Title, e.Description, e.EventType,
                    e.EventDate, e.EventTime, e.Venue, e.City, e.Capacity, e.Status, e.PosterURL,
                    o.OrganizationName AS Organizer, o.ContactEmail AS OrganizerEmail,
                    o.ProfilePictureURL AS OrganizerLogo,
                    (SELECT TOP 1 CategoryName FROM EventCategories ec JOIN EventCategoryMapping ecm ON ec.CategoryID = ecm.CategoryID WHERE ecm.EventID = e.EventID) AS Category
                FROM Events e
                JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
                WHERE e.Status = 'Published' AND e.Status NOT IN ('Cancelled')
            `;

        const pool = await poolPromise;
        const request = pool.request();

        if (hasOrganizerFilter) request.input('OrganizerID', sql.Int, Number(organizerId));
        if (category) { query += ' AND Category = @Category'; request.input('Category', sql.NVarChar, category); }
        if (search) { query += ' AND (Title LIKE @Search OR Description LIKE @Search)'; request.input('Search', sql.NVarChar, `%${search}%`); }
        if (date) { query += ' AND EventDate = @Date'; request.input('Date', sql.Date, date); }
        if (city) {
            query += ' AND e.City = @City';
            request.input('City', sql.NVarChar(100), String(city).trim());
        }

        const result = await request.query(query);
        
        // Add isCompleted flag to each event
        const eventsWithCompletion = (result.recordset || []).map(ev => ({
            ...ev,
            isCompleted: isEventCompleted(ev),
        }));
        
        res.json(eventsWithCompletion);
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
                     WHERE r.EventID = e.EventID AND r.Status IN ('Confirmed','Attended')) AS ConfirmedRegistrations
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

// ─── Route: GET /events/:id/skills ────────────────────────────────────────
router.get('/events/:id/skills', async (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid event id is required' });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT s.SkillID, s.SkillName, s.Category
                FROM [dbo].[EventSkillMapping] esm
                JOIN [dbo].[Skills] s ON esm.SkillID = s.SkillID
                WHERE esm.EventID = @EventID
                ORDER BY s.SkillName ASC
            `);
        return res.json(result.recordset || []);
    } catch (err) {
        console.error('Event Skills Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event skills' });
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
        venue, city, capacity, registrationDeadline, posterURL, status, selectedSkills,
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
    const parsedSkillIds = Array.isArray(selectedSkills)
      ? selectedSkills.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
      : [];

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

        const createdEvent = result.recordset?.[0] || null;
        const newEventId = Number(createdEvent?.EventID);

        // Handle skill mappings: if selectedSkills provided, use those; otherwise auto-map
        if (parsedSkillIds.length > 0) {
            for (const skillId of parsedSkillIds) {
                await pool.request()
                    .input('EventID', sql.Int, newEventId)
                    .input('SkillID', sql.Int, skillId)
                    .query(`
                        IF NOT EXISTS (
                            SELECT 1
                            FROM [dbo].[EventSkillMapping]
                            WHERE EventID = @EventID AND SkillID = @SkillID
                        )
                        BEGIN
                            INSERT INTO [dbo].[EventSkillMapping] (EventID, SkillID)
                            VALUES (@EventID, @SkillID);
                        END
                    `);
            }
        } else {
            await ensureEventSkillMappings(
                pool,
                newEventId,
                normalizedType,
                normalizedTitle,
                normalizedDescription
            );
        }

        return res.status(201).json({ success: true, event: createdEvent });
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

    const { title, description, eventType, eventDate, eventTime, venue, city, capacity, registrationDeadline, posterURL, status, selectedSkills } = req.body || {};
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
    const parsedSkillIds = Array.isArray(selectedSkills)
      ? selectedSkills.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
      : [];

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

        // Handle skill mappings: if selectedSkills provided, replace existing mappings
        if (parsedSkillIds.length > 0) {
            await pool.request()
                .input('EventID', sql.Int, eventId)
                .query(`DELETE FROM [dbo].[EventSkillMapping] WHERE EventID = @EventID`);
            
            for (const skillId of parsedSkillIds) {
                await pool.request()
                    .input('EventID', sql.Int, eventId)
                    .input('SkillID', sql.Int, skillId)
                    .query(`
                        IF NOT EXISTS (
                            SELECT 1
                            FROM [dbo].[EventSkillMapping]
                            WHERE EventID = @EventID AND SkillID = @SkillID
                        )
                        BEGIN
                            INSERT INTO [dbo].[EventSkillMapping] (EventID, SkillID)
                            VALUES (@EventID, @SkillID);
                        END
                    `);
            }
        } else {
            // If no skills selected, still run auto-mapping
            await ensureEventSkillMappings(
                pool,
                eventId,
                normalizedType,
                normalizedTitle,
                normalizedDescription
            );
        }

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

// ─── Route: GET /events/:eventId/results ─────────────────────────────────
router.get('/events/:eventId/results', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;
        const eventResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1 EventID, OrganizerID, EventType, EventDate, EventTime, Status
                FROM [dbo].[Events]
                WHERE EventID = @EventID
            `);

        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) return res.status(404).json({ success: false, message: 'Event not found' });

        if (requesterRole !== 'admin' && Number(eventRow.OrganizerID) !== requesterId) {
            return res.status(403).json({ success: false, message: 'You can only view results for your own events' });
        }

        const isCompetition = String(eventRow.EventType || '').toLowerCase() === 'competition';
        if (!isCompetition) {
            return res.status(400).json({ success: false, message: 'Results are only applicable for competition events' });
        }

        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT
                    r.UserID,
                    u.Email,
                    sp.FirstName,
                    sp.LastName,
                    r.Status AS RegistrationStatus,
                    sa.AchievementID,
                    sa.Position,
                    sa.AchievementDate,
                    sa.Description,
                    sa.Note
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Users] u ON u.UserID = r.UserID
                LEFT JOIN [dbo].[StudentProfiles] sp ON sp.UserID = r.UserID
                LEFT JOIN [dbo].[StudentAchievements] sa
                    ON sa.EventID = r.EventID AND sa.UserID = r.UserID
                WHERE r.EventID = @EventID
                  AND LOWER(ISNULL(r.Status, '')) <> 'cancelled'
                ORDER BY ISNULL(sa.AchievementID, 0) DESC, r.RegistrationDate DESC
            `);

        return res.json({
            success: true,
            event: {
                eventId: eventRow.EventID,
                eventType: eventRow.EventType,
                status: eventRow.Status,
                isCompleted: isEventCompleted(eventRow),
            },
            results: result.recordset || [],
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event results' });
    }
});

// ─── Route: POST /events/:eventId/results ────────────────────────────────
router.post('/events/:eventId/results', authMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();
    const entries = Array.isArray(req.body?.results) ? req.body.results : [];

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    if (entries.length === 0) {
        return res.status(400).json({ success: false, message: 'results must be a non-empty array' });
    }

    try {
        const pool = await poolPromise;
        const eventResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1 EventID, OrganizerID, EventType, EventDate, EventTime, Status
                FROM [dbo].[Events]
                WHERE EventID = @EventID
            `);

        const eventRow = eventResult.recordset?.[0];
        if (!eventRow) return res.status(404).json({ success: false, message: 'Event not found' });

        if (requesterRole !== 'admin' && Number(eventRow.OrganizerID) !== requesterId) {
            return res.status(403).json({ success: false, message: 'You can only submit results for your own events' });
        }

        const isCompetition = String(eventRow.EventType || '').toLowerCase() === 'competition';
        if (!isCompetition) {
            return res.status(400).json({ success: false, message: 'Results are only applicable for competition events' });
        }

        const completedByStatus = String(eventRow.Status || '').toLowerCase() === 'completed';
        const completedByTime = isEventCompleted(eventRow);
        if (!completedByStatus && !completedByTime) {
            return res.status(400).json({ success: false, message: 'You can submit competition results only after event completion' });
        }

        const activeRegistrations = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT UserID
                FROM [dbo].[Registrations]
                WHERE EventID = @EventID
                  AND LOWER(ISNULL(Status, '')) <> 'cancelled'
            `);
        const allowedUserIds = new Set((activeRegistrations.recordset || []).map((r) => Number(r.UserID)));

        const normalized = entries
            .map((entry) => ({
                userId: Number(entry?.userId),
                position: String(entry?.position || '').trim(),
                description: entry?.description === undefined ? null : (String(entry.description || '').trim() || null),
                note: entry?.note === undefined ? null : (String(entry.note || '').trim().slice(0, 500) || null),
                achievementDate: entry?.achievementDate ? new Date(entry.achievementDate) : new Date(),
            }))
            .filter((entry) => Number.isInteger(entry.userId) && entry.userId > 0 && entry.position.length > 0);

        if (normalized.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one valid result entry is required' });
        }

        for (const entry of normalized) {
            if (!allowedUserIds.has(entry.userId)) {
                return res.status(400).json({
                    success: false,
                    message: `User ${entry.userId} is not an active participant of this event`,
                });
            }
            if (Number.isNaN(entry.achievementDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid achievementDate for user ${entry.userId}`,
                });
            }
        }

        const tx = new sql.Transaction(await poolPromise);
        await tx.begin();
        try {
            for (const entry of normalized) {
                const existing = await new sql.Request(tx)
                    .input('EventID', sql.Int, eventId)
                    .input('UserID', sql.Int, entry.userId)
                    .query(`
                        SELECT TOP 1 AchievementID
                        FROM [dbo].[StudentAchievements]
                        WHERE EventID = @EventID AND UserID = @UserID
                        ORDER BY AchievementID DESC
                    `);

                const existingId = existing.recordset?.[0]?.AchievementID;

                if (existingId) {
                    await new sql.Request(tx)
                        .input('AchievementID', sql.Int, Number(existingId))
                        .input('Position', sql.NVarChar(50), entry.position)
                        .input('AchievementDate', sql.Date, entry.achievementDate)
                        .input('Description', sql.NVarChar(sql.MAX), entry.description)
                        .input('Note', sql.NVarChar(500), entry.note)
                        .query(`
                            UPDATE [dbo].[StudentAchievements]
                            SET Position = @Position,
                                AchievementDate = @AchievementDate,
                                Description = @Description,
                                Note = @Note
                            WHERE AchievementID = @AchievementID
                        `);
                } else {
                    await new sql.Request(tx)
                        .input('UserID', sql.Int, entry.userId)
                        .input('EventID', sql.Int, eventId)
                        .input('Position', sql.NVarChar(50), entry.position)
                        .input('AchievementDate', sql.Date, entry.achievementDate)
                        .input('Description', sql.NVarChar(sql.MAX), entry.description)
                        .input('Note', sql.NVarChar(500), entry.note)
                        .query(`
                            INSERT INTO [dbo].[StudentAchievements] (UserID, EventID, Position, AchievementDate, Description, Note)
                            VALUES (@UserID, @EventID, @Position, @AchievementDate, @Description, @Note)
                        `);
                }
            }

            await tx.commit();
            return res.json({ success: true, message: 'Competition results saved successfully', savedCount: normalized.length });
        } catch (err) {
            await tx.rollback();
            throw err;
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to save competition results' });
    }
});

const loadPortfolioData = async (targetUserId) => {
    const pool = await poolPromise;

    const [summaryResult, achievementsResult, timelineResult, participationsResult, categoriesResult, skillsResult, profileResult] = await Promise.all([
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT TOP 1
                    sp.UserID,
                    CONCAT(sp.FirstName, ' ', sp.LastName) AS StudentName,
                    u.Email,
                    sp.Department,
                    sp.YearOfStudy,

                    (
                        SELECT COUNT(DISTINCT r1.EventID)
                        FROM [dbo].[Registrations] r1
                        LEFT JOIN [dbo].[Attendance] a1 ON a1.RegistrationID = r1.RegistrationID
                        JOIN [dbo].[Events] e1 ON e1.EventID = r1.EventID
                        WHERE r1.UserID = sp.UserID
                          AND LOWER(ISNULL(r1.Status, '')) <> 'cancelled'
                          AND (a1.AttendanceID IS NOT NULL OR LOWER(ISNULL(r1.Status, '')) = 'attended')
                          AND (
                              LOWER(ISNULL(e1.Status, '')) = 'completed'
                              OR e1.EventDate < CAST(GETDATE() AS DATE)
                              OR (
                                  e1.EventDate = CAST(GETDATE() AS DATE)
                                  AND CAST(ISNULL(e1.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                              )
                          )
                    ) AS TotalEventsAttended,

                    (
                        SELECT COUNT(DISTINCT r2.EventID)
                        FROM [dbo].[Registrations] r2
                        WHERE r2.UserID = sp.UserID
                          AND LOWER(ISNULL(r2.Status, '')) <> 'cancelled'
                    ) AS TotalEventsRegistered,

                    (
                        SELECT COUNT(DISTINCT r3.EventID)
                        FROM [dbo].[Registrations] r3
                        LEFT JOIN [dbo].[Attendance] a3 ON a3.RegistrationID = r3.RegistrationID
                        JOIN [dbo].[Events] e3 ON e3.EventID = r3.EventID
                        WHERE r3.UserID = sp.UserID
                          AND LOWER(ISNULL(r3.Status, '')) <> 'cancelled'
                          AND (a3.AttendanceID IS NOT NULL OR LOWER(ISNULL(r3.Status, '')) = 'attended')
                          AND LOWER(ISNULL(e3.EventType, '')) = 'competition'
                          AND (
                              LOWER(ISNULL(e3.Status, '')) = 'completed'
                              OR e3.EventDate < CAST(GETDATE() AS DATE)
                              OR (
                                  e3.EventDate = CAST(GETDATE() AS DATE)
                                  AND CAST(ISNULL(e3.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                              )
                          )
                    ) AS TotalCompetitionsAttended,

                    (
                        SELECT COUNT(*)
                        FROM [dbo].[StudentAchievements] sa1
                        WHERE sa1.UserID = sp.UserID
                    ) AS TotalAchievements,

                    (
                        SELECT COUNT(*)
                        FROM [dbo].[StudentAchievements] sa2
                        WHERE sa2.UserID = sp.UserID
                          AND (LOWER(ISNULL(sa2.Position, '')) LIKE '%1st%' OR LOWER(ISNULL(sa2.Position, '')) LIKE '%winner%')
                    ) AS FirstPlaceCount,

                    (
                        SELECT COUNT(*)
                        FROM [dbo].[StudentAchievements] sa3
                        WHERE sa3.UserID = sp.UserID
                          AND (LOWER(ISNULL(sa3.Position, '')) LIKE '%2nd%' OR LOWER(ISNULL(sa3.Position, '')) LIKE '%runner%')
                    ) AS SecondPlaceCount,

                    (
                        SELECT COUNT(*)
                        FROM [dbo].[StudentAchievements] sa4
                        WHERE sa4.UserID = sp.UserID
                          AND LOWER(ISNULL(sa4.Position, '')) LIKE '%3rd%'
                    ) AS ThirdPlaceCount,

                    CAST(
                        CASE
                            WHEN (
                                SELECT COUNT(DISTINCT ce.EventID)
                                FROM (
                                    SELECT r5.EventID
                                    FROM [dbo].[Registrations] r5
                                    LEFT JOIN [dbo].[Attendance] a5 ON a5.RegistrationID = r5.RegistrationID
                                    JOIN [dbo].[Events] e5 ON e5.EventID = r5.EventID
                                    WHERE r5.UserID = sp.UserID
                                      AND LOWER(ISNULL(r5.Status, '')) <> 'cancelled'
                                      AND (a5.AttendanceID IS NOT NULL OR LOWER(ISNULL(r5.Status, '')) = 'attended')
                                      AND LOWER(ISNULL(e5.EventType, '')) = 'competition'
                                      AND (
                                          LOWER(ISNULL(e5.Status, '')) = 'completed'
                                          OR e5.EventDate < CAST(GETDATE() AS DATE)
                                          OR (
                                              e5.EventDate = CAST(GETDATE() AS DATE)
                                              AND CAST(ISNULL(e5.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                                          )
                                      )
                                    UNION
                                    SELECT sa6.EventID
                                    FROM [dbo].[StudentAchievements] sa6
                                    JOIN [dbo].[Events] e6a ON e6a.EventID = sa6.EventID
                                    WHERE sa6.UserID = sp.UserID
                                      AND LOWER(ISNULL(e6a.EventType, '')) = 'competition'
                                ) ce
                            ) = 0 THEN 0
                            ELSE (
                                (
                                    SELECT COUNT(DISTINCT sa5.EventID)
                                    FROM [dbo].[StudentAchievements] sa5
                                    JOIN [dbo].[Events] e6 ON e6.EventID = sa5.EventID
                                    WHERE sa5.UserID = sp.UserID
                                      AND LOWER(ISNULL(e6.EventType, '')) = 'competition'
                                      AND (
                                          LOWER(ISNULL(sa5.Position, '')) LIKE '%1st%'
                                          OR LOWER(ISNULL(sa5.Position, '')) LIKE '%winner%'
                                          OR LOWER(ISNULL(sa5.Position, '')) LIKE '%2nd%'
                                          OR LOWER(ISNULL(sa5.Position, '')) LIKE '%runner%'
                                          OR LOWER(ISNULL(sa5.Position, '')) LIKE '%3rd%'
                                      )
                                ) * 100.0
                            ) / (
                                SELECT COUNT(DISTINCT ce2.EventID)
                                FROM (
                                    SELECT r6.EventID
                                    FROM [dbo].[Registrations] r6
                                    LEFT JOIN [dbo].[Attendance] a6 ON a6.RegistrationID = r6.RegistrationID
                                    JOIN [dbo].[Events] e7 ON e7.EventID = r6.EventID
                                    WHERE r6.UserID = sp.UserID
                                      AND LOWER(ISNULL(r6.Status, '')) <> 'cancelled'
                                      AND (a6.AttendanceID IS NOT NULL OR LOWER(ISNULL(r6.Status, '')) = 'attended')
                                      AND LOWER(ISNULL(e7.EventType, '')) = 'competition'
                                      AND (
                                          LOWER(ISNULL(e7.Status, '')) = 'completed'
                                          OR e7.EventDate < CAST(GETDATE() AS DATE)
                                          OR (
                                              e7.EventDate = CAST(GETDATE() AS DATE)
                                              AND CAST(ISNULL(e7.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                                          )
                                      )
                                    UNION
                                    SELECT sa7.EventID
                                    FROM [dbo].[StudentAchievements] sa7
                                    JOIN [dbo].[Events] e8 ON e8.EventID = sa7.EventID
                                    WHERE sa7.UserID = sp.UserID
                                      AND LOWER(ISNULL(e8.EventType, '')) = 'competition'
                                ) ce2
                            )
                        END
                    AS DECIMAL(5,2)) AS CompetitionWinRatePercent
                FROM [dbo].[StudentProfiles] sp
                JOIN [dbo].[Users] u ON u.UserID = sp.UserID
                WHERE sp.UserID = @UserID
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT
                    sa.UserID,
                    e.Title AS EventTitle,
                    sa.Position,
                    sa.AchievementDate,
                    e.EventType,
                    o.OrganizationName AS AwardedBy,
                    sa.Note
                FROM StudentAchievements sa
                JOIN Events e ON sa.EventID = e.EventID
                JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
                WHERE sa.UserID = @UserID
                ORDER BY sa.AchievementDate DESC, e.Title ASC
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT
                    sa.UserID,
                    DATEFROMPARTS(YEAR(sa.AchievementDate), MONTH(sa.AchievementDate), 1) AS MonthStart,
                    COUNT(*) AS AchievementsCount,
                    COUNT(DISTINCT sa.EventID) AS DistinctEvents,
                    STRING_AGG(CAST(e.Title AS NVARCHAR(MAX)), ' | ') AS EventTitles
                FROM StudentAchievements sa
                JOIN Events e ON e.EventID = sa.EventID
                WHERE sa.UserID = @UserID
                GROUP BY sa.UserID, DATEFROMPARTS(YEAR(sa.AchievementDate), MONTH(sa.AchievementDate), 1)
                ORDER BY MonthStart ASC
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT
                    e.EventID,
                    e.Title AS EventTitle,
                    e.EventType,
                    e.EventDate,
                    r.Status AS RegistrationStatus,
                    CAST(1 AS BIT) AS Attended,
                    CASE
                        WHEN LOWER(ISNULL(e.Status, '')) = 'completed'
                          OR e.EventDate < CAST(GETDATE() AS DATE)
                          OR (
                              e.EventDate = CAST(GETDATE() AS DATE)
                              AND CAST(ISNULL(e.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                          )
                        THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS IsCompleted,
                    sa.Position,
                    sa.Description AS AchievementDescription,
                    sa.Note
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                LEFT JOIN [dbo].[Attendance] a ON a.RegistrationID = r.RegistrationID
                LEFT JOIN [dbo].[StudentAchievements] sa ON sa.UserID = r.UserID AND sa.EventID = r.EventID
                WHERE r.UserID = @UserID
                  AND LOWER(ISNULL(r.Status, '')) <> 'cancelled'
                                    AND (a.AttendanceID IS NOT NULL OR LOWER(ISNULL(r.Status, '')) = 'attended')
                                    AND (
                                            LOWER(ISNULL(e.Status, '')) = 'completed'
                                            OR e.EventDate < CAST(GETDATE() AS DATE)
                                            OR (
                                                    e.EventDate = CAST(GETDATE() AS DATE)
                                                    AND CAST(ISNULL(e.EventTime, '23:59:59') AS TIME) <= CAST(GETDATE() AS TIME)
                                            )
                                    )
                ORDER BY e.EventDate DESC
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT TOP 5
                    e.EventType,
                    COUNT(*) AS Count
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                LEFT JOIN [dbo].[Attendance] a ON a.RegistrationID = r.RegistrationID
                WHERE r.UserID = @UserID
                  AND LOWER(ISNULL(r.Status, '')) <> 'cancelled'
                  AND (a.AttendanceID IS NOT NULL OR LOWER(ISNULL(r.Status, '')) = 'attended')
                GROUP BY e.EventType
                ORDER BY Count DESC, e.EventType ASC
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT DISTINCT s.SkillName
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                LEFT JOIN [dbo].[Attendance] a ON a.RegistrationID = r.RegistrationID
                JOIN [dbo].[EventSkillMapping] esm ON esm.EventID = e.EventID
                JOIN [dbo].[Skills] s ON s.SkillID = esm.SkillID
                WHERE r.UserID = @UserID
                  AND LOWER(ISNULL(r.Status, '')) <> 'cancelled'
                  AND (a.AttendanceID IS NOT NULL OR LOWER(ISNULL(r.Status, '')) = 'attended')
                ORDER BY s.SkillName ASC
            `),
        pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT TOP 1
                    sp.LinkedInURL,
                    sp.GitHubURL,
                    sp.Department,
                    sp.YearOfStudy,
                    CONCAT(sp.FirstName, ' ', sp.LastName) AS StudentName
                FROM [dbo].[StudentProfiles] sp
                WHERE sp.UserID = @UserID
            `),
    ]);

    const summary = summaryResult.recordset?.[0] || null;
    if (!summary) return null;

    return {
        summary,
        profile: profileResult.recordset?.[0] || null,
        achievements: achievementsResult.recordset || [],
        timeline: timelineResult.recordset || [],
        participations: participationsResult.recordset || [],
        mostActiveCategories: categoriesResult.recordset || [],
        skillTags: (skillsResult.recordset || []).map((r) => r.SkillName).filter(Boolean),
    };
};

// ─── Route: GET /portfolio/:userId ───────────────────────────────────────
router.get('/portfolio/:userId', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    if (requesterRole !== 'admin' && requesterId !== targetUserId) {
        return res.status(403).json({ success: false, message: 'You can only view your own portfolio' });
    }

    try {
        const payload = await loadPortfolioData(targetUserId);
        if (!payload) {
            return res.status(404).json({ success: false, message: 'Student portfolio not found' });
        }
        return res.json({ success: true, ...payload });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch student portfolio' });
    }
});

// ─── Route: GET /portfolio/public/:userId ────────────────────────────────
router.get('/portfolio/public/:userId', async (req, res) => {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    try {
        const payload = await loadPortfolioData(targetUserId);
        if (!payload) {
            return res.status(404).json({ success: false, message: 'Public portfolio not found' });
        }
        return res.json({ success: true, ...payload });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch public portfolio' });
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

        try {
            const spResult = await pool.request()
                .input('UserID', sql.Int, userId)
                .input('TopN', sql.Int, limit)
                .execute('dbo.sp_GetRecommendedEvents');

            const spItems = spResult.recordset || [];
            if (spItems.length > 0) {
                    return res.json({ success: true, source: 'procedure', items: spItems });
            }
        } catch (_spErr) {
            // Fall back to the legacy recommendation query below.
        }

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
                .input('UserID', sql.Int, userId)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT TOP (@Limit)
            e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.PosterURL, op.OrganizationName AS Organizer
          FROM Events e
          LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                    WHERE e.Status = 'Published'
                        AND (e.EventDate IS NULL OR e.EventDate >= CONVERT(date, GETDATE()))
                        AND NOT EXISTS (
                            SELECT 1
                            FROM Registrations r
                            WHERE r.EventID = e.EventID
                                AND r.UserID = @UserID
                                AND r.Status <> 'Cancelled'
                        )
          ORDER BY e.EventDate ASC, e.EventTime ASC
        `);
            return res.json({ success: true, source: 'popular', items: popular.recordset || [] });
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
            SELECT DISTINCT TOP (@Limit)
                e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.PosterURL, op.OrganizationName AS Organizer
      FROM Events e
      LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
            WHERE e.Status = 'Published'
        AND (e.EventDate IS NULL OR e.EventDate >= CONVERT(date, GETDATE()))
                AND NOT EXISTS (
                    SELECT 1
                    FROM Registrations r
                    WHERE r.EventID = e.EventID
                        AND r.UserID = @UserID
                        AND r.Status <> 'Cancelled'
                )
        AND ${whereMatch}
      ORDER BY e.EventDate ASC, e.EventTime ASC
    `;

    request.input('UserID', sql.Int, userId);
    request.input('Limit', sql.Int, limit);
    const result = await request.query(sqlText);

        const matchedItems = result.recordset || [];
        if (matchedItems.length > 0) {
            return res.json({ success: true, source: 'interest-match', items: matchedItems });
        }

        const popularFallback = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('Limit', sql.Int, limit)
            .query(`
                SELECT TOP (@Limit)
                    e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.PosterURL, op.OrganizationName AS Organizer
                FROM Events e
                LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                WHERE e.Status = 'Published'
                    AND (e.EventDate IS NULL OR e.EventDate >= CONVERT(date, GETDATE()))
                    AND NOT EXISTS (
                        SELECT 1
                        FROM Registrations r
                        WHERE r.EventID = e.EventID
                            AND r.UserID = @UserID
                            AND r.Status <> 'Cancelled'
                    )
                ORDER BY e.EventDate ASC, e.EventTime ASC
            `);

        return res.json({ success: true, source: 'popular-fallback', items: popularFallback.recordset || [] });
  } catch (err) {
    console.error('Recommendations Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch recommendations' });
  }
});

// ─── Route: GET /events/attended/:userId ─────────────────────────────────
// Student dashboard: Show attended events (registered + event has passed)
router.get('/events/attended/:userId', authMiddleware, async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    // Only students can view their own attended events; admins can view any student's
    if (requesterRole !== 'admin' && requesterId !== targetUserId) {
        return res.status(403).json({ success: false, message: 'You can only view your own attended events' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query(`
                SELECT
                    r.RegistrationID,
                    r.EventID,
                    r.UserID,
                    r.Status AS RegistrationStatus,
                    r.RegistrationDate,
                    e.EventID,
                    e.Title,
                    e.Description,
                    e.EventType,
                    e.EventDate,
                    e.EventTime,
                    e.Venue,
                    e.City,
                    e.PosterURL,
                    op.OrganizationName AS Organizer,
                    op.ProfilePictureURL AS OrganizerLogo,
                    CASE
                        WHEN a.AttendanceID IS NOT NULL THEN 'Attended'
                        ELSE 'Registered'
                    END AS AttendanceStatus
                FROM [dbo].[Registrations] r
                JOIN [dbo].[Events] e ON e.EventID = r.EventID
                LEFT JOIN [dbo].[OrganizerProfiles] op ON e.OrganizerID = op.UserID
                LEFT JOIN [dbo].[Attendance] a ON a.RegistrationID = r.RegistrationID
                WHERE r.UserID = @UserID
                  AND r.Status <> 'Cancelled'
                  AND (e.EventDate IS NULL OR e.EventDate < CONVERT(date, GETDATE()) OR e.Status = 'Completed')
                ORDER BY e.EventDate DESC, e.EventTime DESC
            `);

        return res.json(result.recordset || []);
    } catch (err) {
        console.error('Attended Events Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch attended events' });
    }
});

// ─── Route: GET /events/completed ─────────────────────────────────────────
// Organizer dashboard: Show completed events (past or marked completed)
router.get('/events/completed', authMiddleware, async (req, res) => {
    const organizerId = req.user?.UserID;
    const requesterRole = String(req.user?.Role || '').toLowerCase();

    if (!organizerId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Only organizers can view their completed events; admins can view all
    if (requesterRole !== 'organizer' && requesterRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only organizers and admins can view completed events' });
    }

    try {
        const pool = await poolPromise;

        const whereClause = requesterRole === 'admin'
            ? ''
            : 'WHERE e.OrganizerID = @OrganizerID';

        const sqlText = `
            SELECT
                e.EventID,
                e.OrganizerID,
                e.Title,
                e.Description,
                e.EventType,
                e.EventDate,
                e.EventTime,
                e.Venue,
                e.City,
                e.Capacity,
                e.Status,
                e.PosterURL,
                op.OrganizationName AS Organizer,
                op.ContactEmail AS OrganizerEmail,
                op.ProfilePictureURL AS OrganizerLogo,
                (SELECT COUNT(*) FROM Registrations r WHERE r.EventID = e.EventID AND r.Status IN ('Confirmed','Attended')) AS ConfirmedRegistrations,
                (SELECT COUNT(*) FROM Attendance a JOIN Registrations r ON a.RegistrationID = r.RegistrationID WHERE r.EventID = e.EventID) AS AttendanceCount
            FROM [dbo].[Events] e
            LEFT JOIN [dbo].[OrganizerProfiles] op ON e.OrganizerID = op.UserID
            ${whereClause}
            AND (e.Status = 'Completed' OR e.EventDate < CONVERT(date, GETDATE()))
            ORDER BY e.EventDate DESC, e.EventTime DESC
        `;

        const request = pool.request();
        if (requesterRole !== 'admin') {
            request.input('OrganizerID', sql.Int, organizerId);
        }

        const result = await request.query(sqlText);
        return res.json(result.recordset || []);
    } catch (err) {
        console.error('Completed Events Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch completed events' });
    }
});

module.exports = router;
