USE [EventDhondo];
GO

USE [EventDhondo];
GO

-- 1. Main Dashboard View (Already exists, updated to include Organizer Logo)
CREATE OR ALTER VIEW vw_UpcomingEvents AS
SELECT 
    e.EventID, e.Title, e.Description, e.EventType, e.EventDate, e.EventTime, e.Venue, e.City, e.Capacity, e.Status, e.PosterURL,
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
    COUNT(DISTINCT a.RegistrationID) AS TotalEventsAttended,
    (SELECT COUNT(*) FROM StudentAchievements sa WHERE sa.UserID = s.UserID) AS TotalAchievements
FROM StudentProfiles s
LEFT JOIN Registrations r ON s.UserID = r.UserID
LEFT JOIN Attendance a ON a.RegistrationID = r.RegistrationID
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

CREATE OR ALTER VIEW vw_OrganizerReputationScore AS
SELECT
    op.UserID AS OrganizerID,
    op.OrganizationName,
    COUNT(er.ReviewID) AS TotalReviewsReceived,
    COUNT(DISTINCT e.EventID) AS TotalEventsHosted,
    CAST(AVG(CAST(er.OverallRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOverallRating,
    CAST(AVG(CAST(er.OrganizationQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOrganizationRating,
    CAST(AVG(CAST(er.ContentQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgContentRating,
    CAST(AVG(CAST(er.VenueRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgVenueRating,
    CAST(
        (
            ISNULL(AVG(CAST(er.OverallRating AS FLOAT)), 0) * 0.40
            + ISNULL(AVG(CAST(er.OrganizationQualityRating AS FLOAT)), 0) * 0.20
            + ISNULL(AVG(CAST(er.ContentQualityRating AS FLOAT)), 0) * 0.25
            + ISNULL(AVG(CAST(er.VenueRating AS FLOAT)), 0) * 0.15
        )
        AS DECIMAL(5,2)
    ) AS ReputationScore
FROM OrganizerProfiles op
LEFT JOIN Events e ON e.OrganizerID = op.UserID
LEFT JOIN EventReviews er ON er.EventID = e.EventID
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

CREATE OR ALTER VIEW vw_StudentPortfolioSummary AS
SELECT
    sp.UserID,
    CONCAT(sp.FirstName, ' ', sp.LastName) AS StudentName,
    u.Email,
    sp.Department,
    sp.YearOfStudy,
    COUNT(DISTINCT CASE WHEN r.Status = 'Attended' OR a.AttendanceID IS NOT NULL THEN r.EventID END) AS TotalEventsAttended,
    COUNT(DISTINCT CASE WHEN r.Status <> 'Cancelled' THEN r.EventID END) AS TotalEventsRegistered,
    COUNT(DISTINCT sa.AchievementID) AS TotalAchievements,
    SUM(CASE WHEN LOWER(ISNULL(sa.Position, '')) LIKE '%1st%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%winner%' THEN 1 ELSE 0 END) AS FirstPlaceCount,
    SUM(CASE WHEN LOWER(ISNULL(sa.Position, '')) LIKE '%2nd%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%runner%' THEN 1 ELSE 0 END) AS SecondPlaceCount,
    SUM(CASE WHEN LOWER(ISNULL(sa.Position, '')) LIKE '%3rd%' THEN 1 ELSE 0 END) AS ThirdPlaceCount,
    CAST(CASE
        WHEN COUNT(DISTINCT CASE WHEN r.Status = 'Attended' OR a.AttendanceID IS NOT NULL THEN r.EventID END) = 0 THEN 0
        ELSE
            (COUNT(DISTINCT CASE WHEN LOWER(ISNULL(sa.Position, '')) LIKE '%1st%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%winner%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%2nd%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%runner%' OR LOWER(ISNULL(sa.Position, '')) LIKE '%3rd%' THEN sa.AchievementID END) * 100.0)
            / COUNT(DISTINCT CASE WHEN r.Status = 'Attended' OR a.AttendanceID IS NOT NULL THEN r.EventID END)
    END AS DECIMAL(5,2)) AS CompetitionWinRatePercent
FROM StudentProfiles sp
JOIN Users u ON u.UserID = sp.UserID
LEFT JOIN Registrations r ON r.UserID = sp.UserID
LEFT JOIN Attendance a ON a.RegistrationID = r.RegistrationID
LEFT JOIN StudentAchievements sa ON sa.UserID = sp.UserID
GROUP BY sp.UserID, sp.FirstName, sp.LastName, u.Email, sp.Department, sp.YearOfStudy;
GO

CREATE OR ALTER VIEW vw_StudentAchievementTimeline AS
SELECT
    sa.UserID,
    DATEFROMPARTS(YEAR(sa.AchievementDate), MONTH(sa.AchievementDate), 1) AS MonthStart,
    COUNT(*) AS AchievementsCount,
    COUNT(DISTINCT sa.EventID) AS DistinctEvents,
    STRING_AGG(CAST(e.Title AS NVARCHAR(MAX)), ' | ') AS EventTitles
FROM StudentAchievements sa
JOIN Events e ON e.EventID = sa.EventID
GROUP BY sa.UserID, DATEFROMPARTS(YEAR(sa.AchievementDate), MONTH(sa.AchievementDate), 1);
GO

CREATE OR ALTER VIEW vw_StudentPortfolioPdfData AS
SELECT
    s.UserID,
    s.StudentName,
    s.Email,
    s.Department,
    s.YearOfStudy,
    s.TotalEventsAttended,
    s.TotalEventsRegistered,
    s.TotalAchievements,
    s.FirstPlaceCount,
    s.SecondPlaceCount,
    s.ThirdPlaceCount,
    s.CompetitionWinRatePercent,
    sp.LinkedInURL,
    sp.GitHubURL,
    sa.AchievementID,
    sa.Position,
    sa.AchievementDate,
    sa.Description AS AchievementDescription,
    e.EventID,
    e.Title AS EventTitle,
    e.EventType,
    e.EventDate,
    op.OrganizationName AS OrganizerName
FROM vw_StudentPortfolioSummary s
JOIN StudentProfiles sp ON sp.UserID = s.UserID
LEFT JOIN StudentAchievements sa ON sa.UserID = s.UserID
LEFT JOIN Events e ON e.EventID = sa.EventID
LEFT JOIN OrganizerProfiles op ON op.UserID = e.OrganizerID;
GO
