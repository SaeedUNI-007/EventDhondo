-- 1.1 Verify User Login (Used on Login Page)
SELECT UserID, Email, [Role], VerificationStatus 
FROM Users 
WHERE Email = 'hamid@university.edu.pk' AND PasswordHash = 'password123';

-- 1.2 Fetch Student Profile Data (Used on Profile Page)
-- Joins Users and StudentProfiles to show full details
SELECT u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy, s.ProfilePictureURL
FROM Users u
JOIN StudentProfiles s ON u.UserID = s.UserID
WHERE u.UserID = 4;

-- 1.3 Fetch User Interests (Used to display selected tags on Profile)
SELECT i.InterestName, i.Category
FROM Interests i
JOIN UserInterests ui ON i.InterestID = ui.InterestID
WHERE ui.UserID = 4;


-- 2.1 Basic Dashboard View (Fetch all upcoming published events)
SELECT * FROM vw_UpcomingEvents 
ORDER BY EventDate ASC;

-- 2.2 Search Events by Keyword (Used in Search Bar)
-- Filters based on user typing in the title or description
SELECT Title, EventDate, Venue, [EventType]
FROM Events
WHERE (Title LIKE '%Coding%' OR Description LIKE '%Coding%')
AND Status = 'Published';

-- 2.3 Filter Events by Category (Used in Category Dropdown/Filters)
SELECT e.Title, e.EventDate, c.CategoryName
FROM Events e
JOIN EventCategoryMapping ecm ON e.EventID = ecm.EventID
JOIN EventCategories c ON ecm.CategoryID = c.CategoryID
WHERE c.CategoryName = 'Technical';

-- 2.4 Filter by Event Type (e.g., Only show Competitions)
SELECT Title, Venue, EventDate 
FROM Events 
WHERE EventType = 'Competition' AND Status = 'Published';

-- 2.5 Sort Events by Popularity (Used in "Trending" section)
-- Rearranges data based on the highest number of registrations
SELECT e.Title, COUNT(r.RegistrationID) AS ParticipantCount
FROM Events e
LEFT JOIN Registrations r ON e.EventID = r.EventID
GROUP BY e.EventID, e.Title
ORDER BY ParticipantCount DESC;

-- 3.1 Check Event Capacity (Used before allowing a user to click 'Register')
-- Shows total seats vs taken seats
SELECT Title, Capacity,
(SELECT COUNT(*) FROM Registrations WHERE EventID = 1 AND Status = 'Confirmed') AS RegisteredCount
FROM Events
WHERE EventID = 1;

-- 3.2 Fetch Student's Registered Events (Used in "My Events" tab)
SELECT e.Title, e.EventDate, r.Status, r.RegistrationDate
FROM Events e
JOIN Registrations r ON e.EventID = r.EventID
WHERE r.UserID = 4;

-- 3.3 Fetch Team Members for a Competition
SELECT t.TeamName, s.FirstName, s.LastName
FROM Teams t
JOIN TeamMembers tm ON t.TeamID = tm.TeamID
JOIN StudentProfiles s ON tm.UserID = s.UserID
WHERE t.EventID = 1;


-- 4.1 Verify QR Code Scan (Used by Organizer during check-in)
SELECT r.RegistrationID, s.FirstName, s.LastName
FROM Registrations r
JOIN StudentProfiles s ON r.UserID = s.UserID
WHERE r.QRCode = 'QR-CODE-STRING-FROM-SCAN' AND r.EventID = 1;

-- 4.2 Build Student Portfolio (List of all positions won)
SELECT e.Title, sa.Position, sa.AchievementDate
FROM StudentAchievements sa
JOIN Events e ON sa.EventID = e.EventID
WHERE sa.UserID = 4;

-- 4.3 Skill Breakdown (Aggregate skills earned by a student)
-- Shows which skills the student has gained through events
SELECT s.SkillName, s.Category, COUNT(*) as TimesEarned
FROM Skills s
JOIN EventSkillMapping esm ON s.SkillID = esm.SkillID
JOIN Attendance a ON esm.EventID = a.RegistrationID -- Logic: Attendance links to event
JOIN Registrations r ON a.RegistrationID = r.RegistrationID
WHERE r.UserID = 4
GROUP BY s.SkillName, s.Category;


-- 5.1 Fetch Unread Notifications (Used for the Notification Bell icon)
SELECT Title, Message, CreatedAt
FROM Notifications
WHERE UserID = 4 AND Status = 'Pending'
ORDER BY CreatedAt DESC;

-- 5.2 Get Average Rating for an Event (Used to show stars on Event Page)
SELECT AVG(CAST(OverallRating AS DECIMAL)) as AverageStars, COUNT(*) as ReviewCount
FROM EventReviews
WHERE EventID = 1;

-- 5.3 Fetch All Reviews for a Specific Event
SELECT er.OverallRating, er.ReviewText, s.FirstName
FROM EventReviews er
JOIN StudentProfiles s ON er.UserID = s.UserID
WHERE er.EventID = 1;


-- 6.1 Top 5 Most Active Students (Leaderboard)
SELECT TOP 5 s.FirstName, s.LastName, COUNT(a.AttendanceID) AS EventsAttended
FROM StudentProfiles s
JOIN Registrations r ON s.UserID = r.UserID
JOIN Attendance a ON r.RegistrationID = a.RegistrationID
GROUP BY s.UserID, s.FirstName, s.LastName
ORDER BY EventsAttended DESC;

