const express = require('express');
const router = express.Router();

const { sql, poolPromise } = require('../db');
const { authMiddleware, studentMiddleware } = require('../middleware/auth');

const MAX_REVIEW_TEXT = 4000;
const MAX_RESPONSE_TEXT = 2000;

const parseRating = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) return null;
    return n;
};

const cleanText = (value, maxLen) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLen);
};

const getDateParts = (value) => {
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
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
    };
};

const getTimeParts = (value) => {
    if (!value) return { hour: 0, minute: 0, second: 0 };

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return {
            hour: value.getUTCHours(),
            minute: value.getUTCMinutes(),
            second: value.getUTCSeconds(),
        };
    }

    const raw = String(value).trim();
    const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
    if (timeOnly) {
        return {
            hour: Number(timeOnly[1]),
            minute: Number(timeOnly[2]),
            second: Number(timeOnly[3] || 0),
        };
    }

    const datetime = raw.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (datetime) {
        return {
            hour: Number(datetime[1]),
            minute: Number(datetime[2]),
            second: Number(datetime[3] || 0),
        };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { hour: 0, minute: 0, second: 0 };
    return {
        hour: parsed.getHours(),
        minute: parsed.getMinutes(),
        second: parsed.getSeconds(),
    };
};

const getEventStartTimeMs = (eventDate, eventTime) => {
    const dateParts = getDateParts(eventDate);
    if (!dateParts) return null;
    const timeParts = getTimeParts(eventTime);

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

const isEventCompleted = (event) => {
    const completedByStatus = String(event?.Status || '').toLowerCase() === 'completed';
    if (completedByStatus) return true;

    const scheduledStart = getEventStartTimeMs(event?.EventDate, event?.EventTime);
    if (!Number.isFinite(scheduledStart)) return false;

    // Current product behavior: review opens once the scheduled start time has passed.
    return Date.now() >= scheduledStart;
};

const mapReviewRow = (row) => ({
    reviewId: Number(row.ReviewID),
    eventId: Number(row.EventID),
    userId: Number(row.UserID),
    reviewerName: row.ReviewerName,
    reviewerDepartment: row.ReviewerDepartment || null,
    overallRating: Number(row.OverallRating),
    organizationQualityRating: Number(row.OrganizationQualityRating),
    contentQualityRating: Number(row.ContentQualityRating),
    venueRating: Number(row.VenueRating),
    valueForTimeRating: Number(row.ValueForTimeRating),
    reviewText: row.ReviewText || '',
    createdAt: row.CreatedAt,
    eventTitle: row.EventTitle,
    organizerId: Number(row.OrganizerID),
    organizationName: row.OrganizationName,
    response: row.ResponseID
        ? {
            responseId: Number(row.ResponseID),
            organizerId: Number(row.ResponseOrganizerID),
            organizationName: row.ResponseOrganizationName || row.OrganizationName,
            responseText: row.ResponseText,
            responseDate: row.ResponseDate,
        }
        : null,
});

async function fetchEventSummary(pool, eventId) {
    const summaryResult = await pool.request()
        .input('EventID', sql.Int, eventId)
        .query(`
            SELECT
                e.EventID,
                e.OrganizerID,
                e.Title,
                op.OrganizationName,
                COUNT(er.ReviewID) AS ReviewCount,
                CAST(AVG(CAST(er.OverallRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOverallRating,
                CAST(AVG(CAST(er.OrganizationQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOrganizationRating,
                CAST(AVG(CAST(er.ContentQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgContentRating,
                CAST(AVG(CAST(er.VenueRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgVenueRating,
                CAST(AVG(CAST(er.ValueForTimeRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgValueForTimeRating,
                CAST(
                    (
                        ISNULL(AVG(CAST(er.OverallRating AS FLOAT)), 0) * 0.40
                        + ISNULL(AVG(CAST(er.OrganizationQualityRating AS FLOAT)), 0) * 0.20
                        + ISNULL(AVG(CAST(er.ContentQualityRating AS FLOAT)), 0) * 0.20
                        + ISNULL(AVG(CAST(er.VenueRating AS FLOAT)), 0) * 0.10
                        + ISNULL(AVG(CAST(er.ValueForTimeRating AS FLOAT)), 0) * 0.10
                    )
                    AS DECIMAL(5,2)
                ) AS WeightedEventScore
            FROM Events e
            JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
            LEFT JOIN EventReviews er ON er.EventID = e.EventID
            WHERE e.EventID = @EventID
            GROUP BY e.EventID, e.OrganizerID, e.Title, op.OrganizationName
        `);

    const row = summaryResult.recordset?.[0];
    if (!row) return null;

    return {
        eventId: Number(row.EventID),
        organizerId: Number(row.OrganizerID),
        eventTitle: row.Title,
        organizationName: row.OrganizationName,
        reviewCount: Number(row.ReviewCount || 0),
        avgOverallRating: row.AvgOverallRating === null ? null : Number(row.AvgOverallRating),
        avgOrganizationRating: row.AvgOrganizationRating === null ? null : Number(row.AvgOrganizationRating),
        avgContentRating: row.AvgContentRating === null ? null : Number(row.AvgContentRating),
        avgVenueRating: row.AvgVenueRating === null ? null : Number(row.AvgVenueRating),
        avgValueForTimeRating: row.AvgValueForTimeRating === null ? null : Number(row.AvgValueForTimeRating),
        weightedEventScore: row.WeightedEventScore === null ? null : Number(row.WeightedEventScore),
    };
}

async function fetchOrganizerReputation(pool, organizerId) {
    const result = await pool.request()
        .input('OrganizerID', sql.Int, organizerId)
        .query(`
            SELECT TOP 1
                v.OrganizerID,
                v.OrganizationName,
                v.TotalReviewsReceived,
                v.TotalEventsHosted,
                v.AvgOverallRating,
                v.AvgOrganizationRating,
                v.AvgContentRating,
                v.AvgVenueRating,
                v.AvgValueForTimeRating,
                v.ReputationScore,
                CASE
                    WHEN v.ReputationScore >= 4.5 THEN 'Platinum'
                    WHEN v.ReputationScore >= 4.0 THEN 'Gold'
                    WHEN v.ReputationScore >= 3.5 THEN 'Silver'
                    ELSE 'Standard'
                END AS ReputationTier
            FROM vw_OrganizerReputationScore v
            WHERE v.OrganizerID = @OrganizerID
        `);

    const row = result.recordset?.[0];
    if (!row) return null;

    return {
        organizerId: Number(row.OrganizerID),
        organizationName: row.OrganizationName,
        totalReviewsReceived: Number(row.TotalReviewsReceived || 0),
        totalEventsHosted: Number(row.TotalEventsHosted || 0),
        avgOverallRating: row.AvgOverallRating === null ? null : Number(row.AvgOverallRating),
        avgOrganizationRating: row.AvgOrganizationRating === null ? null : Number(row.AvgOrganizationRating),
        avgContentRating: row.AvgContentRating === null ? null : Number(row.AvgContentRating),
        avgVenueRating: row.AvgVenueRating === null ? null : Number(row.AvgVenueRating),
        avgValueForTimeRating: row.AvgValueForTimeRating === null ? null : Number(row.AvgValueForTimeRating),
        reputationScore: row.ReputationScore === null ? null : Number(row.ReputationScore),
        reputationTier: row.ReputationTier,
    };
}

router.get('/events/:eventId', async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT
                    er.ReviewID,
                    er.EventID,
                    er.UserID,
                    er.OverallRating,
                    er.OrganizationQualityRating,
                    er.ContentQualityRating,
                    er.VenueRating,
                    er.ValueForTimeRating,
                    er.ReviewText,
                    er.CreatedAt,
                    e.Title AS EventTitle,
                    e.OrganizerID,
                    op.OrganizationName,
                    COALESCE(NULLIF(CONCAT(sp.FirstName, ' ', sp.LastName), ' '), u.Email) AS ReviewerName,
                    sp.Department AS ReviewerDepartment,
                    rr.ResponseID,
                    rr.ResponseText,
                    rr.ResponseDate,
                    rr.OrganizerID AS ResponseOrganizerID,
                    ro.OrganizationName AS ResponseOrganizationName
                FROM EventReviews er
                JOIN Events e ON e.EventID = er.EventID
                JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                JOIN Users u ON u.UserID = er.UserID
                LEFT JOIN StudentProfiles sp ON sp.UserID = er.UserID
                LEFT JOIN ReviewResponses rr ON rr.ReviewID = er.ReviewID
                LEFT JOIN OrganizerProfiles ro ON ro.UserID = rr.OrganizerID
                WHERE er.EventID = @EventID
                ORDER BY er.CreatedAt DESC, er.ReviewID DESC
            `);

        return res.json({ success: true, reviews: (result.recordset || []).map(mapReviewRow) });
    } catch (err) {
        console.error('Get event reviews failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event reviews' });
    }
});

router.get('/events/:eventId/summary', async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;
        const summary = await fetchEventSummary(pool, eventId);
        if (!summary) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const organizerReputation = await fetchOrganizerReputation(pool, summary.organizerId);
        return res.json({ success: true, summary, organizerReputation });
    } catch (err) {
        console.error('Get event review summary failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch event review summary' });
    }
});

router.get('/organizers/:organizerId', async (req, res) => {
    const organizerId = Number(req.params.organizerId);
    if (!Number.isInteger(organizerId) || organizerId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid organizerId is required' });
    }

    try {
        const pool = await poolPromise;
        const organizerReputation = await fetchOrganizerReputation(pool, organizerId);

        const reviewsResult = await pool.request()
            .input('OrganizerID', sql.Int, organizerId)
            .query(`
                SELECT
                    er.ReviewID,
                    er.EventID,
                    er.UserID,
                    er.OverallRating,
                    er.OrganizationQualityRating,
                    er.ContentQualityRating,
                    er.VenueRating,
                    er.ValueForTimeRating,
                    er.ReviewText,
                    er.CreatedAt,
                    e.Title AS EventTitle,
                    e.OrganizerID,
                    op.OrganizationName,
                    COALESCE(NULLIF(CONCAT(sp.FirstName, ' ', sp.LastName), ' '), u.Email) AS ReviewerName,
                    sp.Department AS ReviewerDepartment,
                    rr.ResponseID,
                    rr.ResponseText,
                    rr.ResponseDate,
                    rr.OrganizerID AS ResponseOrganizerID,
                    ro.OrganizationName AS ResponseOrganizationName
                FROM EventReviews er
                JOIN Events e ON e.EventID = er.EventID
                JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                JOIN Users u ON u.UserID = er.UserID
                LEFT JOIN StudentProfiles sp ON sp.UserID = er.UserID
                LEFT JOIN ReviewResponses rr ON rr.ReviewID = er.ReviewID
                LEFT JOIN OrganizerProfiles ro ON ro.UserID = rr.OrganizerID
                WHERE e.OrganizerID = @OrganizerID
                ORDER BY er.CreatedAt DESC, er.ReviewID DESC
            `);

        return res.json({
            success: true,
            organizerReputation,
            reviews: (reviewsResult.recordset || []).map(mapReviewRow),
        });
    } catch (err) {
        console.error('Get organizer reviews failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch organizer reviews' });
    }
});

router.get('/events/:eventId/mine', authMiddleware, studentMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const userId = Number(req.user?.UserID);

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT TOP 1
                    er.ReviewID,
                    er.EventID,
                    er.UserID,
                    er.OverallRating,
                    er.OrganizationQualityRating,
                    er.ContentQualityRating,
                    er.VenueRating,
                    er.ValueForTimeRating,
                    er.ReviewText,
                    er.CreatedAt,
                    e.Title AS EventTitle,
                    e.OrganizerID,
                    op.OrganizationName,
                    COALESCE(NULLIF(CONCAT(sp.FirstName, ' ', sp.LastName), ' '), u.Email) AS ReviewerName,
                    sp.Department AS ReviewerDepartment,
                    rr.ResponseID,
                    rr.ResponseText,
                    rr.ResponseDate,
                    rr.OrganizerID AS ResponseOrganizerID,
                    ro.OrganizationName AS ResponseOrganizationName
                FROM EventReviews er
                JOIN Events e ON e.EventID = er.EventID
                JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID
                JOIN Users u ON u.UserID = er.UserID
                LEFT JOIN StudentProfiles sp ON sp.UserID = er.UserID
                LEFT JOIN ReviewResponses rr ON rr.ReviewID = er.ReviewID
                LEFT JOIN OrganizerProfiles ro ON ro.UserID = rr.OrganizerID
                WHERE er.EventID = @EventID AND er.UserID = @UserID
                ORDER BY er.CreatedAt DESC
            `);

        const mine = result.recordset?.[0] ? mapReviewRow(result.recordset[0]) : null;
        return res.json({ success: true, review: mine });
    } catch (err) {
        console.error('Get my review failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch your review' });
    }
});

