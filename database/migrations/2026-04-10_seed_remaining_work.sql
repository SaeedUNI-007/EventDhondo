USE [EventDhondo];
GO

/*
  Seed purpose:
  - Ensure default notification preference rows exist
  - Ensure baseline event tags exist for recommendation mapping
*/

DECLARE @NotificationTypes TABLE (NotificationType NVARCHAR(50));
INSERT INTO @NotificationTypes (NotificationType)
VALUES
    (N'RegistrationConfirmation'),
    (N'EventReminder'),
    (N'RegistrationDeadline'),
    (N'NewMatchingEvent'),
    (N'EventUpdateOrCancellation'),
    (N'ResultAnnouncement');

INSERT INTO dbo.NotificationPreferences (UserID, NotificationType, EmailEnabled, InAppEnabled)
SELECT u.UserID, nt.NotificationType, 1, 1
FROM dbo.Users u
CROSS JOIN @NotificationTypes nt
WHERE u.Role = 'Student'
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.NotificationPreferences p
      WHERE p.UserID = u.UserID
        AND p.NotificationType = nt.NotificationType
  );
GO

DECLARE @Tags TABLE (TagName NVARCHAR(50));
INSERT INTO @Tags (TagName)
VALUES
    (N'AI / Machine Learning'),
    (N'Web Development'),
    (N'Cybersecurity / CTF'),
    (N'Data Science'),
    (N'Entrepreneurship / Startup Pitch'),
    (N'Sports'),
    (N'Cultural Activities'),
    (N'Research Seminars');

INSERT INTO dbo.EventTags (TagName)
SELECT t.TagName
FROM @Tags t
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.EventTags et WHERE et.TagName = t.TagName
);
GO

PRINT 'Seed 2026-04-10_seed_remaining_work.sql completed.';
GO
