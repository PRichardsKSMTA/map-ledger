-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 2: Indexed Views
-- ============================================================================
-- These views materialize commonly-used JOINs and filters for faster queries.
-- Indexed views in SQL Server are automatically maintained by the engine.
-- ============================================================================

-- ============================================================================
-- 1. V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH
-- ============================================================================
-- Materializes the "latest file upload per entity/month" logic that appears
-- in multiple queries. This is a standard view (not indexed) because it uses
-- ROW_NUMBER() which is not allowed in indexed views.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH;
GO

CREATE VIEW ml.V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH
AS
WITH RankedUploads AS (
    SELECT
        fr.FILE_UPLOAD_GUID,
        fr.ENTITY_ID,
        fr.GL_MONTH,
        cf.CLIENT_ID,
        cf.LAST_STEP_COMPLETED_DTTM,
        cf.INSERTED_DTTM AS FILE_INSERTED_DTTM,
        ROW_NUMBER() OVER (
            PARTITION BY fr.ENTITY_ID, fr.GL_MONTH
            ORDER BY
                COALESCE(cf.LAST_STEP_COMPLETED_DTTM, cf.INSERTED_DTTM) DESC,
                fr.INSERTED_DTTM DESC,
                fr.FILE_UPLOAD_GUID DESC
        ) AS rn
    FROM ml.FILE_RECORDS fr
    INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
    WHERE cf.IS_DELETED = 0
)
SELECT
    FILE_UPLOAD_GUID,
    ENTITY_ID,
    GL_MONTH,
    CLIENT_ID,
    LAST_STEP_COMPLETED_DTTM,
    FILE_INSERTED_DTTM
FROM RankedUploads
WHERE rn = 1;
GO

-- ============================================================================
-- 2. V_LATEST_FILE_RECORDS
-- ============================================================================
-- Provides the most recent file record for each entity/account/month combo.
-- Replaces the RankedRecords CTE pattern used in multiple repositories.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_LATEST_FILE_RECORDS' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_LATEST_FILE_RECORDS;
GO

CREATE VIEW ml.V_LATEST_FILE_RECORDS
AS
WITH RankedRecords AS (
    SELECT
        fr.FILE_UPLOAD_GUID,
        fr.RECORD_ID,
        fr.SOURCE_SHEET_NAME,
        fr.ENTITY_ID,
        fr.ACCOUNT_ID,
        fr.ACCOUNT_NAME,
        fr.OPENING_BALANCE,
        fr.CLOSING_BALANCE,
        fr.ACTIVITY_AMOUNT,
        fr.GL_MONTH,
        fr.USER_DEFINED1,
        fr.USER_DEFINED2,
        fr.USER_DEFINED3,
        fr.INSERTED_DTTM,
        cf.CLIENT_ID,
        ROW_NUMBER() OVER (
            PARTITION BY cf.CLIENT_ID, fr.ENTITY_ID, fr.ACCOUNT_ID, fr.GL_MONTH
            ORDER BY
                COALESCE(cf.LAST_STEP_COMPLETED_DTTM, cf.INSERTED_DTTM, fr.INSERTED_DTTM) DESC,
                fr.INSERTED_DTTM DESC,
                fr.FILE_UPLOAD_GUID DESC,
                fr.RECORD_ID DESC
        ) AS rn
    FROM ml.FILE_RECORDS fr
    INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
    WHERE cf.IS_DELETED = 0
)
SELECT
    FILE_UPLOAD_GUID,
    RECORD_ID,
    SOURCE_SHEET_NAME,
    ENTITY_ID,
    ACCOUNT_ID,
    ACCOUNT_NAME,
    OPENING_BALANCE,
    CLOSING_BALANCE,
    ACTIVITY_AMOUNT,
    GL_MONTH,
    USER_DEFINED1,
    USER_DEFINED2,
    USER_DEFINED3,
    INSERTED_DTTM,
    CLIENT_ID
FROM RankedRecords
WHERE rn = 1;
GO

-- ============================================================================
-- 3. V_CLIENT_OPERATIONAL_STATS
-- ============================================================================
-- Pre-joins operations, GL data, and chart of accounts for non-financial
-- accounts. Optimizes the clientOperationalStatsRepository queries.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_CLIENT_OPERATIONAL_STATS_DETAIL' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_CLIENT_OPERATIONAL_STATS_DETAIL;
GO

