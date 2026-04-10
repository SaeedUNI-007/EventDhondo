const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

function formatEventDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildDetailedMessage(row) {
  const base = String(row.Message || row.message || '').trim();
  const title = row.EventTitle || row.eventTitle;
  if (!title) return base;

  const eventDate = formatEventDate(row.EventDate || row.eventDate);
  const venue = row.EventVenue || row.eventVenue;
  const detailParts = [`Event: ${title}`];
  if (eventDate) detailParts.push(`Date: ${eventDate}`);
  if (venue) detailParts.push(`Venue: ${venue}`);
  const detail = detailParts.join(' | ');

  if (!base) return detail;
  if (/event\s*:/i.test(base) || /venue\s*:/i.test(base) || /date\s*:/i.test(base)) return base;
  return `${base}\n${detail}`;
}

// helper for dev/testing: get userId from query/body fallback to 1
function getUserIdFromReq(req) {
  return parseInt(req.query.userId || (req.body && req.body.userId) || 1, 10);
}

// GET /api/notifications?filter=unread|all&page=1&limit=20&userId=1
router.get('/', async (req, res) => {
  const userId = getUserIdFromReq(req);
  const filter = String(req.query.filter || 'all').toLowerCase();
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const applyFilter = (rows) => {
    if (filter === 'read') {
      return rows.filter((r) => String(r.Status ?? r.status ?? '').toLowerCase() === 'read');
    }
    if (filter === 'unread') {
      return rows.filter((r) => String(r.Status ?? r.status ?? '').toLowerCase() !== 'read');
    }
    return rows;
  };

  try {
    const pool = await poolPromise;
    let items = [];

    try {
      const result = await pool.request()
        .input('UserID', sql.Int, userId)
        .input('Page', sql.Int, page)
        .input('PageSize', sql.Int, limit)
        .execute('dbo.sp_GetNotificationsForUser');
      items = applyFilter(result.recordset || []);
    } catch (_spErr) {
      const offset = Math.max(0, (page - 1) * limit);
      const fallback = await pool.request()
        .input('UserID', sql.Int, userId)
        .input('Filter', sql.NVarChar(16), filter)
        .input('OffsetRows', sql.Int, offset)
        .input('FetchRows', sql.Int, limit)
        .query(`
          SELECT NotificationID, UserID, Title, Message, RelatedEventID, Status, CreatedAt, ReadAt
          FROM [dbo].[Notifications]
          WHERE UserID = @UserID
            AND (
              @Filter = 'all'
              OR (@Filter = 'unread' AND Status <> 'Read')
              OR (@Filter = 'read' AND Status = 'Read')
            )
          ORDER BY CreatedAt DESC
          OFFSET @OffsetRows ROWS FETCH NEXT @FetchRows ROWS ONLY
        `);
      items = fallback.recordset || [];
    }

    const relatedIds = Array.from(new Set(
      items
        .map((r) => Number(r.RelatedEventID || r.relatedEventId))
        .filter((n) => Number.isInteger(n) && n > 0)
    ));

    let eventMap = new Map();
    if (relatedIds.length > 0) {
      const eventsResult = await pool.request().query(`
        SELECT EventID, Title, EventDate, Venue
        FROM [dbo].[Events]
        WHERE EventID IN (${relatedIds.join(',')})
      `);
      eventMap = new Map((eventsResult.recordset || []).map((e) => [Number(e.EventID), e]));
    }

    const enriched = items.map((row) => {
      const eventId = Number(row.RelatedEventID || row.relatedEventId);
      const event = eventMap.get(eventId);
      const merged = {
        ...row,
        EventTitle: event?.Title || null,
        EventDate: event?.EventDate || null,
        EventVenue: event?.Venue || null,
      };
      return {
        ...merged,
        Message: buildDetailedMessage(merged),
      };
    });

    res.json({ items: enriched, total: enriched.length });
  } catch (err) {
    console.error('GET /api/notifications failed', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/mark-read  { ids: [101,102], userId?:1 }
router.post('/mark-read', express.json(), async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ error: 'No ids provided' });

    const csv = ids.join(',');
    const pool = await poolPromise;
    try {
      await pool.request()
        .input('UserID', sql.Int, userId)
        .input('NotificationIDs', sql.NVarChar(sql.MAX), csv)
        .execute('dbo.sp_MarkNotificationsRead');
    } catch (_spErr) {
      await pool.request()
        .input('UserID', sql.Int, userId)
        .query(`
          UPDATE [dbo].[Notifications]
          SET Status = 'Read', ReadAt = SYSUTCDATETIME()
          WHERE UserID = @UserID
            AND NotificationID IN (${ids.map((n) => Number(n)).join(',')})
        `);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/mark-read failed', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// GET /api/notifications/settings?userId=1
router.get('/settings', async (req, res) => {
  const userId = getUserIdFromReq(req);
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', sql.Int, userId)
      .query(`
        SELECT NotificationType AS notificationType, EmailEnabled AS emailEnabled, InAppEnabled AS inAppEnabled
        FROM NotificationPreferences
        WHERE UserID = @UserID
      `);
    res.json({ preferences: result.recordset || [] });
  } catch (err) {
    console.error('GET /api/notifications/settings failed', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/notifications/settings  { preferences: [...] , userId?:1 }
router.post('/settings', express.json(), async (req, res) => {
  const userId = getUserIdFromReq(req);
  const prefs = Array.isArray(req.body.preferences) ? req.body.preferences : [];
  try {
    const pool = await poolPromise;
    for (const p of prefs) {
      const nt = String(p.notificationType || '').replace("'", "''");
      const email = p.emailEnabled ? 1 : 0;
      const inapp = p.inAppEnabled ? 1 : 0;
      await pool.request()
        .query(`
          IF EXISTS (SELECT 1 FROM NotificationPreferences WHERE UserID = ${userId} AND NotificationType = '${nt}')
            UPDATE NotificationPreferences SET EmailEnabled = ${email}, InAppEnabled = ${inapp} WHERE UserID = ${userId} AND NotificationType = '${nt}'
          ELSE
            INSERT INTO NotificationPreferences (UserID, NotificationType, EmailEnabled, InAppEnabled) VALUES (${userId}, '${nt}', ${email}, ${inapp})
        `);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/settings failed', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// GET /api/notifications/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const pool = await poolPromise;
    let row = null;
    try {
      const result = await pool.request()
        .input('NotificationID', sql.Int, id)
        .execute('dbo.sp_GetNotificationById');
      row = (result.recordset && result.recordset[0]) || null;
    } catch (_spErr) {
      const fallback = await pool.request()
        .input('NotificationID', sql.Int, id)
        .query(`
          SELECT TOP 1 NotificationID, UserID, Title, Message, RelatedEventID, Status, CreatedAt, ReadAt
          FROM [dbo].[Notifications]
          WHERE NotificationID = @NotificationID
        `);
      row = (fallback.recordset && fallback.recordset[0]) || null;
    }

    if (!row) return res.status(404).json({ error: 'Not found' });

    const relatedId = Number(row.RelatedEventID || row.relatedEventId);
    let event = null;
    if (Number.isInteger(relatedId) && relatedId > 0) {
      const eventResult = await pool.request()
        .input('EventID', sql.Int, relatedId)
        .query('SELECT TOP 1 EventID, Title, EventDate, Venue FROM [dbo].[Events] WHERE EventID=@EventID');
      event = eventResult.recordset?.[0] || null;
    }

    const merged = {
      ...row,
      EventTitle: event?.Title || null,
      EventDate: event?.EventDate || null,
      EventVenue: event?.Venue || null,
    };

    res.json({
      ...merged,
      Message: buildDetailedMessage(merged),
    });
  } catch (err) {
    console.error('GET /api/notifications/:id failed', err);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

module.exports = router;