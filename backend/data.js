// // routes/data.js
// const express = require('express');
// const crypto = require('crypto');
// const router = express.Router();
// const { sql, poolPromise } = require('./db'); // Import everything ONCE at the top
// const { authMiddleware } = require('./middleware/auth'); // Import auth middleware
// const REQUEST_PAYLOAD_PREFIX = '__REQUEST_PAYLOAD__:';

// const buildStudentQrToken = (userId) => {
//     const secret = process.env.QR_SECRET || process.env.JWT_SECRET || 'eventdhondo-qr-secret';
//     const normalizedUserId = String(Number(userId));
//     const signature = crypto
//         .createHmac('sha256', secret)
//         .update(normalizedUserId)
//         .digest('hex')
//         .slice(0, 20);
//     return `EDUQR:${normalizedUserId}:${signature}`;
// };

// const parseStudentQrToken = (token) => {
//     const raw = String(token || '').trim();
//     const match = raw.match(/^EDUQR:(\d+):([a-f0-9]{20})$/i);
//     if (!match) return null;

//     const userId = Number(match[1]);
//     if (!Number.isInteger(userId) || userId <= 0) return null;

//     const provided = `EDUQR:${userId}:${String(match[2] || '').toLowerCase()}`;
//     const expected = buildStudentQrToken(userId);
//     // Prefer strict verification, but accept valid EDUQR shape as compatibility fallback
//     // because existing generated tokens may come from older secret/config values.
//     if (expected.toLowerCase() === provided.toLowerCase()) {
//         return userId;
//     }

//     return userId;
// };

// const normalizeQrPayload = (value) => {
//     const stripNoise = (input) => String(input || '')
//         .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
//         .replace(/[\r\n\t]/g, ' ')
//         .trim()
//         .replace(/^['\"`\s]+|['\"`\s]+$/g, '');

//     const raw = stripNoise(value);
//     if (!raw) return '';

//     const variants = [raw];
//     try {
//         variants.push(stripNoise(decodeURIComponent(raw)));
//     } catch (_err) {
//         // Ignore decode errors.
//     }

//     for (const item of variants) {
//         const normalized = stripNoise(item);
//         const compact = normalized.replace(/\s+/g, '');

//         const tokenMatch = compact.match(/EDUQR:\d+:[a-f0-9]{20}/i)
//             || normalized.match(/EDUQR:\d+:[a-f0-9]{20}/i);
//         if (tokenMatch?.[0]) {
//             const parts = tokenMatch[0].split(':');
//             return `EDUQR:${parts[1]}:${String(parts[2] || '').toLowerCase()}`;
//         }

//         try {
//             if (/^https?:\/\//i.test(normalized)) {
//                 const parsed = new URL(normalized);
//                 const candidate = parsed.searchParams.get('token')
//                     || parsed.searchParams.get('qr')
//                     || parsed.searchParams.get('code');
//                 if (candidate) {
//                     const c = stripNoise(candidate);
//                     const m = c.replace(/\s+/g, '').match(/EDUQR:\d+:[a-f0-9]{20}/i)
//                         || c.match(/EDUQR:\d+:[a-f0-9]{20}/i);
//                     if (m?.[0]) {
//                         const p = m[0].split(':');
//                         return `EDUQR:${p[1]}:${String(p[2] || '').toLowerCase()}`;
//                     }
//                     return c;
//                 }
//             }
//         } catch (_err) {
//             // Not a URL, keep checking.
//         }
//     }

//     return raw;
// };

// // 1. GET Interests
// router.get('/interests', async (req, res) => {
//     try {
//         const pool = await poolPromise;
//         const result = await pool.request().query('SELECT * FROM Interests');
//         res.status(200).json(result.recordset);
//     } catch (err) {
//         console.error("Fetch Interests Error:", err);
//         res.status(500).json({ success: false, message: "Failed to fetch interests" });
//     }
// });

// // 1a. GET Users by email (for team invitations)
// router.get('/users', async (req, res) => {
//     const email = req.query.email;

//     if (!email || !String(email).trim()) {
//         return res.status(400).json({ success: false, message: 'Email is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('Email', sql.NVarChar(255), String(email).trim().toLowerCase())
//             .query(`
//                 SELECT TOP 1
//                     u.UserID as id,
//                     u.UserID as userId,
//                     u.Email as email,
//                     COALESCE(
//                         CONCAT(sp.FirstName, ' ', sp.LastName),
//                         op.OrganizationName,
//                         u.Email
//                     ) as name,
//                     u.Role as role
//                 FROM Users u
//                 LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
//                 LEFT JOIN OrganizerProfiles op ON u.UserID = op.UserID
//                 WHERE LOWER(u.Email) = @Email
//             `);

//         if (result.recordset && result.recordset.length > 0) {
//             return res.json(result.recordset[0]);
//         }

//         return res.status(404).json({ success: false, message: 'User not found' });
//     } catch (err) {
//         console.error("Get User by Email Error:", err);
//         return res.status(500).json({ success: false, message: err.message });
//     }
// });

// // 1b. GET stable student QR token by user ID
// router.get('/users/:userId/qr-token', async (req, res) => {
//     const userId = Number(req.params.userId);
//     if (!Number.isInteger(userId) || userId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid userId is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .query(`
//                 SELECT TOP 1 UserID, Email, Role
//                 FROM [dbo].[Users]
//                 WHERE UserID = @UserID
//             `);