-- 6.2 Event Success Rate (Registrations vs. Actual Attendance)
-- Helps organizers see "No-show" rates
SELECT 
    e.Title, 
    COUNT(r.RegistrationID) AS TotalRegistered,
    (SELECT COUNT(*) FROM Attendance att JOIN Registrations reg ON att.RegistrationID = reg.RegistrationID WHERE reg.EventID = e.EventID) AS TotalAttended
FROM Events e
JOIN Registrations r ON e.EventID = r.EventID
GROUP BY e.EventID, e.Title;

-- 6.3 Popular Event Categories (Pie Chart Data)
SELECT c.CategoryName, COUNT(ecm.EventID) AS EventCount
FROM EventCategories c
JOIN EventCategoryMapping ecm ON c.CategoryID = ecm.CategoryID
GROUP BY c.CategoryName;


-- 1.1 Login Check
-- Checks if the email exists and matches the password hash
SELECT UserID, Email, [Role] 
FROM Users 
WHERE Email = 'hamid.abad@fast.edu.pk' AND PasswordHash = '$2b$10$7dKZ0OZgIv44dUPa.dzAw./0HUsA.sVPBb4lhpepKrzlJDAojWc/C';

-- 1.2 Display Profile Data
-- Fetches name and department to show on the User Dashboard
SELECT u.Email, s.FirstName, s.LastName, s.Department, s.YearOfStudy
FROM Users u
JOIN StudentProfiles s ON u.UserID = s.UserID
WHERE u.UserID = 4;

-- 1.3 Update Profile (Business Logic)
-- This is how the 'Edit Profile' form saves changes
EXEC sp_UpdateStudentProfile 
    @UserID = 4, 
    @FirstName = 'Hamid', 
    @LastName = 'Abad', 
    @Department = 'Computer Science', 
    @YearOfStudy = 2;

-- 2.1 Main Dashboard View
-- Retrieves data from the pre-defined View
SELECT * FROM vw_UpcomingEvents;

-- 2.2 Search Bar Logic
-- Filters the view based on keywords the user types
SELECT * FROM vw_UpcomingEvents
WHERE Title LIKE '%Hackathon%' OR Description LIKE '%Hackathon%';

-- 2.3 Category Filtering
-- Used when a student clicks a category tag (e.g., 'Technical')
SELECT * FROM vw_UpcomingEvents
WHERE Category = 'Technical';

-- 2.4 Registration Status Check (Capacity Control)
-- Calculates seats left before showing the "Register" button
SELECT Title, Capacity,
(SELECT COUNT(*) FROM Registrations WHERE EventID = 1 AND Status = 'Confirmed') AS SeatsTaken
FROM Events
WHERE EventID = 1;


-- 3.1 Personal Event History
-- Shows the student every event they have registered for
SELECT e.Title, e.EventDate, r.Status
FROM Events e
JOIN Registrations r ON e.EventID = r.EventID
WHERE r.UserID = 4
ORDER BY e.EventDate DESC;

-- 3.2 Achievement Record
-- Lists positions won by the student for their digital resume
SELECT e.Title, sa.Position, sa.AchievementDate
FROM StudentAchievements sa
JOIN Events e ON sa.EventID = e.EventID
WHERE sa.UserID = 4;


-- 4.1 Popularity Analytics
-- Ranks events by registration count to see what's trending
SELECT Title, 
(SELECT COUNT(*) FROM Registrations r WHERE r.EventID = e.EventID) AS TotalSignups
FROM Events e
ORDER BY TotalSignups DESC;

-- 4.2 Review Summary
-- Shows average user rating for a specific event
SELECT AVG(CAST(OverallRating AS FLOAT)) AS AvgRating, COUNT(*) AS ReviewCount
FROM EventReviews
WHERE EventID = 1;

-- 4.3 Category Breakdown (For Admin Charts)
SELECT CategoryName, 
(SELECT COUNT(*) FROM EventCategoryMapping m WHERE m.CategoryID = c.CategoryID) AS EventCount
FROM EventCategories c;

USE [EventDhondo];
GO

-- Seed: sample notification preferences + notifications for quick frontend testing (run once)
IF NOT EXISTS (SELECT 1 FROM NotificationPreferences WHERE UserID = 1)
BEGIN
    INSERT INTO NotificationPreferences (UserID, NotificationType, EmailEnabled, InAppEnabled)
    VALUES
      (1, 'RegistrationConfirmation', 1, 1),
      (1, 'EventReminder', 1, 1),
      (1, 'RegistrationDeadline', 1, 1),
      (1, 'NewEventMatch', 1, 1),
      (1, 'EventUpdate', 1, 1),
      (1, 'ResultAnnouncement', 1, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM Notifications WHERE UserID = 1)
BEGIN
    INSERT INTO Notifications (UserID, Title, Message, RelatedEventID, Status, CreatedAt)
    VALUES
    (1, 'Registration Confirmed', 'Your registration for \"AI Workshop\" is confirmed.', 12, 'Pending', SYSDATETIME()),
    (1, 'Event Reminder - 3 days', 'Reminder: \"Data Science Talk\" starts in 3 days.', 15, 'Pending', DATEADD(minute,-5,SYSDATETIME())),
    (1, 'Registration Deadline (Watchlist)', 'Registration closes soon for \"Hackathon\".', 18, 'Pending', DATEADD(hour,-1,SYSDATETIME())),
    (1, 'New Event Matching Your Interests', 'A new workshop on Machine Learning was posted.', NULL, 'Pending', DATEADD(day,-1,SYSDATETIME())),
    (1, 'Event Cancelled', 'The Entrepreneurship meetup has been cancelled.', 20, 'Read', DATEADD(day,-2,SYSDATETIME()));
END;
GO