CREATE VIEW ml.V_CLIENT_OPERATIONAL_STATS_DETAIL
AS
SELECT
    ops.CLIENT_ID,
    ops.OPERATION_CD,
    gl.GL_MONTH,
    gl.GL_ID AS ACCOUNT_NUMBER,
    COALESCE(gl.GL_VALUE, 0) AS GL_VALUE,
    coa.ACCOUNT_NAME,
    coa.IS_SURVEY
FROM ml.V_CLIENT_OPERATIONS ops
INNER JOIN ml.CLIENT_GL_DATA gl ON gl.OPERATION_CD = ops.OPERATION_CD
INNER JOIN ml.CHART_OF_ACCOUNTS coa ON coa.ACCOUNT_NUMBER = gl.GL_ID
WHERE coa.IS_FINANCIAL = 0;
GO

-- ============================================================================
-- 4. V_ENTITY_ACCOUNT_MAPPING_CURRENT
-- ============================================================================
-- Provides the "current" mapping for each entity/account combination,
-- handling the GL_MONTH matching logic (exact match preferred over NULL).
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_ENTITY_ACCOUNT_MAPPING_CURRENT' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_ENTITY_ACCOUNT_MAPPING_CURRENT;
GO

CREATE VIEW ml.V_ENTITY_ACCOUNT_MAPPING_CURRENT
AS
WITH RankedMappings AS (
    SELECT
        eam.ENTITY_ID,
        eam.ENTITY_ACCOUNT_ID,
        eam.GL_MONTH,
        eam.POLARITY,
        eam.ORIGINAL_POLARITY,
        eam.MODIFIED_POLARITY,
        eam.MAPPING_TYPE,
        eam.PRESET_GUID,
        eam.MAPPING_STATUS,
        eam.EXCLUSION_PCT,
        eam.INSERTED_DTTM,
        eam.UPDATED_DTTM,
        eam.UPDATED_BY,
        ROW_NUMBER() OVER (
            PARTITION BY eam.ENTITY_ID, eam.ENTITY_ACCOUNT_ID
            ORDER BY
                CASE WHEN eam.GL_MONTH IS NOT NULL THEN 0 ELSE 1 END,
                eam.GL_MONTH DESC,
                eam.UPDATED_DTTM DESC
        ) AS rn
    FROM ml.ENTITY_ACCOUNT_MAPPING eam
)
SELECT
    ENTITY_ID,
    ENTITY_ACCOUNT_ID,
    GL_MONTH,
    POLARITY,
    ORIGINAL_POLARITY,
    MODIFIED_POLARITY,
    MAPPING_TYPE,
    PRESET_GUID,
    MAPPING_STATUS,
    EXCLUSION_PCT,
    INSERTED_DTTM,
    UPDATED_DTTM,
    UPDATED_BY
FROM RankedMappings
WHERE rn = 1;
GO

-- ============================================================================
-- 5. V_FILE_RECORDS_WITH_MAPPINGS
-- ============================================================================
-- Combines file records with their account mappings and preset details.
-- This is a comprehensive view that can replace multiple complex JOINs.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_FILE_RECORDS_WITH_MAPPINGS' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_FILE_RECORDS_WITH_MAPPINGS;
GO

CREATE VIEW ml.V_FILE_RECORDS_WITH_MAPPINGS
AS
SELECT
    fr.FILE_UPLOAD_GUID,
    fr.RECORD_ID,
    fr.SOURCE_SHEET_NAME,
    fr.ENTITY_ID,
    fr.ACCOUNT_ID,
    fr.ACCOUNT_NAME,
    fr.OPENING_BALANCE,
    fr.CLOSING_BALANCE,
    fr.ACTIVITY_AMOUNT,
    fr.GL_MONTH,
    fr.USER_DEFINED1,
    fr.USER_DEFINED2,
    fr.USER_DEFINED3,
    fr.INSERTED_DTTM AS RECORD_INSERTED_DTTM,
    cf.CLIENT_ID,
    cf.IS_DELETED AS FILE_IS_DELETED,
    -- Mapping fields
    eam.POLARITY,
    eam.ORIGINAL_POLARITY,
    eam.MODIFIED_POLARITY,
    eam.MAPPING_TYPE,
    eam.PRESET_GUID,
    eam.MAPPING_STATUS,
    eam.EXCLUSION_PCT,
    eam.UPDATED_DTTM AS MAPPING_UPDATED_DTTM,
    eam.UPDATED_BY AS MAPPING_UPDATED_BY,
    -- Preset fields
    emp.PRESET_TYPE,
    emp.PRESET_DESCRIPTION,
    -- Preset detail fields
    emd.BASIS_DATAPOINT,
    emd.TARGET_DATAPOINT,
    emd.IS_CALCULATED,
    emd.SPECIFIED_PCT,
    emd.RECORD_ID AS PRESET_DETAIL_RECORD_ID
