const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// helper for dev/testing: get userId from query/body fallback to 1
function getUserIdFromReq(req) {
  return parseInt(req.query.userId || (req.body && req.body.userId) || 1, 10);
}

// GET /api/notifications?filter=unread|all&page=1&limit=20&userId=1
router.get('/', async (req, res) => {
  const userId = getUserIdFromReq(req);
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', sql.Int, userId)
      .input('Page', sql.Int, page)
      .input('PageSize', sql.Int, limit)
      .execute('dbo.sp_GetNotificationsForUser');

    const items = result.recordset || [];
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('GET /api/notifications failed', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('NotificationID', sql.Int, id)
      .execute('dbo.sp_GetNotificationById');

    const row = (result.recordset && result.recordset[0]) || null;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('GET /api/notifications/:id failed', err);
    res.status(500).json({ error: 'Failed to fetch notification' });
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
    await pool.request()
      .input('UserID', sql.Int, userId)
      .input('NotificationIDs', sql.NVarChar(sql.MAX), csv)
      .execute('dbo.sp_MarkNotificationsRead');

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

module.exports = router;