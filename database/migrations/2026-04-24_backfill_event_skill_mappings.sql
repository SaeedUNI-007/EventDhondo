USE [EventDhondo];
GO

/*
  Migration purpose:
  - Backfill EventSkillMapping so attended events can contribute skills
  - Ensure baseline skills exist for common event types
*/

DECLARE @TypeSkillMap TABLE (
    EventType NVARCHAR(20),
    SkillName NVARCHAR(100),
    Category NVARCHAR(50)
);

INSERT INTO @TypeSkillMap (EventType, SkillName, Category)
VALUES
    ('Competition', 'Problem Solving', 'Technical'),
    ('Competition', 'Teamwork', 'Soft Skills'),
    ('Workshop', 'Technical Learning', 'Technical'),
    ('Workshop', 'Collaboration', 'Soft Skills'),
    ('Seminar', 'Public Speaking', 'Soft Skills'),
    ('Seminar', 'Communication', 'Soft Skills'),
    ('Sports', 'Sportsmanship', 'Sports'),
    ('Sports', 'Teamwork', 'Soft Skills'),
    ('Cultural', 'Creativity', 'Arts'),
    ('Cultural', 'Collaboration', 'Soft Skills');

MERGE dbo.Skills AS target
USING (
    SELECT DISTINCT SkillName, Category
    FROM @TypeSkillMap
) AS source
ON target.SkillName = source.SkillName
WHEN NOT MATCHED THEN
    INSERT (SkillName, Category)
    VALUES (source.SkillName, source.Category);

INSERT INTO dbo.EventSkillMapping (EventID, SkillID)
SELECT
    e.EventID,
    s.SkillID
FROM dbo.Events e
JOIN @TypeSkillMap map
    ON LOWER(LTRIM(RTRIM(e.EventType))) = LOWER(map.EventType)
JOIN dbo.Skills s
    ON s.SkillName = map.SkillName
LEFT JOIN dbo.EventSkillMapping esm
    ON esm.EventID = e.EventID
   AND esm.SkillID = s.SkillID
WHERE esm.EventID IS NULL;

PRINT 'Migration 2026-04-24_backfill_event_skill_mappings.sql completed.';
GO
