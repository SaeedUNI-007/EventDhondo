USE master;
GO

IF DB_ID(N'EventDhondo') IS NOT NULL
BEGIN
    ALTER DATABASE [EventDhondo] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [EventDhondo];
END
GO

CREATE DATABASE [EventDhondo];
GO

USE [EventDhondo];
GO


DROP TABLE IF EXISTS [ReviewResponses];
DROP TABLE IF EXISTS [EventReviews];
DROP TABLE IF EXISTS [NotificationPreferences];
DROP TABLE IF EXISTS [Notifications];
DROP TABLE IF EXISTS [Certificates];
DROP TABLE IF EXISTS [StudentAchievements];
DROP TABLE IF EXISTS [EventSkillMapping];
DROP TABLE IF EXISTS [Skills];
DROP TABLE IF EXISTS [TeamMembers];
DROP TABLE IF EXISTS [Teams];
DROP TABLE IF EXISTS [Attendance];
DROP TABLE IF EXISTS [RegistrationWaitlist];
DROP TABLE IF EXISTS [Registrations];
DROP TABLE IF EXISTS [EventRequests];
DROP TABLE IF EXISTS [EventTagMapping];
DROP TABLE IF EXISTS [EventTags];
DROP TABLE IF EXISTS [EventCategoryMapping];
DROP TABLE IF EXISTS [EventCategories];
DROP TABLE IF EXISTS [Events];
DROP TABLE IF EXISTS [UserInterests];
DROP TABLE IF EXISTS [Interests];
DROP TABLE IF EXISTS [OrganizerProfiles];
DROP TABLE IF EXISTS [StudentProfiles];
DROP TABLE IF EXISTS [Users];

GO

-- ========= 1. USER & PROFILE MANAGEMENT =========

-- Central table for all users, handling authentication and core details.
CREATE TABLE [Users] (
    [UserID] INT IDENTITY(1,1) PRIMARY KEY,
    [Email] NVARCHAR(100) UNIQUE NOT NULL,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [Role] NVARCHAR(10) NOT NULL CHECK ([Role] IN ('Student', 'Organizer', 'Admin')),
    [VerificationStatus] NVARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK ([VerificationStatus] IN ('Pending', 'Verified')),
    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [LastLogin] DATETIMEOFFSET,
    CONSTRAINT CK_Users_EmailFormat CHECK ([Email] LIKE '%_@__%.__%')
);

-- Extended profile for users with the 'Student' role.
CREATE TABLE [StudentProfiles] (
    [UserID] INT PRIMARY KEY,
    [FirstName] NVARCHAR(50) NOT NULL,
    [LastName] NVARCHAR(50) NOT NULL,
    [Department] NVARCHAR(100),
    [YearOfStudy] INT,
    [ProfilePictureURL] NVARCHAR(255),
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);

-- Extended profile for users with the 'Organizer' role (societies/clubs).
CREATE TABLE [OrganizerProfiles] (
    [UserID] INT PRIMARY KEY,
    [OrganizationName] NVARCHAR(150) NOT NULL UNIQUE,
    [Description] NVARCHAR(MAX),
    [ContactEmail] NVARCHAR(100) NOT NULL,
    [VerificationStatus] NVARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK ([VerificationStatus] IN ('Pending', 'Verified', 'Rejected')),
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);

-- Lookup table for user interests.
CREATE TABLE [Interests] (
    [InterestID] INT IDENTITY(1,1) PRIMARY KEY,
    [InterestName] NVARCHAR(50) NOT NULL UNIQUE,
    [Category] NVARCHAR(50) -- e.g., 'Academic', 'Sports', 'Arts'
);

-- Junction table to link users to their many interests.
CREATE TABLE [UserInterests] (
    [UserID] INT,
    [InterestID] INT,
    PRIMARY KEY ([UserID], [InterestID]),
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE,
    FOREIGN KEY ([InterestID]) REFERENCES [Interests]([InterestID]) ON DELETE CASCADE
);


-- ========= 2. EVENT CORE & CATEGORIZATION =========

