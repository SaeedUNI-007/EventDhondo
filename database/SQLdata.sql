-- =============================================================================
-- SAMPLE DATA FOR ALL TABLES
-- Run this AFTER the schema script.
-- =============================================================================

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

-- 3. RESET the ID counter back to 0
DBCC CHECKIDENT ('Interests', RESEED, 0);

-- 4. Re-insert the data (Now it will start from 1, 2, 3...)
INSERT INTO Interests (InterestName, Category) VALUES
(N'Competitive Programming', N'Technical'),
(N'Web Development', N'Technical'),
(N'Cyber Security', N'Technical'),
(N'AI & Robotics', N'Technical'),
(N'Basketball', N'Sports'),
(N'Cricket', N'Sports'),
(N'Table Tennis', N'Sports'),
(N'Photography', N'Arts'),
(N'Graphic Design', N'Arts'),
(N'Public Speaking', N'Soft Skills');


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

