-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 6: Supporting Indexes
-- ============================================================================
-- These indexes support the views and stored procedures defined in this
-- optimization package. They should significantly improve query performance.
-- ============================================================================

-- ============================================================================
-- FILE_RECORDS Table Indexes
-- ============================================================================
-- These indexes support the deduplication queries that find the latest
-- record per entity/account/month.
-- ============================================================================

-- Composite index for entity/account/month lookups with covering columns
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_FILE_RECORDS_ENTITY_ACCOUNT_MONTH'
    AND object_id = OBJECT_ID('ml.FILE_RECORDS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_FILE_RECORDS_ENTITY_ACCOUNT_MONTH
    ON ml.FILE_RECORDS (ENTITY_ID, ACCOUNT_ID, GL_MONTH)
    INCLUDE (FILE_UPLOAD_GUID, RECORD_ID, ACCOUNT_NAME, ACTIVITY_AMOUNT, INSERTED_DTTM);

    PRINT 'Created IX_FILE_RECORDS_ENTITY_ACCOUNT_MONTH';
END
GO

-- Index for file upload GUID lookups (used in aggregations)
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_FILE_RECORDS_FILE_UPLOAD_GUID'
    AND object_id = OBJECT_ID('ml.FILE_RECORDS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_FILE_RECORDS_FILE_UPLOAD_GUID
    ON ml.FILE_RECORDS (FILE_UPLOAD_GUID)
    INCLUDE (ENTITY_ID, ACCOUNT_ID, GL_MONTH, ACTIVITY_AMOUNT);

    PRINT 'Created IX_FILE_RECORDS_FILE_UPLOAD_GUID';
END
GO

-- Index for GL_MONTH filtering
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_FILE_RECORDS_GL_MONTH'
    AND object_id = OBJECT_ID('ml.FILE_RECORDS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_FILE_RECORDS_GL_MONTH
    ON ml.FILE_RECORDS (GL_MONTH)
    INCLUDE (FILE_UPLOAD_GUID, ENTITY_ID, ACCOUNT_ID);

    PRINT 'Created IX_FILE_RECORDS_GL_MONTH';
END
GO

-- ============================================================================
-- CLIENT_FILES Table Indexes
-- ============================================================================

-- Index for client ID lookups with deletion filter
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CLIENT_FILES_CLIENT_ID_IS_DELETED'
    AND object_id = OBJECT_ID('ml.CLIENT_FILES')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CLIENT_FILES_CLIENT_ID_IS_DELETED
    ON ml.CLIENT_FILES (CLIENT_ID, IS_DELETED)
    INCLUDE (FILE_UPLOAD_GUID, LAST_STEP_COMPLETED_DTTM, INSERTED_DTTM);

    PRINT 'Created IX_CLIENT_FILES_CLIENT_ID_IS_DELETED';
END
GO

-- ============================================================================
-- ENTITY_ACCOUNT_MAPPING Table Indexes
-- ============================================================================

-- Composite index for entity/account lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_ACCOUNT_MAPPING_ENTITY_ACCOUNT'
    AND object_id = OBJECT_ID('ml.ENTITY_ACCOUNT_MAPPING')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_ACCOUNT_MAPPING_ENTITY_ACCOUNT
    ON ml.ENTITY_ACCOUNT_MAPPING (ENTITY_ID, ENTITY_ACCOUNT_ID)
    INCLUDE (GL_MONTH, MAPPING_STATUS, MAPPING_TYPE, PRESET_GUID, EXCLUSION_PCT, UPDATED_DTTM);

    PRINT 'Created IX_ENTITY_ACCOUNT_MAPPING_ENTITY_ACCOUNT';
END
GO

-- Index for account ID only (used in OUTER APPLY)
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_ACCOUNT_MAPPING_ACCOUNT_ID'
    AND object_id = OBJECT_ID('ml.ENTITY_ACCOUNT_MAPPING')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_ACCOUNT_MAPPING_ACCOUNT_ID
    ON ml.ENTITY_ACCOUNT_MAPPING (ENTITY_ACCOUNT_ID)
    INCLUDE (ENTITY_ID, GL_MONTH, MAPPING_STATUS, MAPPING_TYPE, PRESET_GUID, EXCLUSION_PCT, UPDATED_DTTM);

    PRINT 'Created IX_ENTITY_ACCOUNT_MAPPING_ACCOUNT_ID';
END
GO

-- Index for preset GUID lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_ACCOUNT_MAPPING_PRESET_GUID'
    AND object_id = OBJECT_ID('ml.ENTITY_ACCOUNT_MAPPING')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_ACCOUNT_MAPPING_PRESET_GUID
    ON ml.ENTITY_ACCOUNT_MAPPING (PRESET_GUID)
    WHERE PRESET_GUID IS NOT NULL;

    PRINT 'Created IX_ENTITY_ACCOUNT_MAPPING_PRESET_GUID';
END
GO

-- ============================================================================
-- ENTITY_MAPPING_PRESETS Table Indexes
-- ============================================================================

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_MAPPING_PRESETS_PRESET_GUID'
    AND object_id = OBJECT_ID('ml.ENTITY_MAPPING_PRESETS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_MAPPING_PRESETS_PRESET_GUID
    ON ml.ENTITY_MAPPING_PRESETS (PRESET_GUID)
    INCLUDE (PRESET_TYPE, PRESET_DESCRIPTION);

    PRINT 'Created IX_ENTITY_MAPPING_PRESETS_PRESET_GUID';
END
GO

-- ============================================================================
-- ENTITY_MAPPING_PRESET_DETAIL Table Indexes
-- ============================================================================

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_MAPPING_PRESET_DETAIL_PRESET_GUID'
    AND object_id = OBJECT_ID('ml.ENTITY_MAPPING_PRESET_DETAIL')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_MAPPING_PRESET_DETAIL_PRESET_GUID
    ON ml.ENTITY_MAPPING_PRESET_DETAIL (PRESET_GUID)
    INCLUDE (BASIS_DATAPOINT, TARGET_DATAPOINT, IS_CALCULATED, SPECIFIED_PCT, RECORD_ID);

    PRINT 'Created IX_ENTITY_MAPPING_PRESET_DETAIL_PRESET_GUID';
END
GO

-- ============================================================================
-- CLIENT_GL_DATA Table Indexes
-- ============================================================================

-- Composite index for operation code lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CLIENT_GL_DATA_OPERATION_CD'
    AND object_id = OBJECT_ID('ml.CLIENT_GL_DATA')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CLIENT_GL_DATA_OPERATION_CD
    ON ml.CLIENT_GL_DATA (OPERATION_CD)
    INCLUDE (GL_ID, GL_MONTH, GL_VALUE);

    PRINT 'Created IX_CLIENT_GL_DATA_OPERATION_CD';
END
GO

-- Composite index for GL ID lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CLIENT_GL_DATA_GL_ID'
    AND object_id = OBJECT_ID('ml.CLIENT_GL_DATA')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CLIENT_GL_DATA_GL_ID
    ON ml.CLIENT_GL_DATA (GL_ID)
    INCLUDE (OPERATION_CD, GL_MONTH, GL_VALUE);

    PRINT 'Created IX_CLIENT_GL_DATA_GL_ID';
END
GO

-- ============================================================================
-- CHART_OF_ACCOUNTS Table Indexes
-- ============================================================================

-- Index for IS_FINANCIAL filtering
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CHART_OF_ACCOUNTS_IS_FINANCIAL'
    AND object_id = OBJECT_ID('ml.CHART_OF_ACCOUNTS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CHART_OF_ACCOUNTS_IS_FINANCIAL
    ON ml.CHART_OF_ACCOUNTS (IS_FINANCIAL)
    INCLUDE (ACCOUNT_NUMBER, ACCOUNT_NAME, IS_SURVEY);

    PRINT 'Created IX_CHART_OF_ACCOUNTS_IS_FINANCIAL';
END
GO

-- Filtered index for non-financial accounts (most commonly queried)
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CHART_OF_ACCOUNTS_NON_FINANCIAL'
    AND object_id = OBJECT_ID('ml.CHART_OF_ACCOUNTS')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CHART_OF_ACCOUNTS_NON_FINANCIAL
    ON ml.CHART_OF_ACCOUNTS (ACCOUNT_NUMBER)
    INCLUDE (ACCOUNT_NAME, IS_SURVEY)
    WHERE IS_FINANCIAL = 0;

    PRINT 'Created IX_CHART_OF_ACCOUNTS_NON_FINANCIAL';
END
GO

-- ============================================================================
-- ENTITY_SCOA_ACTIVITY Table Indexes
-- ============================================================================

-- Composite index for entity/account lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ENTITY_SCOA_ACTIVITY_ENTITY_ACCOUNT'
    AND object_id = OBJECT_ID('ml.ENTITY_SCOA_ACTIVITY')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ENTITY_SCOA_ACTIVITY_ENTITY_ACCOUNT
    ON ml.ENTITY_SCOA_ACTIVITY (ENTITY_ID, SCOA_ACCOUNT_ID)
    INCLUDE (ACTIVITY_MONTH, ACTIVITY_VALUE);

    PRINT 'Created IX_ENTITY_SCOA_ACTIVITY_ENTITY_ACCOUNT';
END
GO

-- ============================================================================
-- CLIENT_HEADER_MAPPING Table Indexes
-- ============================================================================

-- Composite index for client/template header lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CLIENT_HEADER_MAPPING_CLIENT_TEMPLATE'
    AND object_id = OBJECT_ID('ml.CLIENT_HEADER_MAPPING')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CLIENT_HEADER_MAPPING_CLIENT_TEMPLATE
    ON ml.CLIENT_HEADER_MAPPING (CLIENT_ID, TEMPLATE_HEADER)
    INCLUDE (SOURCE_HEADER, MAPPING_METHOD, FILE_UPLOAD_GUID);

    PRINT 'Created IX_CLIENT_HEADER_MAPPING_CLIENT_TEMPLATE';
END
GO

-- Index for file upload GUID lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_CLIENT_HEADER_MAPPING_FILE_UPLOAD_GUID'
    AND object_id = OBJECT_ID('ml.CLIENT_HEADER_MAPPING')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CLIENT_HEADER_MAPPING_FILE_UPLOAD_GUID
    ON ml.CLIENT_HEADER_MAPPING (FILE_UPLOAD_GUID)
    WHERE FILE_UPLOAD_GUID IS NOT NULL;

    PRINT 'Created IX_CLIENT_HEADER_MAPPING_FILE_UPLOAD_GUID';
END
GO

PRINT 'All indexes created successfully.';
GO

-- ============================================================================
-- Index Maintenance Recommendations
-- ============================================================================
--
-- Run the following queries periodically to monitor index health:
--
-- 1. Check index fragmentation:
--    SELECT
--        OBJECT_NAME(ips.object_id) AS TableName,
--        i.name AS IndexName,
--        ips.avg_fragmentation_in_percent
--    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
--    JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
--    WHERE ips.avg_fragmentation_in_percent > 10
--    ORDER BY ips.avg_fragmentation_in_percent DESC;
--
-- 2. Check index usage:
--    SELECT
--        OBJECT_NAME(s.object_id) AS TableName,
--        i.name AS IndexName,
--        s.user_seeks,
--        s.user_scans,
--        s.user_lookups,
--        s.user_updates
--    FROM sys.dm_db_index_usage_stats s
--    JOIN sys.indexes i ON i.object_id = s.object_id AND i.index_id = s.index_id
--    WHERE s.database_id = DB_ID()
--    ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC;
--
-- 3. Rebuild fragmented indexes:
--    ALTER INDEX [IndexName] ON [TableName] REBUILD;
--
-- ============================================================================
