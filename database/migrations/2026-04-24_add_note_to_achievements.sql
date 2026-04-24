USE [EventDhondo];
GO

/*
  Migration purpose:
  - Add Note column to StudentAchievements table
  - Note field stores organizer comments visible only to the student (not organizer dashboard)
*/

IF COL_LENGTH('dbo.StudentAchievements', 'Note') IS NULL
BEGIN
    ALTER TABLE [dbo].[StudentAchievements]
    ADD [Note] NVARCHAR(500) NULL;
    PRINT 'Added Note column to StudentAchievements table.';
END
ELSE
BEGIN
    PRINT 'Note column already exists in StudentAchievements table.';
END
GO

PRINT 'Migration 2026-04-24_add_note_to_achievements.sql completed.';
GO
