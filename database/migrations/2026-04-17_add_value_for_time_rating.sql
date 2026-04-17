IF COL_LENGTH('dbo.EventReviews', 'ValueForTimeRating') IS NULL
BEGIN
    ALTER TABLE dbo.EventReviews
    ADD ValueForTimeRating INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_Reviews_ValueForTimeRating'
      AND parent_object_id = OBJECT_ID('dbo.EventReviews')
)
BEGIN
    ALTER TABLE dbo.EventReviews WITH CHECK
    ADD CONSTRAINT CK_Reviews_ValueForTimeRating
    CHECK (ValueForTimeRating IS NULL OR ValueForTimeRating BETWEEN 1 AND 5);
END;
GO

CREATE OR ALTER VIEW dbo.vw_OrganizerReputationScore AS
SELECT
    op.UserID AS OrganizerID,
    op.OrganizationName,
    COUNT(er.ReviewID) AS TotalReviewsReceived,
    COUNT(DISTINCT e.EventID) AS TotalEventsHosted,
    CAST(AVG(CAST(er.OverallRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOverallRating,
    CAST(AVG(CAST(er.OrganizationQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgOrganizationRating,
    CAST(AVG(CAST(er.ContentQualityRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgContentRating,
    CAST(AVG(CAST(er.VenueRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgVenueRating,
    CAST(AVG(CAST(er.ValueForTimeRating AS FLOAT)) AS DECIMAL(5,2)) AS AvgValueForTimeRating,
    CAST(
        (
            ISNULL(AVG(CAST(er.OverallRating AS FLOAT)), 0) * 0.40
            + ISNULL(AVG(CAST(er.OrganizationQualityRating AS FLOAT)), 0) * 0.20
            + ISNULL(AVG(CAST(er.ContentQualityRating AS FLOAT)), 0) * 0.20
            + ISNULL(AVG(CAST(er.VenueRating AS FLOAT)), 0) * 0.10
            + ISNULL(AVG(CAST(er.ValueForTimeRating AS FLOAT)), 0) * 0.10
        )
        AS DECIMAL(5,2)
    ) AS ReputationScore
FROM OrganizerProfiles op
LEFT JOIN Events e ON e.OrganizerID = op.UserID
LEFT JOIN EventReviews er ON er.EventID = e.EventID
GROUP BY op.UserID, op.OrganizationName;
GO
