USE [EventDhondo];
GO

USE [EventDhondo];
GO

-- 1. Main Dashboard View (Already exists, updated to include Organizer Logo)
CREATE OR ALTER VIEW vw_UpcomingEvents AS
SELECT 
    e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.Capacity, e.Status, e.PosterURL,
    o.OrganizationName AS Organizer, o.ProfilePictureURL AS OrganizerLogo,
    (SELECT TOP 1 CategoryName FROM EventCategories ec JOIN EventCategoryMapping ecm ON ec.CategoryID = ecm.CategoryID WHERE ecm.EventID = e.EventID) AS Category,
    (e.Capacity - (SELECT COUNT(*) FROM Registrations WHERE EventID = e.EventID AND Status = 'Confirmed')) AS AvailableSeats
FROM [Events] e
JOIN [OrganizerProfiles] o ON e.OrganizerID = o.UserID
WHERE e.Status = 'Published' AND e.EventDate >= CAST(GETDATE() AS DATE);
GO

-- 2. Student Portfolio View (For Feature 6)
CREATE OR ALTER VIEW vw_StudentPortfolio AS
SELECT 
    s.UserID, s.FirstName, s.LastName,
    COUNT(DISTINCT r.EventID) AS TotalEventsAttended,
    (SELECT COUNT(*) FROM StudentAchievements sa WHERE sa.UserID = s.UserID) AS TotalAchievements
FROM StudentProfiles s
LEFT JOIN Registrations r ON s.UserID = r.UserID AND r.Status = 'Attended'
GROUP BY s.UserID, s.FirstName, s.LastName;
GO

-- 3. Event Analytics View (For Feature 10)
CREATE OR ALTER VIEW vw_EventPerformance AS
SELECT 
    e.EventID, e.Title,
    COUNT(r.RegistrationID) AS TotalRegistered,
    (SELECT COUNT(*) FROM Attendance a WHERE a.RegistrationID IN (SELECT RegistrationID FROM Registrations WHERE EventID = e.EventID)) AS TotalAttended,
    AVG(CAST(er.OverallRating AS FLOAT)) AS AvgRating
FROM Events e
LEFT JOIN Registrations r ON e.EventID = r.EventID
LEFT JOIN EventReviews er ON e.EventID = er.EventID
GROUP BY e.EventID, e.Title;
GO


CREATE OR ALTER VIEW vw_AdminPendingVerification AS
SELECT 
    u.UserID, 
    u.Email, 
    op.OrganizationName, 
    op.ContactEmail, 
    u.CreatedAt AS RequestDate
FROM Users u
JOIN OrganizerProfiles op ON u.UserID = op.UserID
WHERE u.VerificationStatus = 'Pending' AND u.Role = 'Organizer';
GO


CREATE OR ALTER VIEW vw_TeamRosters AS
SELECT 
    t.EventID,
    t.TeamName,
    sp.FirstName + ' ' + sp.LastName AS MemberName,
    tm.InvitationStatus,
    CASE WHEN t.TeamLeaderID = sp.UserID THEN 'Leader' ELSE 'Member' END AS RoleInTeam
FROM Teams t
JOIN TeamMembers tm ON t.TeamID = tm.TeamID
JOIN StudentProfiles sp ON tm.UserID = sp.UserID;
GO


CREATE OR ALTER VIEW vw_OrganizerReputation AS
SELECT 
    op.UserID AS OrganizerID,
    op.OrganizationName,
    AVG(CAST(er.OverallRating AS FLOAT)) AS AvgReputationRating,
    COUNT(er.ReviewID) AS TotalReviewsReceived,
    (SELECT COUNT(*) FROM Events WHERE OrganizerID = op.UserID AND Status = 'Completed') AS TotalEventsHosted
FROM OrganizerProfiles op
LEFT JOIN Events e ON op.UserID = e.OrganizerID
LEFT JOIN EventReviews er ON e.EventID = er.EventID
GROUP BY op.UserID, op.OrganizationName;
GO


CREATE OR ALTER VIEW vw_DetailedAchievementPortfolio AS
SELECT 
    sa.UserID,
    e.Title AS EventTitle,
    sa.Position,
    sa.AchievementDate,
    e.EventType,
    o.OrganizationName AS AwardedBy
FROM StudentAchievements sa
JOIN Events e ON sa.EventID = e.EventID
JOIN OrganizerProfiles o ON e.OrganizerID = o.UserID;
GO