router.get('/events/:eventId/eligibility', authMiddleware, studentMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const userId = Number(req.user?.UserID);

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;

        const eventResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1 EventID, OrganizerID, Status, EventDate, EventTime
                FROM Events
                WHERE EventID = @EventID
            `);
        const event = eventResult.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const attendanceResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT TOP 1 a.AttendanceID
                FROM Attendance a
                JOIN Registrations r ON r.RegistrationID = a.RegistrationID
                WHERE r.EventID = @EventID
                  AND r.UserID = @UserID
                  AND r.Status <> 'Cancelled'
            `);

        const existingReviewResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .query('SELECT TOP 1 ReviewID FROM EventReviews WHERE EventID = @EventID AND UserID = @UserID');

        const hasAttended = Boolean(attendanceResult.recordset?.[0]);
        const alreadyReviewed = Boolean(existingReviewResult.recordset?.[0]);
        const eventCompleted = isEventCompleted(event);

        let reason = null;
        if (!eventCompleted) reason = 'You can review after the event is completed.';
        else if (!hasAttended) reason = 'Only students who attended can review this event.';
        else if (alreadyReviewed) reason = 'You have already submitted a review for this event.';

        return res.json({
            success: true,
            eligibility: {
                eventId,
                organizerId: Number(event.OrganizerID),
                userId,
                eventCompleted,
                hasAttended,
                alreadyReviewed,
                canReview: eventCompleted && hasAttended && !alreadyReviewed,
                reason,
            },
        });
    } catch (err) {
        console.error('Check review eligibility failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to check review eligibility' });
    }
});

