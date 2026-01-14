-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 3: Table-Valued Types (TVPs)
-- ============================================================================
-- These user-defined table types allow passing multiple rows to stored
-- procedures efficiently, eliminating the 2100 parameter limit workaround.
-- ============================================================================

-- ============================================================================
-- 1. EntityAccountMappingType
-- ============================================================================
-- Used for bulk upserts to ENTITY_ACCOUNT_MAPPING table.
-- Replaces the 150-row batch limitation in entityAccountMappingRepository.ts
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'EntityAccountMappingType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.EntityAccountMappingType AS TABLE (
        ENTITY_ID VARCHAR(36) NOT NULL,
        ENTITY_ACCOUNT_ID VARCHAR(36) NOT NULL,
        GL_MONTH DATE NULL,
        POLARITY VARCHAR(50) NULL,
        ORIGINAL_POLARITY VARCHAR(50) NULL,
        ORIGINAL_POLARITY_SET BIT NOT NULL DEFAULT 0,
        MODIFIED_POLARITY VARCHAR(50) NULL,
        MODIFIED_POLARITY_SET BIT NOT NULL DEFAULT 0,
        MAPPING_TYPE VARCHAR(50) NULL,
        PRESET_GUID VARCHAR(36) NULL,
        MAPPING_STATUS VARCHAR(50) NULL,
        EXCLUSION_PCT DECIMAL(10, 3) NULL,
        UPDATED_BY VARCHAR(100) NULL,
        PRIMARY KEY (ENTITY_ID, ENTITY_ACCOUNT_ID, GL_MONTH)
    );
END
GO

-- ============================================================================
-- 2. EntityScoaActivityType
-- ============================================================================
-- Used for bulk upserts to ENTITY_SCOA_ACTIVITY table.
-- Replaces the 400-row batch limitation in entityScoaActivityRepository.ts
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'EntityScoaActivityType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.EntityScoaActivityType AS TABLE (
        ENTITY_ID VARCHAR(36) NOT NULL,
        SCOA_ACCOUNT_ID VARCHAR(36) NOT NULL,
        ACTIVITY_MONTH DATE NOT NULL,
        ACTIVITY_VALUE DECIMAL(18, 2) NULL,
        UPDATED_BY VARCHAR(100) NULL,
        PRIMARY KEY (ENTITY_ID, SCOA_ACCOUNT_ID, ACTIVITY_MONTH)
    );
END
GO

-- ============================================================================
-- 3. ClientHeaderMappingType
-- ============================================================================
-- Used for bulk upserts to CLIENT_HEADER_MAPPING table.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'ClientHeaderMappingType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.ClientHeaderMappingType AS TABLE (
        TEMPLATE_HEADER VARCHAR(100) NOT NULL,
        SOURCE_HEADER VARCHAR(100) NULL,
        MAPPING_METHOD VARCHAR(50) NULL,
        FILE_UPLOAD_GUID VARCHAR(36) NULL,
        UPDATED_BY VARCHAR(100) NULL,
        PRIMARY KEY (TEMPLATE_HEADER)
    );
END
GO

-- ============================================================================
-- 4. ClientGlDataType
-- ============================================================================
-- Used for bulk inserts to CLIENT_GL_DATA table.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'ClientGlDataType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.ClientGlDataType AS TABLE (
        OPERATION_CD VARCHAR(36) NOT NULL,
        GL_ID VARCHAR(36) NOT NULL,
        GL_MONTH DATE NOT NULL,
        GL_VALUE DECIMAL(18, 2) NULL,
        PRIMARY KEY (OPERATION_CD, GL_ID, GL_MONTH)
    );
END
GO

-- ============================================================================
-- 5. GuidListType
-- ============================================================================
-- Generic type for passing lists of GUIDs to stored procedures.
-- Useful for IN clause replacements.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'GuidListType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.GuidListType AS TABLE (
        GUID_VALUE VARCHAR(36) NOT NULL PRIMARY KEY
    );
END
GO

-- ============================================================================
-- 6. StringListType
-- ============================================================================
-- Generic type for passing lists of strings to stored procedures.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'StringListType' AND schema_id = SCHEMA_ID('ml'))
BEGIN
    CREATE TYPE ml.StringListType AS TABLE (
        STRING_VALUE VARCHAR(255) NOT NULL PRIMARY KEY
    );
END
GO

PRINT 'Table-valued types created successfully.';
GO
