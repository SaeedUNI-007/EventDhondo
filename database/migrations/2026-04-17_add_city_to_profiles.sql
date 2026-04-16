USE [EventDhondo];
GO

/*
  Migration purpose:
  - Add City columns to StudentProfiles, OrganizerProfiles, and Events
  - Backfill existing rows to one of: Lahore, Islamabad, Karachi
  - Add validation constraints for city values
*/

IF COL_LENGTH('dbo.StudentProfiles', 'City') IS NULL
BEGIN
    ALTER TABLE [dbo].[StudentProfiles]
    ADD [City] NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('dbo.OrganizerProfiles', 'City') IS NULL
BEGIN
    ALTER TABLE [dbo].[OrganizerProfiles]
    ADD [City] NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('dbo.Events', 'City') IS NULL
BEGIN
  ALTER TABLE [dbo].[Events]
  ADD [City] NVARCHAR(100) NULL;
END;
GO

-- Backfill StudentProfiles.City
UPDATE [dbo].[StudentProfiles]
SET [City] = CASE
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('lahore') THEN 'Lahore'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('islamabad') THEN 'Islamabad'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('karachi') THEN 'Karachi'
  ELSE NULL
END;

UPDATE [dbo].[StudentProfiles]
SET [City] = 'Lahore'
WHERE [City] IS NULL;
GO

-- Backfill OrganizerProfiles.City
UPDATE [dbo].[OrganizerProfiles]
SET [City] = CASE
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('lahore') THEN 'Lahore'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('islamabad') THEN 'Islamabad'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('karachi') THEN 'Karachi'
  ELSE NULL
END;

UPDATE [dbo].[OrganizerProfiles]
SET [City] = 'Lahore'
WHERE [City] IS NULL;
GO

-- Backfill Events.City from existing city/venue text where possible
UPDATE [dbo].[Events]
SET [City] = CASE
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('lahore') THEN 'Lahore'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('islamabad') THEN 'Islamabad'
  WHEN LOWER(LTRIM(RTRIM(ISNULL([City], '')))) IN ('karachi') THEN 'Karachi'
  WHEN LOWER(ISNULL([Venue], '')) LIKE '%islamabad%' THEN 'Islamabad'
  WHEN LOWER(ISNULL([Venue], '')) LIKE '%karachi%' THEN 'Karachi'
  WHEN LOWER(ISNULL([Venue], '')) LIKE '%lahore%' THEN 'Lahore'
  ELSE NULL
END;

UPDATE [dbo].[Events]
SET [City] = 'Lahore'
WHERE [City] IS NULL;
GO

-- Make Events.City required after backfill
ALTER TABLE [dbo].[Events]
ALTER COLUMN [City] NVARCHAR(100) NOT NULL;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_StudentProfiles_City_Allowed'
)
BEGIN
  ALTER TABLE [dbo].[StudentProfiles]
  ADD CONSTRAINT CK_StudentProfiles_City_Allowed
  CHECK ([City] IN ('Lahore', 'Islamabad', 'Karachi'));
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_OrganizerProfiles_City_Allowed'
)
BEGIN
  ALTER TABLE [dbo].[OrganizerProfiles]
  ADD CONSTRAINT CK_OrganizerProfiles_City_Allowed
  CHECK ([City] IN ('Lahore', 'Islamabad', 'Karachi'));
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Events_City_Allowed'
)
BEGIN
  ALTER TABLE [dbo].[Events]
  ADD CONSTRAINT CK_Events_City_Allowed
  CHECK ([City] IN ('Lahore', 'Islamabad', 'Karachi'));
END;
GO

CREATE OR ALTER VIEW [dbo].[vw_UpcomingEvents] AS
SELECT
  e.EventID,
  e.Title,
  e.Description,
  e.EventType,
  e.EventDate,
  e.EventTime,
  e.Venue,
  e.City,
  e.Capacity,
  e.Status,
  e.PosterURL,
  o.OrganizationName AS Organizer,
  o.ProfilePictureURL AS OrganizerLogo,
  (
    SELECT TOP 1 CategoryName
    FROM EventCategories ec
    JOIN EventCategoryMapping ecm ON ec.CategoryID = ecm.CategoryID
    WHERE ecm.EventID = e.EventID
  ) AS Category,
  (
    e.Capacity - (
      SELECT COUNT(*)
      FROM Registrations
      WHERE EventID = e.EventID AND Status = 'Confirmed'
    )
  ) AS AvailableSeats
FROM [dbo].[Events] e
JOIN [dbo].[OrganizerProfiles] o ON e.OrganizerID = o.UserID
WHERE e.Status = 'Published' AND e.EventDate >= CAST(GETDATE() AS DATE);
GO

PRINT 'Migration 2026-04-17_add_city_to_profiles.sql completed.';
GO
