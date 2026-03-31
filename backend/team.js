// routes/team.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const { authMiddleware } = require('./middleware/auth');

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
        const createdTeamId = Number(firstRow.TeamID);
        const loweredMessage = String(firstRow.Message || '').toLowerCase();

        if (!Number.isInteger(createdTeamId) || createdTeamId <= 0 || loweredMessage.startsWith('error')) {
            return res.status(400).json({ success: false, message: firstRow.Message });
        }

        return res.json({ success: true, teamId: createdTeamId, message: firstRow.Message || 'Team created' });
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

// Get user's team for a specific event
router.get('/user/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    const eventId = Number(req.query.eventId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId and eventId are required' });
    }

    try {
        const pool = await poolPromise;
        // Query to find team where user is a member and event matches, including leader name
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT DISTINCT 
                    t.TeamID as id, 
                    t.TeamName as name, 
                    t.TeamLeaderID as leaderId,
                    COALESCE(CONCAT(sp.FirstName, ' ', sp.LastName), op.OrganizationName, u.Email) as leaderName,
                    t.EventID as eventId
                FROM Teams t
                JOIN Users u ON t.TeamLeaderID = u.UserID
                LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
                LEFT JOIN OrganizerProfiles op ON u.UserID = op.UserID
                WHERE t.EventID = @EventID
                AND (
                    t.TeamLeaderID = @UserID
                    OR EXISTS (
                        SELECT 1 FROM TeamMembers tm
                        WHERE tm.TeamID = t.TeamID
                          AND tm.UserID = @UserID
                          AND tm.InvitationStatus = 'Accepted'
                    )
                )
            `);

        if (result.recordset && result.recordset.length > 0) {
            return res.json(result.recordset[0]);
        }

        return res.status(404).json({ success: false, message: 'No team found' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Get user's pending invite for a specific event
router.get('/invites/pending/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    const eventId = Number(req.query.eventId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid userId and eventId are required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT TOP 1
                    t.TeamID as teamId,
                    t.TeamName as teamName,
                    t.EventID as eventId,
                    tm.InvitationStatus as invitationStatus
                FROM TeamMembers tm
                JOIN Teams t ON tm.TeamID = t.TeamID
                WHERE tm.UserID = @UserID
                  AND t.EventID = @EventID
                  AND tm.InvitationStatus = 'Pending'
                ORDER BY t.TeamID DESC
            `);

        if (result.recordset && result.recordset.length > 0) {
            return res.json({ success: true, invite: result.recordset[0] });
        }

        return res.status(404).json({ success: false, message: 'No pending invite found' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Organizer/Admin view: all teams for an event with members
router.get('/event/:eventId', async (req, res) => {
    const eventId = Number(req.params.eventId);
    const requesterId = Number(req.user?.UserID);
    const requesterRole = String(req.user?.Role || '');

    if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    try {
        const pool = await poolPromise;

        // Only event organizer (or admin) can see all teams for the event.
        if (requesterRole !== 'Admin') {
            const ownerCheck = await pool.request()
                .input('EventID', sql.Int, eventId)
                .input('OrganizerID', sql.Int, requesterId)
                .query(`
                    SELECT TOP 1 EventID
                    FROM Events
                    WHERE EventID = @EventID AND OrganizerID = @OrganizerID
                `);

            if (!ownerCheck.recordset?.length) {
                return res.status(403).json({ success: false, message: 'Only the event organizer can view teams for this event' });
            }
        }

        const result = await pool.request()
            .input('EventID', sql.Int, eventId)
            .query(`
                SELECT
                    t.TeamID,
                    t.TeamName,
                    t.TeamLeaderID,
                    COALESCE(CONCAT(leaderSp.FirstName, ' ', leaderSp.LastName), leaderOp.OrganizationName, leaderU.Email) AS LeaderName,
                    m.UserID,
                    COALESCE(CONCAT(memberSp.FirstName, ' ', memberSp.LastName), memberOp.OrganizationName, memberU.Email) AS MemberName,
                    memberU.Email AS MemberEmail,
                    m.InvitationStatus
                FROM Teams t
                JOIN Users leaderU ON t.TeamLeaderID = leaderU.UserID
                LEFT JOIN StudentProfiles leaderSp ON leaderSp.UserID = leaderU.UserID
                LEFT JOIN OrganizerProfiles leaderOp ON leaderOp.UserID = leaderU.UserID
                LEFT JOIN TeamMembers m ON m.TeamID = t.TeamID
                LEFT JOIN Users memberU ON m.UserID = memberU.UserID
                LEFT JOIN StudentProfiles memberSp ON memberSp.UserID = memberU.UserID
                LEFT JOIN OrganizerProfiles memberOp ON memberOp.UserID = memberU.UserID
                WHERE t.EventID = @EventID
                ORDER BY t.TeamID ASC
            `);

        const map = new Map();

        for (const row of result.recordset || []) {
            if (!map.has(row.TeamID)) {
                map.set(row.TeamID, {
                    teamId: row.TeamID,
                    teamName: row.TeamName,
                    leaderId: row.TeamLeaderID,
                    leaderName: row.LeaderName,
                    members: [],
                });
            }

            if (row.UserID) {
                map.get(row.TeamID).members.push({
                    userId: row.UserID,
                    name: row.MemberName,
                    email: row.MemberEmail,
                    status: row.InvitationStatus === 'Accepted' ? 'Joined' : (row.InvitationStatus || 'Pending'),
                    isLeader: Number(row.UserID) === Number(row.TeamLeaderID),
                });
            }
        }

        return res.json({ success: true, teams: Array.from(map.values()) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Get team members
router.get('/:teamId/members', async (req, res) => {
    const teamId = Number(req.params.teamId);

    if (!Number.isInteger(teamId) || teamId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid teamId is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TeamID', sql.Int, teamId)
            .query(`
                SELECT 
                    t.TeamLeaderID as id,
                    COALESCE(
                        CONCAT(sp.FirstName, ' ', sp.LastName),
                        op.OrganizationName,
                        u.Email
                    ) as name,
                    u.Email as email,
                    'Joined' as status,
                    1 as isLeader
                FROM Teams t
                JOIN Users u ON t.TeamLeaderID = u.UserID
                LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
                LEFT JOIN OrganizerProfiles op ON u.UserID = op.UserID
                WHERE t.TeamID = @TeamID

                UNION

                SELECT 
                    tm.UserID as id,
                    COALESCE(
                        CONCAT(sp.FirstName, ' ', sp.LastName),
                        op.OrganizationName,
                        u.Email
                    ) as name,
                    u.Email as email,
                    CASE
                        WHEN tm.InvitationStatus = 'Accepted' THEN 'Joined'
                        ELSE COALESCE(tm.InvitationStatus, 'Pending')
                    END as status,
                    0 as isLeader
                FROM TeamMembers tm
                JOIN Users u ON tm.UserID = u.UserID
                LEFT JOIN StudentProfiles sp ON u.UserID = sp.UserID
                LEFT JOIN OrganizerProfiles op ON u.UserID = op.UserID
                WHERE tm.TeamID = @TeamID
                  AND tm.UserID <> (
                      SELECT TeamLeaderID FROM Teams WHERE TeamID = @TeamID
                  )
            `);

        return res.json(result.recordset || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Accept team invitation
router.post('/:teamId/members/:userId/accept', async (req, res) => {
    const teamId = Number(req.params.teamId);
    const userId = Number(req.params.userId);

    if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid teamId and userId are required' });
    }

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TeamID', sql.Int, teamId)
            .input('UserID', sql.Int, userId)
            .input('InvitationStatus', sql.NVarChar(20), 'Accepted')
            .query(`
                UPDATE TeamMembers
                SET InvitationStatus = @InvitationStatus,
                    JoinedAt = COALESCE(JoinedAt, SYSDATETIMEOFFSET())
                WHERE TeamID = @TeamID AND UserID = @UserID
            `);

        return res.json({ success: true, message: 'Invitation accepted' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Decline team invitation
router.post('/:teamId/members/:userId/decline', async (req, res) => {
    const teamId = Number(req.params.teamId);
    const userId = Number(req.params.userId);

    if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: 'Valid teamId and userId are required' });
    }

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TeamID', sql.Int, teamId)
            .input('UserID', sql.Int, userId)
            .input('InvitationStatus', sql.NVarChar(20), 'Declined')
            .query(`
                UPDATE TeamMembers
                SET InvitationStatus = @InvitationStatus
                WHERE TeamID = @TeamID AND UserID = @UserID
            `);

        return res.json({ success: true, message: 'Invitation declined' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