-- Core table for all event information.
CREATE TABLE [Events] (
    [EventID] INT IDENTITY(1,1) PRIMARY KEY,
    [OrganizerID] INT NOT NULL,
    [Title] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(MAX),
    [EventType] NVARCHAR(20) NOT NULL CHECK ([EventType] IN ('Competition', 'Workshop', 'Seminar', 'Cultural', 'Sports')),
    [EventDate] DATE NOT NULL,
    [EventTime] TIME NOT NULL,
    [Venue] NVARCHAR(150),
    [Capacity] INT NOT NULL,
    [RegistrationDeadline] DATETIMEOFFSET NOT NULL,
    [Status] NVARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK ([Status] IN ('Draft', 'Published', 'Registration Closed', 'Ongoing', 'Completed', 'Cancelled')),
    [PosterURL] NVARCHAR(255),
    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [UpdatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY ([OrganizerID]) REFERENCES [OrganizerProfiles]([UserID]) ON DELETE NO ACTION, -- Prevent deleting an organizer if they have events
    CONSTRAINT CK_Events_Capacity CHECK ([Capacity] > 0),
    CONSTRAINT CK_Events_Dates CHECK (CAST([RegistrationDeadline] AS DATE) <= [EventDate])
);

-- Lookup table for broad event categories.
CREATE TABLE [EventCategories] (
    [CategoryID] INT IDENTITY(1,1) PRIMARY KEY,
    [CategoryName] NVARCHAR(100) NOT NULL UNIQUE,
    [Description] NVARCHAR(MAX)
);

-- Junction table for many-to-many relationship between events and categories.
CREATE TABLE [EventCategoryMapping] (
    [EventID] INT,
    [CategoryID] INT,
    PRIMARY KEY ([EventID], [CategoryID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([CategoryID]) REFERENCES [EventCategories]([CategoryID]) ON DELETE CASCADE
);

-- Lookup table for specific event tags.
CREATE TABLE [EventTags] (
    [TagID] INT IDENTITY(1,1) PRIMARY KEY,
    [TagName] NVARCHAR(50) NOT NULL UNIQUE
);

-- Junction table for many-to-many relationship between events and tags.
CREATE TABLE [EventTagMapping] (
    [EventID] INT,
    [TagID] INT,
    PRIMARY KEY ([EventID], [TagID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([TagID]) REFERENCES [EventTags]([TagID]) ON DELETE CASCADE
);

-- Table for student-submitted event suggestions.
CREATE TABLE [EventRequests] (
    [RequestID] INT IDENTITY(1,1) PRIMARY KEY,
    [StudentID] INT NOT NULL,
    [Title] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(MAX),
    [SuggestedDate] DATE,
    [Status] NVARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK ([Status] IN ('Pending', 'Approved', 'Rejected')),
    [SubmittedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [AdminNotes] NVARCHAR(MAX),
    FOREIGN KEY ([StudentID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);


-- ========= 3. REGISTRATION, ATTENDANCE & TEAMS =========

-- Manages individual student registrations for events.
CREATE TABLE [Registrations] (
    [RegistrationID] INT IDENTITY(1,1) PRIMARY KEY,
    [EventID] INT NOT NULL,
    [UserID] INT NOT NULL,
    [RegistrationDate] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [Status] NVARCHAR(15) NOT NULL DEFAULT 'Confirmed' CHECK ([Status] IN ('Confirmed', 'Cancelled', 'Attended', 'Waitlisted')),
    [QRCode] NVARCHAR(255) UNIQUE, -- Stores unique QR code data
    [CancelledAt] DATETIMEOFFSET,
    UNIQUE ([EventID], [UserID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);

-- Manages the waitlist for events that are at capacity.
CREATE TABLE [RegistrationWaitlist] (
    [WaitlistID] INT IDENTITY(1,1) PRIMARY KEY,
    [EventID] INT NOT NULL,
    [UserID] INT NOT NULL,
    [RequestedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UNIQUE ([EventID], [UserID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE NO ACTION -- Don't cascade delete if user is on other waitlists
);

-- Tracks actual attendance via QR code scans.
CREATE TABLE [Attendance] (
    [AttendanceID] INT IDENTITY(1,1) PRIMARY KEY,
    [RegistrationID] INT NOT NULL UNIQUE,
    [CheckInTime] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [CheckInMethod] NVARCHAR(50) DEFAULT 'QR_Scan',
    [VerifiedBy] INT, -- UserID of the organizer/admin
    FOREIGN KEY ([RegistrationID]) REFERENCES [Registrations]([RegistrationID]) ON DELETE CASCADE,
    FOREIGN KEY ([VerifiedBy]) REFERENCES [Users]([UserID]) ON DELETE NO ACTION 
);

-- For team-based competitions.
CREATE TABLE [Teams] (
    [TeamID] INT IDENTITY(1,1) PRIMARY KEY,
    [EventID] INT NOT NULL,
    [TeamName] NVARCHAR(100) NOT NULL,
    [TeamLeaderID] INT NOT NULL,
    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UNIQUE ([EventID], [TeamName]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([TeamLeaderID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);

-- Junction table linking students to teams.
CREATE TABLE [TeamMembers] (
    [TeamID] INT,
    [UserID] INT,
    [InvitationStatus] NVARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK ([InvitationStatus] IN ('Pending', 'Accepted', 'Declined')),
    [JoinedAt] DATETIMEOFFSET,
    PRIMARY KEY ([TeamID], [UserID]),
    FOREIGN KEY ([TeamID]) REFERENCES [Teams]([TeamID]) ON DELETE CASCADE,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE NO ACTION -- Don't delete user if they are in other teams
);


-- ========= 4. PORTFOLIO, SKILLS & ACHIEVEMENTS =========

CREATE TABLE [Skills] (
    [SkillID] INT IDENTITY(1,1) PRIMARY KEY,
    [SkillName] NVARCHAR(100) NOT NULL UNIQUE,
    [Category] NVARCHAR(50)
);

CREATE TABLE [EventSkillMapping] (
    [EventID] INT,
    [SkillID] INT,
    PRIMARY KEY ([EventID], [SkillID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([SkillID]) REFERENCES [Skills]([SkillID]) ON DELETE CASCADE
);

CREATE TABLE [StudentAchievements] (
    [AchievementID] INT IDENTITY(1,1) PRIMARY KEY,
    [UserID] INT NOT NULL,
    [EventID] INT NOT NULL,
    [Position] NVARCHAR(50), -- e.g., '1st Place', 'Runner-up'
    [AchievementDate] DATE NOT NULL,
    [Description] NVARCHAR(MAX),
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE,
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE NO ACTION
);

CREATE TABLE [Certificates] (
    [CertificateID] INT IDENTITY(1,1) PRIMARY KEY,
    [UserID] INT NOT NULL,
    [EventID] INT NOT NULL,
    [CertificateType] NVARCHAR(20) NOT NULL CHECK ([CertificateType] IN ('Participation', 'Achievement')),
    [IssueDate] DATE NOT NULL DEFAULT GETDATE(),
    [CertificateURL] NVARCHAR(255) NOT NULL UNIQUE,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE,
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE NO ACTION
);


-- ========= 5. INTERACTION & FEEDBACK =========

CREATE TABLE [Notifications] (
    [NotificationID] BIGINT IDENTITY(1,1) PRIMARY KEY, -- Can be a very large table
    [UserID] INT NOT NULL,
    [Title] NVARCHAR(255) NOT NULL,
    [Message] NVARCHAR(MAX),
    [RelatedEventID] INT,
    [Status] NVARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK ([Status] IN ('Pending', 'Sent', 'Read')),
    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [ReadAt] DATETIMEOFFSET,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE,
    FOREIGN KEY ([RelatedEventID]) REFERENCES [Events]([EventID]) ON DELETE SET NULL
);

CREATE TABLE [NotificationPreferences] (
    [UserID] INT NOT NULL,
    [NotificationType] NVARCHAR(50) NOT NULL,
    [EmailEnabled] BIT NOT NULL DEFAULT 1, -- SQL Server uses BIT for boolean (1=true, 0=false)
    [InAppEnabled] BIT NOT NULL DEFAULT 1,
    PRIMARY KEY ([UserID], [NotificationType]),
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE
);

CREATE TABLE [EventReviews] (
    [ReviewID] INT IDENTITY(1,1) PRIMARY KEY,
    [EventID] INT NOT NULL,
    [UserID] INT NOT NULL,
    [AttendanceID] INT NOT NULL UNIQUE,
    [OverallRating] INT NOT NULL,
    [OrganizationQualityRating] INT,
    [ContentQualityRating] INT,
    [VenueRating] INT,
    [ReviewText] NVARCHAR(MAX),
    [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UNIQUE ([EventID], [UserID]),
    FOREIGN KEY ([EventID]) REFERENCES [Events]([EventID]) ON DELETE CASCADE,
    FOREIGN KEY ([UserID]) REFERENCES [Users]([UserID]) ON DELETE CASCADE,
    FOREIGN KEY ([AttendanceID]) REFERENCES [Attendance]([AttendanceID]) ON DELETE NO ACTION, -- Don't cascade delete attendance if there's a review
    CONSTRAINT CK_Reviews_OverallRating CHECK ([OverallRating] BETWEEN 1 AND 5)
);

CREATE TABLE [ReviewResponses] (
    [ResponseID] INT IDENTITY(1,1) PRIMARY KEY,
    [ReviewID] INT NOT NULL UNIQUE,
    [OrganizerID] INT NOT NULL,
    [ResponseText] NVARCHAR(MAX) NOT NULL,
    [ResponseDate] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY ([ReviewID]) REFERENCES [EventReviews]([ReviewID]) ON DELETE CASCADE,
    FOREIGN KEY ([OrganizerID]) REFERENCES [Users]([UserID]) ON DELETE NO ACTION
);


-- ========= 6. INDEXING FOR PERFORMANCE =========

-- For fast login
--CREATE INDEX IX_Users_Email ON [Users]([Email]);

---- For filtering events by date, status, and type
--CREATE INDEX IX_Events_Date ON [Events]([EventDate]);
--CREATE INDEX IX_Events_Status ON [Events]([Status]);
--CREATE CLUSTERED INDEX IX_Events_EventType_Date ON [Events]([EventType], [EventDate]);

---- For quickly finding registrations for a specific user or event
--CREATE INDEX IX_Registrations_UserID ON [Registrations]([UserID]);
--CREATE INDEX IX_Registrations_EventID ON [Registrations]([EventID]);

---- For finding achievements and reviews by user
--CREATE INDEX IX_Achievements_UserID ON [StudentAchievements]([UserID]);
--CREATE INDEX IX_Reviews_UserID ON [EventReviews]([UserID]);


-- NOTE ON FULL-TEXT SEARCH in SQL Server:
-- To implement full-text search on [Events]([Title], [Description]), you first need to ensure
-- the Full-Text Search feature is installed for your SQL Server instance.
-- Then, you would run commands similar to these:

-- 1. Create a Full-Text Catalog
-- CREATE FULLTEXT CATALOG ft_EventDhondo AS DEFAULT;

-- 2. Create a Full-Text Index on the Events table
-- CREATE FULLTEXT INDEX ON [Events]([Title], [Description])
-- KEY INDEX PK__Events__7944C810... -- You need to put the actual name of your primary key constraint here
-- ON ft_EventDhondo;




-- 1. USERS (Admin, 2 Organizers, 3 Students)
INSERT INTO [Users] (Email, PasswordHash, Role, VerificationStatus) VALUES
(N'admin@fast.edu.pk', N'hashed_pw_1', N'Admin', N'Verified'),
(N'acm@fast.edu.pk', N'hashed_pw_2', N'Organizer', N'Verified'),
(N'sports@fast.edu.pk', N'hashed_pw_3', N'Organizer', N'Verified'),
(N'hamid.abad@fast.edu.pk', N'hashed_pw_4', N'Student', N'Verified'),
(N'abdullah.zia@fast.edu.pk', N'hashed_pw_5', N'Student', N'Verified'),
(N'abdullah.saeed@fast.edu.pk', N'hashed_pw_6', N'Student', N'Pending');

-- 2. STUDENT PROFILES (Linking to UserIDs 4, 5, 6)
INSERT INTO [StudentProfiles] (UserID, FirstName, LastName, Department, YearOfStudy) VALUES
(4, N'Muhammad Hamid', N'Abad', N'Computer Science', 2024),
(5, N'Abdullah Zia', N'Chaudhry', N'Software Engineering', 2024),
(6, N'Abdullah', N'Saeed', N'Data Science', 2024);

-- 3. ORGANIZER PROFILES (Linking to UserIDs 2, 3)
INSERT INTO [OrganizerProfiles] (UserID, OrganizationName, Description, ContactEmail) VALUES
(2, N'ACM Student Chapter', N'The association for computing machinery.', N'acm.society@fast.edu.pk'),
(3, N'FAST Sports Board', N'Managing all indoor and outdoor sports.', N'sports.board@fast.edu.pk');

-- 4. INTERESTS
INSERT INTO [Interests] (InterestName, Category) VALUES
(N'Web Development', N'Technical'),
(N'Machine Learning', N'Technical'),
(N'Basketball', N'Sports'),
(N'Graphic Design', N'Arts');

-- 5. USER INTERESTS (Hamid likes Web and ML)
INSERT INTO [UserInterests] (UserID, InterestID) VALUES (4, 1), (4, 2), (5, 3);

-- 6. EVENT CATEGORIES & TAGS
INSERT INTO [EventCategories] (CategoryName, Description) VALUES (N'Technical', N'Computing and Logic');
INSERT INTO [EventTags] (TagName) VALUES (N'Hackathon'), (N'Workshop'), (N'Trial');

-- 7. EVENTS
INSERT INTO [Events] (OrganizerID, Title, Description, EventType, EventDate, EventTime, Venue, Capacity, RegistrationDeadline, Status) VALUES
(2, N'DevHack 2024', N'24-hour coding challenge.', N'Competition', '2024-10-20', '09:00:00', N'CS Lab 1', 50, '2024-10-18', N'Published'),
(3, N'Basketball Trials', N'Selection for varsity team.', N'Sports', '2024-11-05', '16:00:00', N'Main Court', 20, '2024-11-01', N'Published');

-- 8. EVENT MAPPINGS (Category and Tags)
INSERT INTO [EventCategoryMapping] (EventID, CategoryID) VALUES (1, 1);
INSERT INTO [EventTagMapping] (EventID, TagID) VALUES (1, 1), (2, 3);

-- 9. EVENT REQUESTS (Student suggesting an event)
INSERT INTO [EventRequests] (StudentID, Title, Description, Status) VALUES 
(6, N'Photography Seminar', N'Requesting a workshop on DSLR basics.', N'Pending');

-- 10. REGISTRATIONS
INSERT INTO [Registrations] (EventID, UserID, QRCode, Status) VALUES
(1, 4, N'QR-DH-1-4-XYZ', N'Confirmed'),
(1, 5, N'QR-DH-1-5-ABC', N'Confirmed'),
(2, 5, N'QR-BT-2-5-LMN', N'Confirmed');

-- 11. WAITLIST (If event was full)
INSERT INTO [RegistrationWaitlist] (EventID, UserID) VALUES (1, 6);

-- 12. ATTENDANCE (Hamid attended DevHack)
INSERT INTO [Attendance] (RegistrationID, CheckInMethod) VALUES (1, N'QR_Scan');

-- 13. TEAMS (For the Hackathon)
INSERT INTO [Teams] (EventID, TeamName, TeamLeaderID) VALUES (1, N'Team BitMasters', 4);
INSERT INTO [TeamMembers] (TeamID, UserID, InvitationStatus, JoinedAt) VALUES (1, 4, N'Accepted', SYSDATETIMEOFFSET());

-- 14. SKILLS
INSERT INTO [Skills] (SkillName, Category) VALUES (N'React.js', N'Technical'), (N'Teamwork', N'Soft Skill');
INSERT INTO [EventSkillMapping] (EventID, SkillID) VALUES (1, 1), (1, 2);

-- 15. ACHIEVEMENTS & CERTIFICATES
INSERT INTO [StudentAchievements] (UserID, EventID, Position, AchievementDate, Description) VALUES
(4, 1, N'1st Place', '2024-10-21', N'Won the grand prize in DevHack.');

INSERT INTO [Certificates] (UserID, EventID, CertificateType, CertificateURL) VALUES
(4, 1, N'Achievement', N'https://storage.eventdhondo.pk/cert/hamid_win.pdf');

-- 16. NOTIFICATIONS & PREFERENCES
INSERT INTO [NotificationPreferences] (UserID, NotificationType) VALUES (4, N'EventReminder'), (5, N'NewEvent');

INSERT INTO [Notifications] (UserID, Title, Message, RelatedEventID, Status) VALUES
(4, N'Registration Success', N'You are registered for DevHack!', 1, N'Sent');

-- 17. REVIEWS & RESPONSES
INSERT INTO [EventReviews] (EventID, UserID, AttendanceID, OverallRating, ReviewText) VALUES
(1, 4, 1, 5, N'Amazing event, very well organized!');

INSERT INTO [ReviewResponses] (ReviewID, OrganizerID, ResponseText) VALUES
(1, 2, N'Thank you Hamid! Glad you enjoyed it.');