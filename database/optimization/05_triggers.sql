-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 5: Triggers for Automatic Summary Table Updates
-- ============================================================================
-- These triggers automatically refresh summary tables when underlying data
-- changes. They ensure summary data stays current without manual intervention.
-- ============================================================================

-- ============================================================================
-- 1. TR_FILE_RECORDS_AFTER_INSERT_UPDATE_DELETE
-- ============================================================================
-- Automatically updates FILE_UPLOAD_SUMMARY when FILE_RECORDS changes.
-- Uses a lightweight approach that only updates affected file uploads.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_FILE_RECORDS_AFTER_INSERT')
    DROP TRIGGER ml.TR_FILE_RECORDS_AFTER_INSERT;
GO

CREATE TRIGGER ml.TR_FILE_RECORDS_AFTER_INSERT
ON ml.FILE_RECORDS
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Get distinct file upload GUIDs from inserted records
    DECLARE @AffectedGuids ml.GuidListType;

    INSERT INTO @AffectedGuids (GUID_VALUE)
    SELECT DISTINCT FILE_UPLOAD_GUID
    FROM inserted
    WHERE FILE_UPLOAD_GUID IS NOT NULL;

    -- Only refresh if we have affected GUIDs
    IF EXISTS (SELECT 1 FROM @AffectedGuids)
    BEGIN
        EXEC ml.usp_RefreshFileUploadSummary @FileUploadGuids = @AffectedGuids;
    END
END
GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_FILE_RECORDS_AFTER_DELETE')
    DROP TRIGGER ml.TR_FILE_RECORDS_AFTER_DELETE;
GO

CREATE TRIGGER ml.TR_FILE_RECORDS_AFTER_DELETE
ON ml.FILE_RECORDS
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @AffectedGuids ml.GuidListType;

    INSERT INTO @AffectedGuids (GUID_VALUE)
    SELECT DISTINCT FILE_UPLOAD_GUID
    FROM deleted
    WHERE FILE_UPLOAD_GUID IS NOT NULL;

    IF EXISTS (SELECT 1 FROM @AffectedGuids)
    BEGIN
        EXEC ml.usp_RefreshFileUploadSummary @FileUploadGuids = @AffectedGuids;
    END
END
GO

-- ============================================================================
-- 2. TR_ENTITY_ACCOUNT_MAPPING_AFTER_CHANGES
-- ============================================================================
-- Marks client mapping summaries as stale when mappings change.
-- Uses a flag approach rather than immediate recalculation to avoid
-- performance issues during bulk operations.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_ENTITY_ACCOUNT_MAPPING_AFTER_INSERT')
    DROP TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_INSERT;
GO

CREATE TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_INSERT
ON ml.ENTITY_ACCOUNT_MAPPING
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Mark affected clients' summaries as needing refresh
    -- We do this by setting LAST_CALCULATED_DTTM to an old date
    UPDATE cms
    SET LAST_CALCULATED_DTTM = '1900-01-01'
    FROM ml.CLIENT_MAPPING_SUMMARY cms
    WHERE EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN ml.FILE_RECORDS fr ON fr.ACCOUNT_ID = i.ENTITY_ACCOUNT_ID
        INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
        WHERE cf.CLIENT_ID = cms.CLIENT_ID
          AND cf.IS_DELETED = 0
    );
END
GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_ENTITY_ACCOUNT_MAPPING_AFTER_UPDATE')
    DROP TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_UPDATE;
GO

CREATE TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_UPDATE
ON ml.ENTITY_ACCOUNT_MAPPING
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only mark as stale if mapping status changed
    IF UPDATE(MAPPING_STATUS) OR UPDATE(MAPPING_TYPE) OR UPDATE(PRESET_GUID) OR UPDATE(EXCLUSION_PCT)
    BEGIN
        UPDATE cms
        SET LAST_CALCULATED_DTTM = '1900-01-01'
        FROM ml.CLIENT_MAPPING_SUMMARY cms
        WHERE EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN ml.FILE_RECORDS fr ON fr.ACCOUNT_ID = i.ENTITY_ACCOUNT_ID
            INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
            WHERE cf.CLIENT_ID = cms.CLIENT_ID
              AND cf.IS_DELETED = 0
        );
    END
END
GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_ENTITY_ACCOUNT_MAPPING_AFTER_DELETE')
    DROP TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_DELETE;
GO

CREATE TRIGGER ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_DELETE
ON ml.ENTITY_ACCOUNT_MAPPING
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE cms
    SET LAST_CALCULATED_DTTM = '1900-01-01'
    FROM ml.CLIENT_MAPPING_SUMMARY cms
    WHERE EXISTS (
        SELECT 1
        FROM deleted d
        INNER JOIN ml.FILE_RECORDS fr ON fr.ACCOUNT_ID = d.ENTITY_ACCOUNT_ID
        INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
        WHERE cf.CLIENT_ID = cms.CLIENT_ID
          AND cf.IS_DELETED = 0
    );
END
GO

-- ============================================================================
-- 3. TR_CLIENT_FILES_AFTER_CHANGES
-- ============================================================================
-- Updates client mapping summaries when files are added/deleted.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_CLIENT_FILES_AFTER_INSERT')
    DROP TRIGGER ml.TR_CLIENT_FILES_AFTER_INSERT;
GO

CREATE TRIGGER ml.TR_CLIENT_FILES_AFTER_INSERT
ON ml.CLIENT_FILES
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Mark affected clients' summaries as stale
    UPDATE cms
    SET LAST_CALCULATED_DTTM = '1900-01-01'
    FROM ml.CLIENT_MAPPING_SUMMARY cms
    INNER JOIN inserted i ON i.CLIENT_ID = cms.CLIENT_ID
    WHERE i.IS_DELETED = 0;
END
GO

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_CLIENT_FILES_AFTER_UPDATE')
    DROP TRIGGER ml.TR_CLIENT_FILES_AFTER_UPDATE;
GO

CREATE TRIGGER ml.TR_CLIENT_FILES_AFTER_UPDATE
ON ml.CLIENT_FILES
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only act if IS_DELETED changed
    IF UPDATE(IS_DELETED)
    BEGIN
        UPDATE cms
        SET LAST_CALCULATED_DTTM = '1900-01-01'
        FROM ml.CLIENT_MAPPING_SUMMARY cms
        INNER JOIN inserted i ON i.CLIENT_ID = cms.CLIENT_ID;
    END
END
GO

PRINT 'Triggers created successfully.';
GO
