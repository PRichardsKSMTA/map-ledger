-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 1: Summary Tables
-- ============================================================================
-- These tables store pre-computed aggregations that are expensive to calculate
-- on-the-fly. They should be refreshed via triggers or scheduled jobs.
-- ============================================================================

-- ============================================================================
-- 1. CLIENT_MAPPING_SUMMARY
-- ============================================================================
-- Stores pre-computed mapping statistics per client.
-- Replaces the expensive 5-CTE query in userClientRepository.ts
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CLIENT_MAPPING_SUMMARY' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TABLE ml.CLIENT_MAPPING_SUMMARY (
        CLIENT_ID VARCHAR(36) NOT NULL,
        TOTAL_ACCOUNTS INT NOT NULL DEFAULT 0,
        MAPPED_ACCOUNTS INT NOT NULL DEFAULT 0,
        UNMAPPED_ACCOUNTS AS (TOTAL_ACCOUNTS - MAPPED_ACCOUNTS) PERSISTED,
        MAPPING_PERCENTAGE AS (
            CASE
                WHEN TOTAL_ACCOUNTS = 0 THEN 0.00
                ELSE CAST(MAPPED_ACCOUNTS AS DECIMAL(10,2)) / CAST(TOTAL_ACCOUNTS AS DECIMAL(10,2)) * 100
            END
        ) PERSISTED,
        LAST_CALCULATED_DTTM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CLIENT_MAPPING_SUMMARY PRIMARY KEY CLUSTERED (CLIENT_ID)
    );

    CREATE INDEX IX_CLIENT_MAPPING_SUMMARY_LAST_CALCULATED
        ON ml.CLIENT_MAPPING_SUMMARY (LAST_CALCULATED_DTTM);
END
GO

-- ============================================================================
-- 2. FILE_UPLOAD_SUMMARY
-- ============================================================================
-- Stores pre-computed file record statistics per upload.
-- Replaces the GROUP BY aggregations in clientFileRepository.ts
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FILE_UPLOAD_SUMMARY' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TABLE ml.FILE_UPLOAD_SUMMARY (
        FILE_UPLOAD_GUID VARCHAR(36) NOT NULL,
        TOTAL_RECORDS INT NOT NULL DEFAULT 0,
        PERIOD_START DATE NULL,
        PERIOD_END DATE NULL,
        ENTITY_COUNT INT NOT NULL DEFAULT 0,
        DISTINCT_ACCOUNTS INT NOT NULL DEFAULT 0,
        LAST_CALCULATED_DTTM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_FILE_UPLOAD_SUMMARY PRIMARY KEY CLUSTERED (FILE_UPLOAD_GUID),
        CONSTRAINT FK_FILE_UPLOAD_SUMMARY_CLIENT_FILES
            FOREIGN KEY (FILE_UPLOAD_GUID) REFERENCES ml.CLIENT_FILES(FILE_UPLOAD_GUID)
    );

    CREATE INDEX IX_FILE_UPLOAD_SUMMARY_PERIOD
        ON ml.FILE_UPLOAD_SUMMARY (PERIOD_START, PERIOD_END);
END
GO

-- ============================================================================
-- 3. FILE_UPLOAD_ENTITY_COUNTS
-- ============================================================================
-- Stores record counts per entity within each file upload.
-- Supports the entity-level breakdown queries.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FILE_UPLOAD_ENTITY_COUNTS' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TABLE ml.FILE_UPLOAD_ENTITY_COUNTS (
        FILE_UPLOAD_GUID VARCHAR(36) NOT NULL,
        ENTITY_ID VARCHAR(36) NOT NULL,
        RECORD_COUNT INT NOT NULL DEFAULT 0,
        LAST_CALCULATED_DTTM DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_FILE_UPLOAD_ENTITY_COUNTS PRIMARY KEY CLUSTERED (FILE_UPLOAD_GUID, ENTITY_ID),
        CONSTRAINT FK_FILE_UPLOAD_ENTITY_COUNTS_CLIENT_FILES
            FOREIGN KEY (FILE_UPLOAD_GUID) REFERENCES ml.CLIENT_FILES(FILE_UPLOAD_GUID)
    );
END
GO

-- ============================================================================
-- INITIAL DATA POPULATION FOR SUMMARY TABLES
-- ============================================================================
-- Run these once to populate the summary tables with existing data.
-- After initial population, use the stored procedures for updates.
-- ============================================================================

-- Populate FILE_UPLOAD_SUMMARY from existing data
INSERT INTO ml.FILE_UPLOAD_SUMMARY (
    FILE_UPLOAD_GUID,
    TOTAL_RECORDS,
    PERIOD_START,
    PERIOD_END,
    ENTITY_COUNT,
    DISTINCT_ACCOUNTS,
    LAST_CALCULATED_DTTM
)
SELECT
    fr.FILE_UPLOAD_GUID,
    COUNT(*) AS TOTAL_RECORDS,
    MIN(fr.GL_MONTH) AS PERIOD_START,
    MAX(fr.GL_MONTH) AS PERIOD_END,
    COUNT(DISTINCT fr.ENTITY_ID) AS ENTITY_COUNT,
    COUNT(DISTINCT fr.ACCOUNT_ID) AS DISTINCT_ACCOUNTS,
    SYSUTCDATETIME() AS LAST_CALCULATED_DTTM
FROM ml.FILE_RECORDS fr
WHERE NOT EXISTS (
    SELECT 1 FROM ml.FILE_UPLOAD_SUMMARY fus
    WHERE fus.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
)
GROUP BY fr.FILE_UPLOAD_GUID;
GO

-- Populate FILE_UPLOAD_ENTITY_COUNTS from existing data
INSERT INTO ml.FILE_UPLOAD_ENTITY_COUNTS (
    FILE_UPLOAD_GUID,
    ENTITY_ID,
    RECORD_COUNT,
    LAST_CALCULATED_DTTM
)
SELECT
    fr.FILE_UPLOAD_GUID,
    fr.ENTITY_ID,
    COUNT(*) AS RECORD_COUNT,
    SYSUTCDATETIME() AS LAST_CALCULATED_DTTM
FROM ml.FILE_RECORDS fr
WHERE fr.ENTITY_ID IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ml.FILE_UPLOAD_ENTITY_COUNTS fuec
    WHERE fuec.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
      AND fuec.ENTITY_ID = fr.ENTITY_ID
)
GROUP BY fr.FILE_UPLOAD_GUID, fr.ENTITY_ID;
GO

PRINT 'Summary tables created and populated successfully.';
GO