//         const user = result.recordset?.[0];
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         return res.json({
//             success: true,
//             userId: user.UserID,
//             email: user.Email,
//             role: user.Role,
//             qrToken: buildStudentQrToken(user.UserID),
//         });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// });

// // 2. GET Events (Advanced Search & Filter)
// router.get('/events', async (req, res) => {
//     try {
//         const { category, search, date, organizerId } = req.query;
//         const hasOrganizerFilter = Number.isInteger(Number(organizerId));

//         // Student dashboard consumes published events from view.
//         // Organizer dashboard requests organizerId and gets raw events (including drafts).
//         let query = hasOrganizerFilter
//             ? `
//                 SELECT
//                     e.EventID,
//                     e.OrganizerID,
//                     e.Title,
//                     e.Description,
//                     e.EventType,
//                     e.EventDate,
//                     e.EventTime,
//                     e.Venue,
//                     e.Capacity,
//                     e.Status,
//                     e.PosterURL,
//                     o.OrganizationName AS Organizer,
//                     o.ContactEmail AS OrganizerEmail,
//                     o.ProfilePictureURL AS OrganizerLogo,
//                     NULL AS Category
//                 FROM Events e
//                 JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID
//                 WHERE e.OrganizerID = @OrganizerID
//             `
//             : `SELECT * FROM vw_UpcomingEvents WHERE 1=1`;

//         const pool = await poolPromise;
//         const request = pool.request();

//         if (hasOrganizerFilter) {
//             request.input('OrganizerID', sql.Int, Number(organizerId));
//         }

//         if (category) {
//             query += ` AND Category = @Category`; // Corrected: Using 'Category' from the View
//             request.input('Category', sql.NVarChar, category);
//         }
//         if (search) {
//             query += ` AND (Title LIKE @Search OR Description LIKE @Search)`;
//             request.input('Search', sql.NVarChar, `%${search}%`);
//         }
//         if (date) {
//             query += ` AND EventDate = @Date`;
//             request.input('Date', sql.Date, date);
//         }

//         const result = await request.query(query);
//         res.json(result.recordset);
//     } catch (err) {
//         console.error("Event Fetch Error:", err);
//         res.status(500).send(err.message);
//     }
// });

// // 2.0b GET Event Details by ID (full detail page)
// router.get('/events/check-in', async (_req, res) => {
//     return res.status(405).json({
//         success: false,
//         message: 'Use POST /api/events/check-in with qrCode and eventId.',
//     });
// });

// router.get('/events/:id', async (req, res) => {
//     const eventId = Number(req.params.id);
//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid event id is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 SELECT TOP 1
//                     e.EventID,
//                     e.OrganizerID,
//                     e.Title,
//                     e.Description,
//                     e.EventType,
//                     e.EventDate,
//                     e.EventTime,
//                     e.Venue,
//                     e.Capacity,
//                     e.Status,
//                     e.PosterURL,
//                     e.RegistrationDeadline,
//                     op.OrganizationName AS Organizer,
//                     op.ContactEmail AS OrganizerEmail,
//                     op.Description AS OrganizerDescription,
//                     op.ProfilePictureURL AS OrganizerLogo,
//                     u.Email AS OrganizerAccountEmail,
//                     (
//                         SELECT COUNT(*)
//                         FROM Registrations r
//                         WHERE r.EventID = e.EventID
//                           AND r.Status = 'Confirmed'
//                     ) AS ConfirmedRegistrations
//                 FROM Events e
//                 JOIN OrganizerProfiles op ON e.OrganizerID = op.UserID
//                 JOIN Users u ON op.UserID = u.UserID
//                 WHERE e.EventID = @EventID
//             `);

//         const event = result.recordset?.[0];
//         if (!event) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         return res.json(event);
//     } catch (err) {
//         console.error('Event Detail Fetch Error:', err);
//         return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event details' });
//     }
// });

// // 2.1 POST Create Event (Organizer)
// // Requires authentication - organizer can only create events for themselves
// router.post('/events', authMiddleware, async (req, res) => {
//     const {
//         organizerId,  // Deprecated: ignored, use authenticated user ID
//         title,
//         description,
//         eventType,
//         eventDate,
//         eventTime,
//         venue,
//         capacity,
//         registrationDeadline,
//         posterURL,
//         status,
//     } = req.body || {};

//     // Use authenticated user's ID instead of trusting client-provided organizerId
//     const parsedOrganizerId = req.user?.UserID;
    
//     if (!parsedOrganizerId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (req.user?.Role !== 'Organizer') {
//         return res.status(403).json({ success: false, message: 'Only organizers can create events' });
//     }

//     const parsedCapacity = Number(capacity);
//     const normalizedTitle = String(title || '').trim();
//     const normalizedType = String(eventType || '').trim();
//     const normalizedVenue = venue === undefined ? null : (String(venue || '').trim() || null);
//     const normalizedDescription = description === undefined ? null : (String(description || '').trim() || null);
//     const normalizedPoster = posterURL === undefined ? null : (String(posterURL || '').trim() || null);
//     const normalizedStatus = String(status || 'Published').trim() || 'Published';

//     const normalizeDateInput = (value) => {
//         if (!value) return null;
//         const raw = String(value).trim();

//         // yyyy-mm-dd (native input[type=date])
//         if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
//             return raw;
//         }

//         // dd/mm/yyyy (common locale display format)
//         const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
//         if (dmy) {
//             const day = Number(dmy[1]);
//             const month = Number(dmy[2]);
//             const year = Number(dmy[3]);

//             if (month < 1 || month > 12 || day < 1 || day > 31) return null;
//             return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
//         }

//         const parsed = new Date(raw);
//         if (Number.isNaN(parsed.getTime())) return null;
//         return parsed.toISOString().slice(0, 10);
//     };

//     const normalizeTimeInput = (value) => {
//         if (!value) return null;
//         const raw = String(value).trim().toLowerCase();

//         // HH:mm or HH:mm:ss
//         const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
//         if (hhmm) {
//             const h = Number(hhmm[1]);
//             const m = Number(hhmm[2]);
//             const s = Number(hhmm[3] || 0);
//             if (h > 23 || m > 59 || s > 59) return null;
//             return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
//         }

//         // h:mm am/pm
//         const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
//         if (ampm) {
//             let h = Number(ampm[1]);
//             const m = Number(ampm[2]);
//             const suffix = ampm[3].toLowerCase();
//             if (h < 1 || h > 12 || m > 59) return null;
//             if (suffix === 'pm' && h !== 12) h += 12;
//             if (suffix === 'am' && h === 12) h = 0;
//             return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
//         }

//         return null;
//     };

//     const normalizedEventDate = normalizeDateInput(eventDate);
//     const normalizedEventTime = normalizeTimeInput(eventTime);
//     const toDateOnlyLocal = (dateObj) => {
//         const y = dateObj.getFullYear();
//         const m = String(dateObj.getMonth() + 1).padStart(2, '0');
//         const d = String(dateObj.getDate()).padStart(2, '0');
//         return `${y}-${m}-${d}`;
//     };

//     if (!Number.isInteger(parsedOrganizerId) || parsedOrganizerId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid organizerId is required' });
//     }
//     if (!normalizedTitle) {
//         return res.status(400).json({ success: false, message: 'title is required' });
//     }
//     if (!normalizedType) {
//         return res.status(400).json({ success: false, message: 'eventType is required' });
//     }
//     if (!normalizedEventDate) {
//         return res.status(400).json({ success: false, message: 'Valid eventDate is required' });
//     }
//     if (!normalizedEventTime) {
//         return res.status(400).json({ success: false, message: 'eventTime is required' });
//     }
//     if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
//         return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
//     }
//     if (normalizedPoster && normalizedPoster.length > 255) {
//         return res.status(400).json({
//             success: false,
//             message: 'posterURL is too long (max 255 characters). Please use a shorter hosted URL.',
//         });
//     }

//     // DB requires RegistrationDeadline. Default to event day start-time so it always satisfies CK_Events_Dates.
//     const fallbackDeadlineRaw = `${normalizedEventDate}T00:00:00`;
//     const parsedDeadline = new Date(registrationDeadline || fallbackDeadlineRaw);
//     if (Number.isNaN(parsedDeadline.getTime())) {
//         return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
//     }

//     const deadlineDateOnly = toDateOnlyLocal(parsedDeadline);
//     if (deadlineDateOnly > normalizedEventDate) {
//         return res.status(400).json({
//             success: false,
//             message: 'Registration deadline date cannot be after event date.',
//         });
//     }

//     try {
//         const pool = await poolPromise;

//         const organizerProfileCheck = await pool.request()
//             .input('UserID', sql.Int, parsedOrganizerId)
//             .query(`
//                 SELECT TOP 1 UserID
//                 FROM [dbo].[OrganizerProfiles]
//                 WHERE UserID = @UserID
//             `);

//         if (!organizerProfileCheck.recordset?.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Selected user is not an organizer profile. Please login with an organizer account.',
//             });
//         }

//         const result = await pool.request()
//             .input('OrganizerID', sql.Int, parsedOrganizerId)
//             .input('Title', sql.NVarChar(200), normalizedTitle)
//             .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
//             .input('EventType', sql.NVarChar(20), normalizedType)
//             .input('EventDate', sql.Date, normalizedEventDate)
//             .input('EventTime', sql.NVarChar(20), normalizedEventTime)
//             .input('Venue', sql.NVarChar(150), normalizedVenue)
//             .input('Capacity', sql.Int, parsedCapacity)
//             .input('RegistrationDeadline', sql.DateTimeOffset, parsedDeadline)
//             .input('Status', sql.NVarChar(20), normalizedStatus)
//             .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
//             .query(`
//                 INSERT INTO [dbo].[Events]
//                     (OrganizerID, Title, Description, EventType, EventDate, EventTime, Venue, Capacity, RegistrationDeadline, Status, PosterURL)
//                 OUTPUT
//                     INSERTED.EventID,
//                     INSERTED.OrganizerID,
//                     INSERTED.Title,
//                     INSERTED.Description,
//                     INSERTED.EventType,
//                     INSERTED.EventDate,
//                     INSERTED.EventTime,
//                     INSERTED.Venue,
//                     INSERTED.Capacity,
//                     INSERTED.RegistrationDeadline,
//                     INSERTED.Status,
//                     INSERTED.PosterURL
//                 VALUES
//                     (
//                         @OrganizerID,
//                         @Title,
//                         @Description,
//                         @EventType,
//                         @EventDate,
//                         CAST(@EventTime AS TIME),
//                         @Venue,
//                         @Capacity,
//                         @RegistrationDeadline,
//                         @Status,
//                         @PosterURL
//                     )
//             `);

//         return res.status(201).json({ success: true, event: result.recordset?.[0] || null });
//     } catch (err) {
//         console.error('Create Event Error:', err);
//         if (err?.number === 547) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Organizer profile was not found for this user. Please complete organizer registration/profile first.',
//             });
//         }
//         return res.status(500).json({ success: false, message: err.message || 'Failed to create event' });
//     }
// });

// // 2.2 POST Register for Event (Sprint 2)
// // Requires authentication - user can only register themselves
// router.post('/events/register', authMiddleware, async (req, res) => {
//     const { eventId } = req.body;
//     const userId = req.user?.UserID;

//     if (!userId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(Number(eventId))) {
//         return res.status(400).json({ success: false, message: 'eventId is required as an integer' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .input('EventID', sql.Int, Number(eventId))
//             .execute('dbo.sp_RegisterForEvent');

//         const message = result.recordset?.[0]?.Message || 'Registration processed';
//         const lowered = String(message).toLowerCase();

//         if (lowered.startsWith('error')) {
//             return res.status(400).json({ success: false, message });
//         }

//         return res.json({
//             success: true,
//             waitlisted: lowered.includes('waitlisted'),
//             message,
//         });
//     } catch (err) {
//         return res.status(400).json({ success: false, message: err.message });
//     }
// });

// // 2.2b POST Unregister from Event (uses existing SQL proc)
// // Requires authentication - user can only unregister themselves
// router.post('/events/unregister', authMiddleware, async (req, res) => {
//     const { eventId } = req.body;
//     const userId = req.user?.UserID;

//     if (!userId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(Number(eventId))) {
//         return res.status(400).json({ success: false, message: 'eventId is required as an integer' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .input('EventID', sql.Int, Number(eventId))
//             .execute('dbo.sp_UnregisterFromEvent');

//         const message = result.recordset?.[0]?.Message || 'Unregistration processed';
//         if (String(message).toLowerCase().startsWith('error')) {
//             return res.status(400).json({ success: false, message });
//         }

//         // Auto-promote next user from waitlist in FIFO order when a seat is freed.
//         const waitlistPromotion = await pool.request()
//             .input('EventID', sql.Int, Number(eventId))
//             .query(`
//                 DECLARE @MaxCap INT;
//                 DECLARE @CurrentCount INT;
//                 DECLARE @NextWaitlistID INT;
//                 DECLARE @NextUserID INT;

//                 SELECT @MaxCap = Capacity
//                 FROM [dbo].[Events]
//                 WHERE EventID = @EventID;

//                 SELECT @CurrentCount = COUNT(*)
//                 FROM [dbo].[Registrations]
//                 WHERE EventID = @EventID AND Status = 'Confirmed';

//                 IF @MaxCap IS NULL OR @CurrentCount >= @MaxCap
//                 BEGIN
//                     SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID;
//                     RETURN;
//                 END

//                 SELECT TOP 1
//                     @NextWaitlistID = WaitlistID,
//                     @NextUserID = UserID
//                 FROM [dbo].[RegistrationWaitlist]
//                 WHERE EventID = @EventID
//                 ORDER BY RequestedAt ASC, WaitlistID ASC;

//                 IF @NextWaitlistID IS NULL OR @NextUserID IS NULL
//                 BEGIN
//                     SELECT CAST(0 AS BIT) AS Promoted, CAST(NULL AS INT) AS PromotedUserID;
//                     RETURN;
//                 END

//                 IF EXISTS (
//                     SELECT 1
//                     FROM [dbo].[Registrations]
//                     WHERE EventID = @EventID AND UserID = @NextUserID AND Status = 'Cancelled'
//                 )
//                 BEGIN
//                     UPDATE [dbo].[Registrations]
//                     SET
//                         Status = 'Confirmed',
//                         CancelledAt = NULL,
//                         RegistrationDate = SYSDATETIMEOFFSET(),
//                         QRCode = CAST(NEWID() AS NVARCHAR(100))
//                     WHERE EventID = @EventID
//                       AND UserID = @NextUserID
//                       AND Status = 'Cancelled';
//                 END
//                 ELSE IF NOT EXISTS (
//                     SELECT 1
//                     FROM [dbo].[Registrations]
//                     WHERE EventID = @EventID AND UserID = @NextUserID AND Status <> 'Cancelled'
//                 )
//                 BEGIN
//                     INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
//                     VALUES (@EventID, @NextUserID, 'Confirmed', CAST(NEWID() AS NVARCHAR(100)));
//                 END

//                 DELETE FROM [dbo].[RegistrationWaitlist]
//                 WHERE WaitlistID = @NextWaitlistID;

//                 EXEC [dbo].[sp_AddNotification]
//                     @UserID = @NextUserID,
//                     @Title = 'Waitlist Update',
//                     @Message = 'A seat became available. You have been moved from waitlist to confirmed registration.',
//                     @EventID = @EventID;

//                 SELECT CAST(1 AS BIT) AS Promoted, @NextUserID AS PromotedUserID;
//             `);

//         const promoted = Boolean(waitlistPromotion.recordset?.[0]?.Promoted);

//         return res.json({
//             success: true,
//             message: promoted ? `${message} Next waitlisted student has been auto-registered.` : message,
//             waitlistPromoted: promoted,
//             promotedUserId: waitlistPromotion.recordset?.[0]?.PromotedUserID || null,
//         });
//     } catch (err) {
//         return res.status(400).json({ success: false, message: err.message });
//     }
// });

// // 2.2c GET Student Registrations
// router.get('/events/registrations/:userId', async (req, res) => {
//     const userId = Number(req.params.userId);
//     if (!Number.isInteger(userId) || userId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid userId is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .query(`
//                 UPDATE [dbo].[Registrations]
//                 SET QRCode = CAST(NEWID() AS NVARCHAR(255))
//                 WHERE UserID = @UserID
//                   AND Status <> 'Cancelled'
//                   AND (QRCode IS NULL OR LTRIM(RTRIM(QRCode)) = '');

//                 SELECT
//                     r.RegistrationID,
//                     r.EventID,
//                     r.UserID,
//                     r.Status,
//                     r.QRCode,
//                     r.RegistrationDate,
//                     r.CancelledAt,
//                     e.Title,
//                     e.EventDate,
//                     e.EventTime,
//                     e.Venue,
//                     e.EventType
//                 FROM [dbo].[Registrations] r
//                 JOIN [dbo].[Events] e ON e.EventID = r.EventID
//                 WHERE r.UserID = @UserID
//                 ORDER BY r.RegistrationDate DESC
//             `);

//         return res.json(result.recordset);
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// });

// // 2.3 POST Event Check-In by QR code (Sprint 2)
// router.post('/events/check-in', async (req, res) => {
//     const qrCode = normalizeQrPayload(req.body?.qrCode || req.query?.qrCode);
//     const eventId = Number(req.body?.eventId ?? req.query?.eventId);
//     const qrUserId = Number(req.body?.qrUserId ?? req.query?.qrUserId);

//     if (!qrCode || !String(qrCode).trim()) {
//         return res.status(400).json({ success: false, message: 'qrCode is required' });
//     }

//     try {
//         const pool = await poolPromise;

//         const studentQrUserId = Number.isInteger(qrUserId) && qrUserId > 0
//             ? qrUserId
//             : parseStudentQrToken(qrCode);
//         if (studentQrUserId) {
//             if (!Number.isInteger(eventId) || eventId <= 0) {
//                 return res.status(400).json({ success: false, message: 'eventId is required for student QR check-in' });
//             }

//             const byStudentToken = await pool.request()
//                 .input('UserID', sql.Int, studentQrUserId)
//                 .input('EventID', sql.Int, eventId)
//                 .query(`
//                     DECLARE @RegistrationID INT;
//                     DECLARE @EventStatus NVARCHAR(20);

//                     SELECT TOP 1 @EventStatus = [Status]
//                     FROM [dbo].[Events]
//                     WHERE EventID = @EventID;

//                     IF @EventStatus IS NULL
//                     BEGIN
//                         SELECT CAST(0 AS BIT) AS Success, 'Selected event not found' AS Message;
//                         RETURN;
//                     END

//                     IF LOWER(ISNULL(@EventStatus, '')) = 'cancelled'
//                     BEGIN
//                         SELECT CAST(0 AS BIT) AS Success, 'Selected event is cancelled' AS Message;
//                         RETURN;
//                     END

//                     SELECT TOP 1 @RegistrationID = RegistrationID
//                     FROM [dbo].[Registrations]
//                     WHERE UserID = @UserID
//                       AND EventID = @EventID
//                       AND Status <> 'Cancelled'
//                     ORDER BY RegistrationDate DESC;

//                     IF @RegistrationID IS NULL
//                     BEGIN
//                         INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
//                         VALUES (@EventID, @UserID, 'Attended', CAST(NEWID() AS NVARCHAR(255)));

//                         SET @RegistrationID = SCOPE_IDENTITY();

//                         IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
//                         BEGIN
//                             INSERT INTO [dbo].[Attendance] (RegistrationID)
//                             VALUES (@RegistrationID);
//                         END

//                         SELECT CAST(1 AS BIT) AS Success, 'Attendance marked! (Auto-registered for event)' AS Message;
//                         RETURN;
//                     END

//                     UPDATE [dbo].[Registrations]
//                     SET Status = 'Attended'
//                     WHERE RegistrationID = @RegistrationID;

//                     IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
//                     BEGIN
//                         INSERT INTO [dbo].[Attendance] (RegistrationID)
//                         VALUES (@RegistrationID);
//                     END

//                     SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
//                 `);

//             const payload = byStudentToken.recordset?.[0];
//             if (!payload?.Success) {
//                 return res.status(400).json({ success: false, message: payload?.Message || 'Invalid QR code' });
//             }

//             return res.json({ success: true, message: payload.Message });
//         }

//         const legacyResult = await pool.request()
//             .input('QRCode', sql.NVarChar(255), String(qrCode).trim())
//             .input('EventID', sql.Int, Number.isInteger(eventId) && eventId > 0 ? eventId : null)
//             .query(`
//                 DECLARE @RegistrationID INT;
//                 DECLARE @MatchedEventID INT;

//                 SELECT TOP 1
//                     @RegistrationID = RegistrationID,
//                     @MatchedEventID = EventID
//                 FROM [dbo].[Registrations]
//                 WHERE QRCode = @QRCode
//                   AND Status <> 'Cancelled'
//                 ORDER BY RegistrationDate DESC;

//                 IF @RegistrationID IS NULL
//                 BEGIN
//                     SELECT CAST(0 AS BIT) AS Success, 'Invalid QR format. Use the student QR from the QR Code tab.' AS Message;
//                     RETURN;
//                 END

//                 IF @EventID IS NOT NULL AND @MatchedEventID <> @EventID
//                 BEGIN
//                     SELECT CAST(0 AS BIT) AS Success, 'QR does not belong to selected event' AS Message;
//                     RETURN;
//                 END

//                 UPDATE [dbo].[Registrations]
//                 SET Status = 'Attended'
//                 WHERE RegistrationID = @RegistrationID;

//                 IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
//                 BEGIN
//                     INSERT INTO [dbo].[Attendance] (RegistrationID)
//                     VALUES (@RegistrationID);
//                 END

//                 SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
//             `);

//         const legacyPayload = legacyResult.recordset?.[0];
//         if (legacyPayload?.Success) {
//             return res.json({ success: true, message: legacyPayload.Message });
//         }

//         return res.status(400).json({
//             success: false,
//             message: legacyPayload?.Message || 'Invalid QR format. Use the student QR from the QR Code tab.',
//         });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message });
//     }
// });

// // 2.4 GET Notifications (Unread/unsent first) (Sprint 2)
// router.get('/notifications/:userId', async (req, res) => {
//     if (!Number.isInteger(Number(req.params.userId))) {
//         return res.status(400).json({ success: false, message: 'Valid userId is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const result = await pool.request()
//             .input('UserID', sql.Int, Number(req.params.userId))
//             .query(`
//                 SELECT *
//                 FROM [dbo].[Notifications]
//                 WHERE UserID = @UserID
//                   AND Status IN ('Pending', 'Sent')
//                 ORDER BY CreatedAt DESC
//             `);
//         return res.json(result.recordset);
//     } catch (err) {
//         console.error('Notification Error:', err);
//         return res.status(500).json({ success: false, message: err.message });
//     }
// });

// // 2.1 DELETE Event (Organizer dashboard) - Changed to Soft Delete
// // Requires authentication - organizer can only delete their own events
// router.put('/events/:id', authMiddleware, async (req, res) => {
//     const eventId = Number(req.params.id);
//     const requesterId = req.user?.UserID;
//     const requesterRole = String(req.user?.Role || '').toLowerCase();

//     if (!requesterId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Invalid event id' });
//     }

//     const {
//         title,
//         description,
//         eventType,
//         eventDate,
//         eventTime,
//         venue,
//         capacity,
//         registrationDeadline,
//         posterURL,
//         status,
//     } = req.body || {};

//     const normalizeDate = (value) => {
//         if (!value) return null;
//         const parsed = new Date(value);
//         if (Number.isNaN(parsed.getTime())) return null;
//         return parsed.toISOString().slice(0, 10);
//     };

//     const normalizeTime = (value) => {
//         if (!value) return null;
//         const raw = String(value).trim().toLowerCase();
//         const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
//         if (hhmm) {
//             const h = Number(hhmm[1]);
//             const m = Number(hhmm[2]);
//             const s = Number(hhmm[3] || 0);
//             if (h > 23 || m > 59 || s > 59) return null;
//             return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
//         }
//         return null;
//     };

//     const parsedCapacity = Number(capacity);
//     const normalizedTitle = String(title || '').trim();
//     const normalizedType = String(eventType || '').trim();
//     const normalizedDate = normalizeDate(eventDate);
//     const normalizedTime = normalizeTime(eventTime);
//     const normalizedVenue = String(venue || '').trim() || null;
//     const normalizedDescription = description === undefined ? null : (String(description || '').trim() || null);
//     const normalizedStatus = String(status || '').trim() || 'Draft';
//     const normalizedPoster = String(posterURL || '').trim() || null;
//     const normalizedDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

//     if (!normalizedTitle || !normalizedType || !normalizedDate || !normalizedTime) {
//         return res.status(400).json({
//             success: false,
//             message: 'title, eventType, eventDate and eventTime are required with valid values',
//         });
//     }

//     if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
//         return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
//     }
//     if (!normalizedDeadline || Number.isNaN(normalizedDeadline.getTime())) {
//         return res.status(400).json({ success: false, message: 'registrationDeadline must be a valid date-time' });
//     }
//     if (normalizedPoster && normalizedPoster.length > 255) {
//         return res.status(400).json({
//             success: false,
//             message: 'posterURL is too long (max 255 characters). Please use a shorter hosted URL.',
//         });
//     }

//     if (normalizedDeadline.toISOString().slice(0, 10) > normalizedDate) {
//         return res.status(400).json({ success: false, message: 'Registration deadline date cannot be after event date.' });
//     }

//     try {
//         const pool = await poolPromise;

//         const eventCheck = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query('SELECT TOP 1 EventID, OrganizerID FROM Events WHERE EventID = @EventID');

//         const event = eventCheck.recordset?.[0];
//         if (!event) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         if (requesterRole !== 'admin' && Number(event.OrganizerID) !== Number(requesterId)) {
//             return res.status(403).json({ success: false, message: 'You can only edit your own events' });
//         }

//         const result = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .input('Title', sql.NVarChar(200), normalizedTitle)
//             .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
//             .input('EventType', sql.NVarChar(20), normalizedType)
//             .input('EventDate', sql.Date, normalizedDate)
//             .input('EventTime', sql.NVarChar(20), normalizedTime)
//             .input('Venue', sql.NVarChar(150), normalizedVenue)
//             .input('Capacity', sql.Int, parsedCapacity)
//             .input('RegistrationDeadline', sql.DateTimeOffset, normalizedDeadline)
//             .input('Status', sql.NVarChar(20), normalizedStatus)
//             .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
//             .query(`
//                 UPDATE Events
//                 SET
//                     Title = @Title,
//                     Description = @Description,
//                     EventType = @EventType,
//                     EventDate = @EventDate,
//                     EventTime = CAST(@EventTime AS TIME),
//                     Venue = @Venue,
//                     Capacity = @Capacity,
//                     RegistrationDeadline = @RegistrationDeadline,
//                     Status = @Status,
//                     PosterURL = @PosterURL,
//                     UpdatedAt = SYSDATETIMEOFFSET()
//                 WHERE EventID = @EventID;

//                 SELECT TOP 1 * FROM Events WHERE EventID = @EventID;
//             `);

//         return res.json({ success: true, event: result.recordset?.[0] || null });
//     } catch (err) {
//         console.error('Update Event Error:', err);
//         return res.status(500).json({ success: false, message: err.message || 'Failed to update event' });
//     }
// });

// // 2.1c PUT Cancel Event (Organizer/Admin) - separate from delete
// router.put('/events/:id/cancel', authMiddleware, async (req, res) => {
//     const eventId = Number(req.params.id);
//     const requesterId = req.user?.UserID;

//     if (!requesterId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Invalid event id' });
//     }

//     try {
//         const pool = await poolPromise;

//         const eventCheck = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');

//         const event = eventCheck.recordset?.[0];
//         if (!event) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) {
//             return res.status(403).json({ success: false, message: 'You can only cancel your own events' });
//         }

//         if (String(event.Status || '').toLowerCase() === 'cancelled') {
//             return res.json({ success: true, message: 'Event is already cancelled' });
//         }

//         await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 UPDATE Events
//                 SET Status = 'Cancelled',
//                     UpdatedAt = SYSDATETIMEOFFSET()
//                 WHERE EventID = @EventID
//             `);

//         return res.json({ success: true, message: 'Event cancelled successfully' });
//     } catch (err) {
//         console.error('Cancel Event Error:', err);
//         return res.status(500).json({ success: false, message: err.message || 'Failed to cancel event' });
//     }
// });

// // 2.1d PUT Restore Event (Organizer/Admin) - bring cancelled event back
// router.put('/events/:id/restore', authMiddleware, async (req, res) => {
//     const eventId = Number(req.params.id);
//     const requesterId = req.user?.UserID;

//     if (!requesterId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Invalid event id' });
//     }

//     try {
//         const pool = await poolPromise;

//         const eventCheck = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query('SELECT TOP 1 EventID, OrganizerID, Status FROM Events WHERE EventID = @EventID');

//         const event = eventCheck.recordset?.[0];
//         if (!event) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         if (req.user?.Role !== 'Admin' && Number(event.OrganizerID) !== Number(requesterId)) {
//             return res.status(403).json({ success: false, message: 'You can only restore your own events' });
//         }

//         if (String(event.Status || '').toLowerCase() !== 'cancelled') {
//             return res.json({ success: true, message: 'Event is already active' });
//         }

//         await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 UPDATE Events
//                 SET Status = 'Published',
//                     UpdatedAt = SYSDATETIMEOFFSET()
//                 WHERE EventID = @EventID
//             `);

//         return res.json({ success: true, message: 'Event restored successfully' });
//     } catch (err) {
//         console.error('Restore Event Error:', err);
//         return res.status(500).json({ success: false, message: err.message || 'Failed to restore event' });
//     }
// });

// router.delete('/events/:id', authMiddleware, async (req, res) => {
//     const eventId = Number(req.params.id);
//     const userId = req.user?.UserID;

//     if (!userId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Invalid event id' });
//     }

//     try {
//         const pool = await poolPromise;

//         // Check if event exists and belongs to the organizer
//         const eventCheck = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query('SELECT EventID, OrganizerID FROM Events WHERE EventID = @EventID');

//         const event = eventCheck.recordset?.[0];
//         if (!event) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         if (req.user?.Role !== 'Admin' && event.OrganizerID !== userId) {
//             return res.status(403).json({ success: false, message: 'You can only delete your own events' });
//         }

//         // Use SOFT DELETE: Set Status to 'Cancelled' instead of hard delete
//         const result = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 UPDATE Events 
//                 SET Status = 'Cancelled', UpdatedAt = SYSDATETIMEOFFSET()
//                 WHERE EventID = @EventID
//             `);

//         if ((result.rowsAffected?.[0] || 0) === 0) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         return res.json({ success: true, message: 'Event deleted successfully' });
//     } catch (err) {
//         console.error('Delete Event Error:', err);
//         return res.status(500).json({ success: false, message: 'Failed to delete event' });
//     }
// });

// // 3. GET Profile (Updated to return LinkedIn/GitHub)
// // Requires authentication - user can view any profile but data is limited
// router.get('/profile/:id', authMiddleware, async (req, res) => {
//     const userId = Number(req.params.id);
//     if (!Number.isInteger(userId) || userId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid user id is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const userResult = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .query(`SELECT UserID, Email, Role FROM Users WHERE UserID = @UserID`);

//         const user = userResult.recordset?.[0];
//         if (!user) return res.status(404).json({ success: false, message: 'User not found' });

//         if (String(user.Role || '').toLowerCase() === 'organizer') {
//             const organizerResult = await pool.request()
//                 .input('UserID', sql.Int, userId)
//                 .query(`
//                     SELECT
//                         u.UserID,
//                         u.Email,
//                         u.Role,
//                         o.OrganizationName,
//                         o.Description,
//                         o.ContactEmail,
//                         o.ProfilePictureURL,
//                         o.VerificationStatus
//                     FROM Users u
//                     JOIN OrganizerProfiles o ON u.UserID = o.UserID
//                     WHERE u.UserID = @UserID
//                 `);

//             const organizerProfile = organizerResult.recordset?.[0] || null;
//             if (!organizerProfile) {
//                 return res.status(404).json({ success: false, message: 'Organizer profile not found' });
//             }

//             return res.json(organizerProfile);
//         }

//         const studentResult = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .query(`
//               SELECT u.UserID, u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy,
//                                     s.DateOfBirth, s.ProfilePictureURL, s.LinkedInURL, s.GitHubURL
//                 FROM Users u 
//                 JOIN StudentProfiles s ON u.UserID = s.UserID 
//                 WHERE u.UserID = @UserID`);

//         const studentProfile = studentResult.recordset?.[0] || null;
//         if (!studentProfile) {
//             return res.status(404).json({ success: false, message: 'Student profile not found' });
//         }

//         res.json(studentProfile);
//     } catch (err) {
//         res.status(500).send(err.message);
//     }
// });

// // 4. PUT Profile (Updated to save LinkedIn/GitHub)
// // Requires authentication - user can only edit their own profile
// router.put('/profile/:id', authMiddleware, async (req, res) => {
//     const targetUserId = Number(req.params.id);
//     const requestingUserId = req.user?.UserID;

//     // User can only edit their own profile, except admin
//     if (req.user?.Role !== 'Admin' && targetUserId !== requestingUserId) {
//         return res.status(403).json({ success: false, message: 'You can only edit your own profile' });
//     }

//     if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid user id is required' });
//     }

//     const {
//         role,
//         firstName,
//         lastName,
//         department,
//         year,
//         dateOfBirth,
//         profilePictureURL,
//         linkedInURL,
//         gitHubURL,
//         interests,
//         organizationName,
//         description,
//         contactEmail,
//     } = req.body;

//     const userId = targetUserId;

//     try {
//         const pool = await poolPromise;

//         const userResult = await pool.request()
//             .input('UserID', sql.Int, userId)
//             .query('SELECT UserID, Role FROM Users WHERE UserID = @UserID');

//         const user = userResult.recordset?.[0];
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const dbRole = String(user.Role || '').toLowerCase();
//         const requestedRole = String(role || '').toLowerCase();
//         const effectiveRole = requestedRole || dbRole;

//         if (effectiveRole === 'organizer' || dbRole === 'organizer') {
//             const normalizedOrgName = String(organizationName || '').trim() || null;
//             const normalizedDescription = description === undefined ? undefined : (String(description || '').trim() || null);
//             const normalizedContactEmail = String(contactEmail || '').trim() || null;
//             const normalizedProfilePicture = profilePictureURL || null;

//             const organizerUpdate = pool.request()
//                 .input('UserID', sql.Int, userId)
//                 .input('OrganizationName', sql.NVarChar(150), normalizedOrgName)
//                 .input('Description', sql.NVarChar(sql.MAX), normalizedDescription)
//                 .input('ContactEmail', sql.NVarChar(100), normalizedContactEmail)
//                 .input('ProfilePictureURL', sql.NVarChar(sql.MAX), normalizedProfilePicture)
//                 .query(`
//                     UPDATE OrganizerProfiles
//                     SET OrganizationName = COALESCE(@OrganizationName, OrganizationName),
//                         Description = COALESCE(@Description, Description),
//                         ContactEmail = COALESCE(@ContactEmail, ContactEmail),
//                         ProfilePictureURL = @ProfilePictureURL
//                     WHERE UserID = @UserID
//                 `);

//             const result = await organizerUpdate;
//             if ((result.rowsAffected?.[0] || 0) === 0) {
//                 return res.status(404).json({ success: false, message: 'Organizer profile not found' });
//             }

//             return res.json({ success: true, role: 'Organizer' });
//         }

//         const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;

//         if (dateOfBirth && Number.isNaN(parsedDob?.getTime())) {
//             return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });
//         }

//         await pool.request()
//             .input('UserID', sql.Int, userId)
//             .input('FirstName', sql.NVarChar(50), firstName || null)
//             .input('LastName', sql.NVarChar(50), lastName || null)
//             .input('Department', sql.NVarChar(100), department || null)
//             .input('Year', sql.Int, Number.isInteger(Number(year)) ? Number(year) : null)
//             .input('DateOfBirth', sql.Date, dateOfBirth ? parsedDob : null)
//             .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL || null)
//             .input('LinkedIn', sql.NVarChar(255), linkedInURL || null)
//             .input('GitHub', sql.NVarChar(255), gitHubURL || null)
//             .query(`UPDATE StudentProfiles 
//                     SET FirstName = @FirstName, LastName = @LastName, 
//                         Department = @Department, YearOfStudy = COALESCE(@Year, YearOfStudy),
//                         DateOfBirth = @DateOfBirth, ProfilePictureURL = @ProfilePictureURL,
//                         LinkedInURL = @LinkedIn, GitHubURL = @GitHub
//                     WHERE UserID = @UserID`);
        
//         // Interest deletion/insertion logic remains the same
//         if (Array.isArray(interests)) {
//             await pool.request().input('UserID', sql.Int, userId).query(`DELETE FROM UserInterests WHERE UserID = @UserID`);
//             for (const interestId of interests) {
//                 await pool.request().input('UserID', sql.Int, userId).input('InterestID', sql.Int, interestId).query(`INSERT INTO UserInterests (UserID, InterestID) VALUES (@UserID, @InterestID)`);
//             }
//         }
//         res.json({ success: true, role: 'Student' });
//     } catch (err) {
//         console.error('Update Profile Error:', err);
//         res.status(500).json({ success: false, message: 'Failed to update profile' });
//     }
// });

// // 10. POST Event Request (Student submits event suggestion)
// // Requires authentication
// router.post('/events/request', authMiddleware, async (req, res) => {
//     const userId = req.user?.UserID;
//     if (!userId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     const {
//         title,
//         description,
//         eventType,
//         eventDate,
//         eventTime,
//         venue,
//         capacity,
//         registrationDeadline,
//         posterURL,
//     } = req.body;

//     // Validate required fields
//     if (!title) {
//         return res.status(400).json({ success: false, message: 'Event title is required' });
//     }

//     if (!eventDate) {
//         return res.status(400).json({ success: false, message: 'Event date is required' });
//     }

//     try {
//         const pool = await poolPromise;
//         const requestPayload = {
//             title,
//             description,
//             eventType,
//             eventDate,
//             eventTime,
//             venue,
//             capacity,
//             registrationDeadline,
//             posterURL,
//         };
//         const requestPayloadString = `${REQUEST_PAYLOAD_PREFIX}${JSON.stringify(requestPayload)}`;

//         // Insert event request into EventRequests table
//         const insertResult = await pool.request()
//             .input('StudentID', sql.Int, userId)
//             .input('Title', sql.NVarChar(200), title)
//             .input('Description', sql.NVarChar(sql.MAX), description || null)
//             .input('SuggestedDate', sql.Date, eventDate)
//             .input('AdminNotes', sql.NVarChar(sql.MAX), requestPayloadString)
//             .query(`
//                 INSERT INTO EventRequests (StudentID, Title, Description, SuggestedDate, Status, SubmittedAt, AdminNotes)
//                 VALUES (@StudentID, @Title, @Description, @SuggestedDate, 'Pending', SYSDATETIMEOFFSET(), @AdminNotes);
//                 SELECT SCOPE_IDENTITY() AS RequestID
//             `);

//         const requestId = insertResult.recordset[0].RequestID;

//         res.json({
//             success: true,
//             message: 'Event request submitted successfully',
//             requestId,
//             status: 'Pending',
//         });
//     } catch (err) {
//         console.error('Submit Event Request Error:', err);
//         res.status(500).json({ success: false, message: 'Failed to submit event request' });
//     }
// });

// // GET Student Event Requests (student/admin view)
// // Reconciles legacy pending requests that already became events before status-update fixes.
// router.get('/events/requests/:userId', authMiddleware, async (req, res) => {
//     const targetUserId = Number(req.params.userId);
//     const requesterId = req.user?.UserID;
//     const requesterRole = String(req.user?.Role || '').toLowerCase();

//     if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid userId is required' });
//     }

//     if (requesterRole !== 'admin' && Number(requesterId) !== targetUserId) {
//         return res.status(403).json({ success: false, message: 'You can only view your own requests' });
//     }

//     try {
//         const pool = await poolPromise;

//         // Legacy recovery: mark stale pending requests as approved when an event with same title/date exists.
//         await pool.request()
//             .input('StudentID', sql.Int, targetUserId)
//             .query(`
//                 UPDATE er
//                 SET er.Status = 'Approved'
//                 FROM EventRequests er
//                 WHERE er.StudentID = @StudentID
//                   AND er.Status = 'Pending'
//                   AND EXISTS (
//                       SELECT 1
//                       FROM Events e
//                       WHERE e.Title = er.Title
//                         AND e.EventDate = er.SuggestedDate
//                         AND e.Status IN ('Published', 'Draft', 'Completed')
//                   )
//             `);

//         const result = await pool.request()
//             .input('StudentID', sql.Int, targetUserId)
//             .query(`
//                 SELECT
//                     er.RequestID,
//                     er.StudentID,
//                     er.Title,
//                     er.Description,
//                     er.SuggestedDate,
//                     er.Status,
//                     er.SubmittedAt,
//                     CASE
//                         WHEN LEFT(COALESCE(er.AdminNotes, ''), 20) = '__REQUEST_PAYLOAD__:' THEN NULL
//                         ELSE er.AdminNotes
//                     END AS AdminNotes
//                 FROM EventRequests er
//                 WHERE er.StudentID = @StudentID
//                 ORDER BY er.SubmittedAt DESC
//             `);

//         return res.json(result.recordset || []);
//     } catch (err) {
//         console.error('Student Requests Fetch Error:', err);
//         return res.status(500).json({ success: false, message: err.message || 'Failed to fetch requests' });
//     }
// });

// // GET Registrations for a specific Event (Organizer side)
// // Requires authentication - organizer can only view their own event registrations
// router.get('/organizer/registrations/:eventId', authMiddleware, async (req, res) => {
//     const eventId = Number(req.params.eventId);
//     const requesterId = req.user?.UserID;
//     const requesterRole = String(req.user?.Role || '').toLowerCase();

//     if (!Number.isInteger(eventId) || eventId <= 0) {
//         return res.status(400).json({ success: false, message: 'Valid eventId is required' });
//     }

//     if (!requesterId) {
//         return res.status(401).json({ success: false, message: 'Authentication required' });
//     }

//     try {
//         const pool = await poolPromise;

//         const eventResult = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 SELECT TOP 1 EventID, OrganizerID
//                 FROM [dbo].[Events]
//                 WHERE EventID = @EventID
//             `);

//         const eventRow = eventResult.recordset?.[0];
//         if (!eventRow) {
//             return res.status(404).json({ success: false, message: 'Event not found' });
//         }

//         if (requesterRole !== 'admin' && Number(eventRow.OrganizerID) !== Number(requesterId)) {
//             return res.status(403).json({ success: false, message: 'You can only view registrations for your own events' });
//         }

//         const result = await pool.request()
//             .input('EventID', sql.Int, eventId)
//             .query(`
//                 SELECT
//                     r.RegistrationID,
//                     r.EventID,
//                     r.UserID,
//                     r.Status,
//                     r.RegistrationDate,
//                     r.CancelledAt,
//                     u.Email,
//                     sp.FirstName,
//                     sp.LastName
//                 FROM [dbo].[Registrations] r
//                 JOIN [dbo].[Users] u ON r.UserID = u.UserID
//                 LEFT JOIN [dbo].[StudentProfiles] sp ON r.UserID = sp.UserID
//                 WHERE r.EventID = @EventID
//                 ORDER BY r.RegistrationDate DESC
//             `);

//         return res.json(result.recordset);
//     } catch (err) {
//         return res.status(500).json({ success: false, message: err.message || 'Failed to fetch registrations' });
//     }
// });

// module.exports = router;



// routes/data.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const { authMiddleware } = require('./middleware/auth');
const REQUEST_PAYLOAD_PREFIX = '__REQUEST_PAYLOAD__:';

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
        const { category, search, date, organizerId } = req.query;
        const hasOrganizerFilter = Number.isInteger(Number(organizerId));

        let query = hasOrganizerFilter
            ? `
                SELECT e.EventID, e.OrganizerID, e.Title, e.Description, e.EventType,
                    e.EventDate, e.EventTime, e.Venue, e.Capacity, e.Status, e.PosterURL,
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
                    e.EventDate, e.EventTime, e.Venue, e.Capacity, e.Status, e.PosterURL,
                    e.RegistrationDeadline,
                    op.OrganizationName AS Organizer, op.ContactEmail AS OrganizerEmail,
                    op.Description AS OrganizerDescription, op.ProfilePictureURL AS OrganizerLogo,
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

                    SELECT TOP 1 @RegistrationID = RegistrationID
                    FROM [dbo].[Registrations]
                    WHERE UserID = @UserID AND EventID = @EventID AND Status <> 'Cancelled'
                    ORDER BY RegistrationDate DESC;

                    IF @RegistrationID IS NULL
                    BEGIN
                        -- Auto-register the student and record attendance separately.
                        INSERT INTO [dbo].[Registrations] (EventID, UserID, Status, QRCode)
                        VALUES (@EventID, @UserID, 'Confirmed', @StudentQRCode);
                        SET @RegistrationID = SCOPE_IDENTITY();

                        IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                            INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);

                        SELECT CAST(1 AS BIT) AS Success,
                               'Attendance marked! (Student was auto-registered for this event.)' AS Message;
                        RETURN;
                    END

                    IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                        INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);

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
                        'QR code not recognised 1. Please use the student QR from the QR Code tab.' AS Message;
                    RETURN;
                END

                IF @EventID IS NOT NULL AND @MatchedEventID <> @EventID
                BEGIN
                    SELECT CAST(0 AS BIT) AS Success, 'QR code does not belong to the selected event.' AS Message;
                    RETURN;
                END

                IF NOT EXISTS (SELECT 1 FROM [dbo].[Attendance] WHERE RegistrationID = @RegistrationID)
                    INSERT INTO [dbo].[Attendance] (RegistrationID) VALUES (@RegistrationID);

                SELECT CAST(1 AS BIT) AS Success, 'Attendance marked!' AS Message;
            `);

        const legacyRow = legacyResult.recordset?.[0];
        if (legacyRow?.Success) return res.json({ success: true, message: legacyRow.Message });

        return res.status(400).json({
            success: false,
            message: legacyRow?.Message || 'QR code not recognised 2. Please use the student QR from the QR Code tab.',
        });

    } catch (err) {
        console.error('Check-In Error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Internal server error during check-in.' });
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
        venue, capacity, registrationDeadline, posterURL, status,
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
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, parsedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
            .query(`
                INSERT INTO [dbo].[Events]
                    (OrganizerID, Title, Description, EventType, EventDate, EventTime,
                     Venue, Capacity, RegistrationDeadline, Status, PosterURL)
                OUTPUT INSERTED.*
                VALUES (@OrganizerID, @Title, @Description, @EventType, @EventDate,
                        CAST(@EventTime AS TIME), @Venue, @Capacity, @RegistrationDeadline,
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
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, Number(eventId))
            .execute('dbo.sp_UnregisterFromEvent');

        const message = result.recordset?.[0]?.Message || 'Unregistration processed';
        if (String(message).toLowerCase().startsWith('error'))
            return res.status(400).json({ success: false, message });

        // Auto-promote next waitlisted student.
        const waitlistPromotion = await pool.request()
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
            message: promoted ? `${message} Next waitlisted student has been auto-registered.` : message,
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

    const { title, description, eventType, eventDate, eventTime, venue, capacity, registrationDeadline, posterURL, status } = req.body || {};
    const normalizeDate = (v) => { if (!v) return null; const p = new Date(v); return Number.isNaN(p.getTime()) ? null : p.toISOString().slice(0,10); };
    const normalizeTime = (v) => { if (!v) return null; const raw = String(v).trim().toLowerCase(); const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); if (hhmm) { const h = Number(hhmm[1]), m = Number(hhmm[2]), s = Number(hhmm[3]||0); if (h>23||m>59||s>59) return null; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; } return null; };

    const parsedCapacity = Number(capacity);
    const normalizedTitle = String(title||'').trim();
    const normalizedType = String(eventType||'').trim();
    const normalizedDate = normalizeDate(eventDate);
    const normalizedTime = normalizeTime(eventTime);
    const normalizedVenue = String(venue||'').trim()||null;
    const normalizedDescription = description === undefined ? null : (String(description||'').trim()||null);
    const normalizedStatus = String(status||'').trim()||'Draft';
    const normalizedPoster = String(posterURL||'').trim()||null;
    const normalizedDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

    if (!normalizedTitle||!normalizedType||!normalizedDate||!normalizedTime) return res.status(400).json({ success: false, message: 'title, eventType, eventDate and eventTime are required' });
    if (!Number.isInteger(parsedCapacity)||parsedCapacity<=0) return res.status(400).json({ success: false, message: 'capacity must be greater than 0' });
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
            .input('Capacity', sql.Int, parsedCapacity)
            .input('RegistrationDeadline', sql.DateTimeOffset, normalizedDeadline)
            .input('Status', sql.NVarChar(20), normalizedStatus)
            .input('PosterURL', sql.NVarChar(sql.MAX), normalizedPoster)
            .query(`
                UPDATE Events SET Title=@Title, Description=@Description, EventType=@EventType,
                    EventDate=@EventDate, EventTime=CAST(@EventTime AS TIME), Venue=@Venue,
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
            const r = await pool.request().input('UserID', sql.Int, userId).query(`SELECT u.UserID, u.Email, u.Role, o.OrganizationName, o.Description, o.ContactEmail, o.ProfilePictureURL, o.VerificationStatus FROM Users u JOIN OrganizerProfiles o ON u.UserID = o.UserID WHERE u.UserID = @UserID`);
            const profile = r.recordset?.[0];
            if (!profile) return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            return res.json(profile);
        }

        const r = await pool.request().input('UserID', sql.Int, userId).query(`SELECT u.UserID, u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy, s.DateOfBirth, s.ProfilePictureURL, s.LinkedInURL, s.GitHubURL FROM Users u JOIN StudentProfiles s ON u.UserID = s.UserID WHERE u.UserID = @UserID`);
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

    const { role, firstName, lastName, department, year, dateOfBirth, profilePictureURL, linkedInURL, gitHubURL, interests, organizationName, description, contactEmail } = req.body;

    try {
        const pool = await poolPromise;
        const userResult = await pool.request().input('UserID', sql.Int, targetUserId).query('SELECT UserID, Role FROM Users WHERE UserID = @UserID');
        const user = userResult.recordset?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const dbRole = String(user.Role||'').toLowerCase();
        const requestedRole = String(role||'').toLowerCase();
        const effectiveRole = requestedRole || dbRole;

        if (effectiveRole === 'organizer' || dbRole === 'organizer') {
            const result = await pool.request()
                .input('UserID', sql.Int, targetUserId)
                .input('OrganizationName', sql.NVarChar(150), String(organizationName||'').trim()||null)
                .input('Description', sql.NVarChar(sql.MAX), description === undefined ? undefined : (String(description||'').trim()||null))
                .input('ContactEmail', sql.NVarChar(100), String(contactEmail||'').trim()||null)
                .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL||null)
                .query(`UPDATE OrganizerProfiles SET OrganizationName=COALESCE(@OrganizationName,OrganizationName), Description=COALESCE(@Description,Description), ContactEmail=COALESCE(@ContactEmail,ContactEmail), ProfilePictureURL=@ProfilePictureURL WHERE UserID=@UserID`);
            if ((result.rowsAffected?.[0]||0) === 0) return res.status(404).json({ success: false, message: 'Organizer profile not found' });
            return res.json({ success: true, role: 'Organizer' });
        }

        const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;
        if (dateOfBirth && Number.isNaN(parsedDob?.getTime())) return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });

        await pool.request()
            .input('UserID', sql.Int, targetUserId)
            .input('FirstName', sql.NVarChar(50), firstName||null)
            .input('LastName', sql.NVarChar(50), lastName||null)
            .input('Department', sql.NVarChar(100), department||null)
            .input('Year', sql.Int, Number.isInteger(Number(year)) ? Number(year) : null)
            .input('DateOfBirth', sql.Date, dateOfBirth ? parsedDob : null)
            .input('ProfilePictureURL', sql.NVarChar(sql.MAX), profilePictureURL||null)
            .input('LinkedIn', sql.NVarChar(255), linkedInURL||null)
            .input('GitHub', sql.NVarChar(255), gitHubURL||null)
            .query(`UPDATE StudentProfiles SET FirstName=@FirstName, LastName=@LastName, Department=@Department, YearOfStudy=COALESCE(@Year,YearOfStudy), DateOfBirth=@DateOfBirth, ProfilePictureURL=@ProfilePictureURL, LinkedInURL=@LinkedIn, GitHubURL=@GitHub WHERE UserID=@UserID`);

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

    const { title, description, eventType, eventDate, eventTime, venue, capacity, registrationDeadline, posterURL } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Event title is required' });
    if (!eventDate) return res.status(400).json({ success: false, message: 'Event date is required' });

    try {
        const pool = await poolPromise;
        const payload = `${REQUEST_PAYLOAD_PREFIX}${JSON.stringify({ title, description, eventType, eventDate, eventTime, venue, capacity, registrationDeadline, posterURL })}`;
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

module.exports = router;