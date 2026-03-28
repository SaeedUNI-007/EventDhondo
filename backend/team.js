// routes/team.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const { authMiddleware, organizerMiddleware } = require('./middleware/auth');

// All team routes require authentication
router.use(authMiddleware);

router.post('/create', async (req, res) => {
    const { eventId, teamName, leaderId } = req.body;

    if (!Number.isInteger(Number(eventId)) || !Number.isInteger(Number(leaderId)) || !String(teamName || '').trim()) {
        return res.status(400).json({ success: false, message: 'eventId, leaderId and teamName are required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EventID', sql.Int, Number(eventId))
            .input('TeamName', sql.NVarChar(100), String(teamName).trim())
            .input('LeaderID', sql.Int, Number(leaderId))
            .execute('dbo.sp_CreateTeam');

        const firstRow = result.recordset?.[0] || {};
        if (String(firstRow.Message || '').toLowerCase().startsWith('error')) {
            return res.status(400).json({ success: false, message: firstRow.Message });
        }

        return res.json({ success: true, teamId: firstRow.TeamID, message: firstRow.Message || 'Team created' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/invite', async (req, res) => {
    const { teamId, invitedUserId } = req.body;

    if (!Number.isInteger(Number(teamId)) || !Number.isInteger(Number(invitedUserId))) {
        return res.status(400).json({ success: false, message: 'teamId and invitedUserId are required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TeamID', sql.Int, Number(teamId))
            .input('InvitedUserID', sql.Int, Number(invitedUserId))
            .execute('dbo.sp_InviteTeamMember');

        const message = result.recordset?.[0]?.Message || 'Invite processed';
        const isError = String(message).toLowerCase().startsWith('error');
        return res.status(isError ? 400 : 200).json({ success: !isError, message });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
