USE [EventDhondo];
GO

/*
  Migration purpose:
  - Apply remaining DB work items (except indexing / DB-02)
  - Add stricter review integrity checks for existing databases
  - Add validation triggers for review integrity and organizer responses
*/

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Reviews_OrganizationQualityRating'
)
BEGIN
    ALTER TABLE [dbo].[EventReviews]
    ADD CONSTRAINT CK_Reviews_OrganizationQualityRating
    CHECK ([OrganizationQualityRating] IS NULL OR [OrganizationQualityRating] BETWEEN 1 AND 5);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Reviews_ContentQualityRating'
)
BEGIN
    ALTER TABLE [dbo].[EventReviews]
    ADD CONSTRAINT CK_Reviews_ContentQualityRating
    CHECK ([ContentQualityRating] IS NULL OR [ContentQualityRating] BETWEEN 1 AND 5);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Reviews_VenueRating'
)
BEGIN
    ALTER TABLE [dbo].[EventReviews]
    ADD CONSTRAINT CK_Reviews_VenueRating
    CHECK ([VenueRating] IS NULL OR [VenueRating] BETWEEN 1 AND 5);
END;
GO

IF OBJECT_ID(N'dbo.TR_EventReviews_ValidateAttendance', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_EventReviews_ValidateAttendance;
GO

CREATE TRIGGER dbo.TR_EventReviews_ValidateAttendance
ON dbo.EventReviews
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN Attendance a ON a.AttendanceID = i.AttendanceID
        LEFT JOIN Registrations r ON r.RegistrationID = a.RegistrationID
        WHERE a.AttendanceID IS NULL
           OR r.EventID <> i.EventID
           OR r.UserID <> i.UserID
    )
    BEGIN
        RAISERROR('EventReviews integrity violation: Attendance must belong to same EventID and UserID.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

IF OBJECT_ID(N'dbo.TR_ReviewResponses_ValidateOrganizer', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_ReviewResponses_ValidateOrganizer;
GO

CREATE TRIGGER dbo.TR_ReviewResponses_ValidateOrganizer
ON dbo.ReviewResponses
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN EventReviews er ON er.ReviewID = i.ReviewID
        JOIN Events e ON e.EventID = er.EventID
        WHERE e.OrganizerID <> i.OrganizerID
    )
    BEGIN
        RAISERROR('ReviewResponses integrity violation: Only the event organizer can respond.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

PRINT 'Migration 2026-04-10_db_remaining_work.sql completed.';
GO