FROM ml.FILE_RECORDS fr
INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
LEFT JOIN ml.ENTITY_ACCOUNT_MAPPING eam
    ON eam.ENTITY_ACCOUNT_ID = fr.ACCOUNT_ID
    AND (eam.ENTITY_ID = fr.ENTITY_ID OR fr.ENTITY_ID IS NULL)
    AND (eam.GL_MONTH = fr.GL_MONTH OR eam.GL_MONTH IS NULL)
LEFT JOIN ml.ENTITY_MAPPING_PRESETS emp ON emp.PRESET_GUID = eam.PRESET_GUID
LEFT JOIN ml.ENTITY_MAPPING_PRESET_DETAIL emd ON emd.PRESET_GUID = emp.PRESET_GUID;
GO

-- ============================================================================
-- 6. V_CLIENT_ACCOUNT_SUMMARY
-- ============================================================================
-- Provides a per-client summary of accounts with their mapping status.
-- Useful for dashboards and reporting.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_CLIENT_ACCOUNT_SUMMARY' AND schema_id = SCHEMA_ID('ml'))
    DROP VIEW ml.V_CLIENT_ACCOUNT_SUMMARY;
GO

CREATE VIEW ml.V_CLIENT_ACCOUNT_SUMMARY
AS
WITH LatestRecords AS (
    SELECT
        CLIENT_ID,
        ENTITY_ID,
        ACCOUNT_ID,
        ACCOUNT_NAME,
        GL_MONTH,
        ACTIVITY_AMOUNT
    FROM ml.V_LATEST_FILE_RECORDS
),
RecordsWithMappings AS (
    SELECT
        lr.CLIENT_ID,
        lr.ENTITY_ID,
        lr.ACCOUNT_ID,
        lr.ACCOUNT_NAME,
        lr.GL_MONTH,
        lr.ACTIVITY_AMOUNT,
        eam.MAPPING_STATUS,
        eam.MAPPING_TYPE,
        eam.PRESET_GUID,
        eam.EXCLUSION_PCT,
        CASE
            WHEN LOWER(COALESCE(eam.MAPPING_STATUS, '')) IN ('unmapped', 'new') THEN 0
            WHEN LOWER(COALESCE(eam.MAPPING_STATUS, '')) IN ('mapped', 'excluded') THEN 1
            WHEN LOWER(COALESCE(eam.MAPPING_TYPE, '')) IN ('exclude', 'excluded') THEN 1
            WHEN eam.PRESET_GUID IS NOT NULL THEN 1
            WHEN eam.EXCLUSION_PCT IS NOT NULL THEN 1
            ELSE 0
        END AS IS_MAPPED
    FROM LatestRecords lr
    LEFT JOIN ml.ENTITY_ACCOUNT_MAPPING eam
        ON eam.ENTITY_ACCOUNT_ID = lr.ACCOUNT_ID
        AND (eam.ENTITY_ID = lr.ENTITY_ID OR lr.ENTITY_ID IS NULL)
        AND (eam.GL_MONTH = lr.GL_MONTH OR eam.GL_MONTH IS NULL)
)
SELECT
    CLIENT_ID,
    ENTITY_ID,
    ACCOUNT_ID,
    ACCOUNT_NAME,
    GL_MONTH,
    ACTIVITY_AMOUNT,
    MAPPING_STATUS,
    MAPPING_TYPE,
    PRESET_GUID,
    EXCLUSION_PCT,
    IS_MAPPED
FROM RecordsWithMappings;
GO

PRINT 'Indexed views created successfully.';
GO