router.post('/events/:eventId', authMiddleware, studentMiddleware, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const userId = Number(req.user?.UserID);

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    const overallRating = parseRating(req.body?.overallRating);
    const organizationQualityRating = parseRating(req.body?.organizationQualityRating);
    const contentQualityRating = parseRating(req.body?.contentQualityRating);
    const venueRating = parseRating(req.body?.venueRating);
    const valueForTimeRating = parseRating(req.body?.valueForTimeRating);
    const reviewText = cleanText(req.body?.reviewText, MAX_REVIEW_TEXT);

    if (!overallRating || !organizationQualityRating || !contentQualityRating || !venueRating || !valueForTimeRating) {
        return res.status(400).json({
            success: false,
            message: 'All rating criteria are required and must be integers between 1 and 5.',
        });
    }

    try {
        const pool = await poolPromise;

        const eventResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query('SELECT TOP 1 EventID, Status, EventDate, EventTime FROM Events WHERE EventID = @EventID');
        const event = eventResult.recordset?.[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (!isEventCompleted(event)) {
            return res.status(400).json({ success: false, message: 'You can only review after event completion.' });
        }

        const attendanceResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT TOP 1 a.AttendanceID
                FROM Attendance a
                JOIN Registrations r ON r.RegistrationID = a.RegistrationID
                WHERE r.EventID = @EventID
                  AND r.UserID = @UserID
                  AND r.Status <> 'Cancelled'
                ORDER BY a.CheckInTime DESC
            `);

        const attendanceId = Number(attendanceResult.recordset?.[0]?.AttendanceID || 0);
        if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
            return res.status(400).json({ success: false, message: 'Only students who attended can review this event.' });
        }

        const existingReviewResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .query('SELECT TOP 1 ReviewID FROM EventReviews WHERE EventID = @EventID AND UserID = @UserID');
        if (existingReviewResult.recordset?.[0]) {
            return res.status(409).json({ success: false, message: 'You have already submitted a review for this event.' });
        }

        const insertResult = await pool.request()
            .input('EventID', sql.Int, eventId)
            .input('UserID', sql.Int, userId)
            .input('AttendanceID', sql.Int, attendanceId)
            .input('OverallRating', sql.Int, overallRating)
            .input('OrganizationQualityRating', sql.Int, organizationQualityRating)
            .input('ContentQualityRating', sql.Int, contentQualityRating)
            .input('VenueRating', sql.Int, venueRating)
            .input('ValueForTimeRating', sql.Int, valueForTimeRating)
            .input('ReviewText', sql.NVarChar(sql.MAX), reviewText)
            .query(`
                INSERT INTO EventReviews (
                    EventID,
                    UserID,
                    AttendanceID,
                    OverallRating,
                    OrganizationQualityRating,
                    ContentQualityRating,
                    VenueRating,
                    ValueForTimeRating,
                    ReviewText
                )
                OUTPUT INSERTED.ReviewID
                VALUES (
                    @EventID,
                    @UserID,
                    @AttendanceID,
                    @OverallRating,
                    @OrganizationQualityRating,
                    @ContentQualityRating,
                    @VenueRating,
                    @ValueForTimeRating,
                    @ReviewText
                )
            `);

        const reviewId = Number(insertResult.recordset?.[0]?.ReviewID || 0);
        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully.',
            reviewId: reviewId || null,
        });
    } catch (err) {
        console.error('Submit review failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to submit review' });
    }
});

router.put('/:reviewId/response', authMiddleware, async (req, res) => {
    const reviewId = Number(req.params.reviewId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '').toLowerCase();
    const responseText = cleanText(req.body?.responseText, MAX_RESPONSE_TEXT);

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid reviewId is required' });
    }
    if (!responseText) {
        return res.status(400).json({ success: false, message: 'responseText is required' });
    }
    if (!['organizer', 'admin'].includes(requesterRole)) {
        return res.status(403).json({ success: false, message: 'Only organizers can respond to reviews.' });
    }

    try {
        const pool = await poolPromise;

        const ownerResult = await pool.request()
            .input('ReviewID', sql.Int, reviewId)
            .query(`
                SELECT TOP 1 er.ReviewID, e.EventID, e.OrganizerID
                FROM EventReviews er
                JOIN Events e ON e.EventID = er.EventID
                WHERE er.ReviewID = @ReviewID
            `);
        const owner = ownerResult.recordset?.[0];

        if (!owner) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        const organizerId = Number(owner.OrganizerID);
        if (requesterRole !== 'admin' && organizerId !== requesterId) {
            return res.status(403).json({ success: false, message: 'You can only respond to reviews for your own events.' });
        }

        const existingResult = await pool.request()
            .input('ReviewID', sql.Int, reviewId)
            .query('SELECT TOP 1 ResponseID FROM ReviewResponses WHERE ReviewID = @ReviewID');

        if (existingResult.recordset?.[0]) {
            await pool.request()
                .input('ReviewID', sql.Int, reviewId)
                .input('ResponseText', sql.NVarChar(sql.MAX), responseText)
                .query(`
                    UPDATE ReviewResponses
                    SET ResponseText = @ResponseText,
                        ResponseDate = SYSDATETIMEOFFSET()
                    WHERE ReviewID = @ReviewID
                `);
        } else {
            await pool.request()
                .input('ReviewID', sql.Int, reviewId)
                .input('OrganizerID', sql.Int, organizerId)
                .input('ResponseText', sql.NVarChar(sql.MAX), responseText)
                .query(`
                    INSERT INTO ReviewResponses (ReviewID, OrganizerID, ResponseText)
                    VALUES (@ReviewID, @OrganizerID, @ResponseText)
                `);
        }

        return res.json({ success: true, message: 'Response saved successfully.' });
    } catch (err) {
        console.error('Respond to review failed:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to save response' });
    }
});

module.exports = router;
