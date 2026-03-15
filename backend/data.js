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

// 2.1 DELETE Event (Organizer dashboard)
router.delete('/events/:id', async (req, res) => {
    const eventId = Number(req.params.id);
    const organizerId = Number(req.query.organizerId || req.body?.organizerId || 0);

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    try {
        const pool = await poolPromise;
        const deleteRequest = pool.request().input('EventID', sql.Int, eventId);
        const hasOrganizer = Number.isInteger(organizerId) && organizerId > 0;

        let deleteSql = 'DELETE FROM Events WHERE EventID = @EventID';
        if (hasOrganizer) {
            deleteRequest.input('OrganizerID', sql.Int, organizerId);
            deleteSql += ' AND OrganizerID = @OrganizerID';
        }

        try {
            const result = await deleteRequest.query(deleteSql);
            if ((result.rowsAffected?.[0] || 0) === 0) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }
            return res.json({ success: true, message: 'Event deleted successfully' });
        } catch (deleteErr) {
            // If historical tables reference the event, archive it instead of hard-delete.
            if (deleteErr?.number === 547) {
                const archiveRequest = pool.request()
                    .input('EventID', sql.Int, eventId)
                    .input('Status', sql.NVarChar(20), 'Cancelled');

                let archiveSql = 'UPDATE Events SET Status = @Status WHERE EventID = @EventID';
                if (hasOrganizer) {
                    archiveRequest.input('OrganizerID', sql.Int, organizerId);
                    archiveSql += ' AND OrganizerID = @OrganizerID';
                }

                const archived = await archiveRequest.query(archiveSql);
                if ((archived.rowsAffected?.[0] || 0) === 0) {
                    return res.status(404).json({ success: false, message: 'Event not found' });
                }

                return res.json({
                    success: true,
                    softDeleted: true,
                    message: 'Event has registrations/achievements, so it was archived as Cancelled instead of hard-deleted.',
                });
            }
            throw deleteErr;
        }
    } catch (err) {
        console.error('Delete Event Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

// 3. GET Profile (Uses StudentProfiles table)
router.get('/profile/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`SELECT UserID, Email, Role FROM Users WHERE UserID = @UserID`);

        const user = userResult.recordset?.[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.Role === 'Organizer') {
            const organizerResult = await pool.request()
                .input('UserID', sql.Int, req.params.id)
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
            return res.json(organizerResult.recordset?.[0] || null);
        }

        const studentResult = await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query(`
                SELECT
                    u.UserID,
                    u.Email,
                    u.Role,
                    s.FirstName,
                    s.LastName,
                    s.Department,
                    s.YearOfStudy,
                    s.ProfilePictureURL
                FROM Users u
                JOIN StudentProfiles s ON u.UserID = s.UserID
                WHERE u.UserID = @UserID
            `);

        return res.json(studentResult.recordset?.[0] || null);
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

// 4. PUT Profile
router.put('/profile/:id', async (req, res) => {
    const {
        role,
        firstName,
        lastName,
        year,
        department,
        organizationName,
        description,
        profilePictureURL,
        interests,
    } = req.body;
    try {
        const pool = await poolPromise;
        const userId = Number(req.params.id);
        const normalizedRole = String(role || '').toLowerCase();
        const normalizedProfilePictureURL =
            typeof profilePictureURL === 'string' && profilePictureURL.length > 255
                ? null
                : (profilePictureURL || null);

        if (normalizedRole === 'organizer') {
            await pool.request()
                .input('UserID', sql.Int, userId)
                .input('OrganizationName', sql.NVarChar(150), organizationName || null)
                .input('Description', sql.NVarChar(sql.MAX), description || null)
                .input('ProfilePictureURL', sql.NVarChar(255), normalizedProfilePictureURL)
                .query(`
                    UPDATE OrganizerProfiles
                    SET
                        OrganizationName = COALESCE(@OrganizationName, OrganizationName),
                        Description = @Description,
                        ProfilePictureURL = @ProfilePictureURL
                    WHERE UserID = @UserID
                `);
            return res.json({ success: true });
        }

        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('FirstName', sql.NVarChar(50), firstName || null)
            .input('LastName', sql.NVarChar(50), lastName || null)
            .input('Department', sql.NVarChar(100), department || null)
            .input('Year', sql.Int, Number.isInteger(Number(year)) ? Number(year) : null)
            .input('ProfilePictureURL', sql.NVarChar(255), normalizedProfilePictureURL)
            .query(`
                UPDATE StudentProfiles
                SET
                    FirstName = COALESCE(@FirstName, FirstName),
                    LastName = COALESCE(@LastName, LastName),
                    Department = COALESCE(@Department, Department),
                    YearOfStudy = COALESCE(@Year, YearOfStudy),
                    ProfilePictureURL = @ProfilePictureURL
                WHERE UserID = @UserID
            `);

        if (Array.isArray(interests)) {
            await pool.request()
                .input('UserID', sql.Int, userId)
                .query(`DELETE FROM UserInterests WHERE UserID = @UserID`);

            for (const interestIdRaw of interests) {
                const interestId = Number(interestIdRaw);
                if (!Number.isInteger(interestId) || interestId <= 0) {
                    continue;
                }

                await pool.request()
                    .input('UserID', sql.Int, userId)
                    .input('InterestID', sql.Int, interestId)
                    .query(`INSERT INTO UserInterests (UserID, InterestID) VALUES (@UserID, @InterestID)`);
            }
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