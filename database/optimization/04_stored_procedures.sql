-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 4: Stored Procedures
-- ============================================================================
-- These stored procedures encapsulate complex query logic, provide better
-- execution plan caching, and support table-valued parameters for bulk ops.
-- ============================================================================

-- ============================================================================
-- 1. usp_UpsertEntityAccountMappings
-- ============================================================================
-- Bulk upserts entity account mappings using TVP.
-- Replaces the batch processing in entityAccountMappingRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_UpsertEntityAccountMappings' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_UpsertEntityAccountMappings;
GO

CREATE PROCEDURE ml.usp_UpsertEntityAccountMappings
    @Mappings ml.EntityAccountMappingType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    MERGE ml.ENTITY_ACCOUNT_MAPPING AS target
    USING @Mappings AS source
    ON target.ENTITY_ID = source.ENTITY_ID
        AND target.ENTITY_ACCOUNT_ID = source.ENTITY_ACCOUNT_ID
        AND ISNULL(CONVERT(VARCHAR(10), target.GL_MONTH, 23), '') = ISNULL(CONVERT(VARCHAR(10), source.GL_MONTH, 23), '')
    WHEN MATCHED THEN
        UPDATE SET
            POLARITY = ISNULL(source.POLARITY, target.POLARITY),
            ORIGINAL_POLARITY = CASE
                WHEN source.ORIGINAL_POLARITY_SET = 1 THEN source.ORIGINAL_POLARITY
                ELSE target.ORIGINAL_POLARITY
            END,
            MODIFIED_POLARITY = CASE
                WHEN source.MODIFIED_POLARITY_SET = 1 THEN source.MODIFIED_POLARITY
                ELSE target.MODIFIED_POLARITY
            END,
            MAPPING_TYPE = ISNULL(source.MAPPING_TYPE, target.MAPPING_TYPE),
            PRESET_GUID = ISNULL(source.PRESET_GUID, target.PRESET_GUID),
            MAPPING_STATUS = ISNULL(source.MAPPING_STATUS, target.MAPPING_STATUS),
            EXCLUSION_PCT = ISNULL(source.EXCLUSION_PCT, target.EXCLUSION_PCT),
            GL_MONTH = ISNULL(source.GL_MONTH, target.GL_MONTH),
            UPDATED_BY = source.UPDATED_BY,
            UPDATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
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
            UPDATED_DTTM,
            UPDATED_BY
        ) VALUES (
            source.ENTITY_ID,
            source.ENTITY_ACCOUNT_ID,
            source.GL_MONTH,
            source.POLARITY,
            source.ORIGINAL_POLARITY,
            source.MODIFIED_POLARITY,
            source.MAPPING_TYPE,
            source.PRESET_GUID,
            source.MAPPING_STATUS,
            source.EXCLUSION_PCT,
            NULL,
            NULL
        )
    OUTPUT
        inserted.ENTITY_ID AS entity_id,
        inserted.ENTITY_ACCOUNT_ID AS entity_account_id,
        inserted.GL_MONTH AS gl_month,
        inserted.POLARITY AS polarity,
        inserted.ORIGINAL_POLARITY AS original_polarity,
        inserted.MODIFIED_POLARITY AS modified_polarity,
        inserted.MAPPING_TYPE AS mapping_type,
        inserted.PRESET_GUID AS preset_id,
        inserted.MAPPING_STATUS AS mapping_status,
        inserted.EXCLUSION_PCT AS exclusion_pct,
        inserted.INSERTED_DTTM AS inserted_dttm,
        inserted.UPDATED_DTTM AS updated_dttm,
        inserted.UPDATED_BY AS updated_by;

    COMMIT TRANSACTION;
END
GO

-- ============================================================================
-- 2. usp_UpsertEntityScoaActivity
-- ============================================================================
-- Bulk upserts entity SCOA activity using TVP.
-- Replaces the batch processing in entityScoaActivityRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_UpsertEntityScoaActivity' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_UpsertEntityScoaActivity;
GO

CREATE PROCEDURE ml.usp_UpsertEntityScoaActivity
    @Activities ml.EntityScoaActivityType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    MERGE ml.ENTITY_SCOA_ACTIVITY AS target
    USING @Activities AS source
    ON target.ENTITY_ID = source.ENTITY_ID
        AND target.SCOA_ACCOUNT_ID = source.SCOA_ACCOUNT_ID
        AND target.ACTIVITY_MONTH = source.ACTIVITY_MONTH
    WHEN MATCHED THEN
        UPDATE SET
            ACTIVITY_VALUE = source.ACTIVITY_VALUE,
            UPDATED_BY = source.UPDATED_BY,
            UPDATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
            ENTITY_ID,
            SCOA_ACCOUNT_ID,
            ACTIVITY_MONTH,
            ACTIVITY_VALUE,
            UPDATED_DTTM,
            UPDATED_BY
        ) VALUES (
            source.ENTITY_ID,
            source.SCOA_ACCOUNT_ID,
            source.ACTIVITY_MONTH,
            source.ACTIVITY_VALUE,
            NULL,
            NULL
        )
    OUTPUT
        inserted.ENTITY_ID AS entity_id,
        inserted.SCOA_ACCOUNT_ID AS scoa_account_id,
        inserted.ACTIVITY_MONTH AS activity_month,
        inserted.ACTIVITY_VALUE AS activity_value,
        inserted.INSERTED_DTTM AS inserted_dttm,
        inserted.UPDATED_DTTM AS updated_dttm,
        inserted.UPDATED_BY AS updated_by;

    COMMIT TRANSACTION;
END
GO

-- ============================================================================
-- 3. usp_UpsertClientHeaderMappings
-- ============================================================================
-- Bulk upserts client header mappings using TVP.
-- Replaces the MERGE in clientHeaderMappingRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_UpsertClientHeaderMappings' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_UpsertClientHeaderMappings;
GO

CREATE PROCEDURE ml.usp_UpsertClientHeaderMappings
    @ClientId VARCHAR(36),
    @Mappings ml.ClientHeaderMappingType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    MERGE ml.CLIENT_HEADER_MAPPING AS target
    USING (
        SELECT
            @ClientId AS CLIENT_ID,
            TEMPLATE_HEADER,
            SOURCE_HEADER,
            MAPPING_METHOD,
            FILE_UPLOAD_GUID,
            UPDATED_BY
        FROM @Mappings
    ) AS source
    ON target.CLIENT_ID = source.CLIENT_ID
        AND target.TEMPLATE_HEADER = source.TEMPLATE_HEADER
    WHEN MATCHED AND (
        ISNULL(target.SOURCE_HEADER, '') <> ISNULL(source.SOURCE_HEADER, '') OR
        ISNULL(target.MAPPING_METHOD, '') <> ISNULL(source.MAPPING_METHOD, '') OR
        ISNULL(target.FILE_UPLOAD_GUID, '') <> ISNULL(source.FILE_UPLOAD_GUID, '')
    ) THEN
        UPDATE SET
            SOURCE_HEADER = source.SOURCE_HEADER,
            MAPPING_METHOD = source.MAPPING_METHOD,
            FILE_UPLOAD_GUID = source.FILE_UPLOAD_GUID,
            UPDATED_BY = source.UPDATED_BY,
            UPDATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED AND source.SOURCE_HEADER IS NOT NULL THEN
        INSERT (
            CLIENT_ID,
            TEMPLATE_HEADER,
            SOURCE_HEADER,
            MAPPING_METHOD,
            FILE_UPLOAD_GUID,
            INSERTED_DTTM
        ) VALUES (
            source.CLIENT_ID,
            source.TEMPLATE_HEADER,
            source.SOURCE_HEADER,
            source.MAPPING_METHOD,
            source.FILE_UPLOAD_GUID,
            SYSUTCDATETIME()
        );

    COMMIT TRANSACTION;

    -- Return the current mappings for this client
    SELECT
        CLIENT_ID AS client_id,
        TEMPLATE_HEADER AS template_header,
        SOURCE_HEADER AS source_header,
        MAPPING_METHOD AS mapping_method,
        FILE_UPLOAD_GUID AS file_upload_guid,
        INSERTED_DTTM AS inserted_dttm,
        UPDATED_DTTM AS updated_dttm,
        UPDATED_BY AS updated_by
    FROM ml.CLIENT_HEADER_MAPPING
    WHERE CLIENT_ID = @ClientId
    ORDER BY TEMPLATE_HEADER ASC;
END
GO

-- ============================================================================
-- 4. usp_GetLatestFileRecordsByClient
-- ============================================================================
-- Gets the latest file records for each entity/account/month per client.
-- Replaces the RankedRecords CTE in fileRecordRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_GetLatestFileRecordsByClient' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_GetLatestFileRecordsByClient;
GO

CREATE PROCEDURE ml.usp_GetLatestFileRecordsByClient
    @ClientId VARCHAR(36)
AS
BEGIN
    SET NOCOUNT ON;

    IF @ClientId IS NULL OR LTRIM(RTRIM(@ClientId)) = ''
    BEGIN
        -- Return empty result set with correct schema
        SELECT TOP 0
            CAST(NULL AS VARCHAR(36)) AS file_upload_guid,
            CAST(NULL AS INT) AS record_id,
            CAST(NULL AS VARCHAR(255)) AS source_sheet_name,
            CAST(NULL AS VARCHAR(36)) AS entity_id,
            CAST(NULL AS VARCHAR(36)) AS account_id,
            CAST(NULL AS VARCHAR(255)) AS account_name,
            CAST(NULL AS DECIMAL(18,2)) AS opening_balance,
            CAST(NULL AS DECIMAL(18,2)) AS closing_balance,
            CAST(NULL AS DECIMAL(18,2)) AS activity_amount,
            CAST(NULL AS DATE) AS gl_month,
            CAST(NULL AS VARCHAR(255)) AS user_defined1,
            CAST(NULL AS VARCHAR(255)) AS user_defined2,
            CAST(NULL AS VARCHAR(255)) AS user_defined3,
            CAST(NULL AS DATETIME2) AS inserted_dttm;
        RETURN;
    END

    ;WITH RankedRecords AS (
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
            ROW_NUMBER() OVER (
                PARTITION BY fr.ENTITY_ID, fr.ACCOUNT_ID, fr.GL_MONTH
                ORDER BY
                    COALESCE(cf.LAST_STEP_COMPLETED_DTTM, cf.INSERTED_DTTM, fr.INSERTED_DTTM) DESC,
                    fr.INSERTED_DTTM DESC,
                    fr.FILE_UPLOAD_GUID DESC,
                    fr.RECORD_ID DESC
            ) AS rn
        FROM ml.FILE_RECORDS fr
        INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
        WHERE cf.CLIENT_ID = @ClientId
          AND cf.IS_DELETED = 0
    )
    SELECT
        FILE_UPLOAD_GUID AS file_upload_guid,
        RECORD_ID AS record_id,
        SOURCE_SHEET_NAME AS source_sheet_name,
        ENTITY_ID AS entity_id,
        ACCOUNT_ID AS account_id,
        ACCOUNT_NAME AS account_name,
        OPENING_BALANCE AS opening_balance,
        CLOSING_BALANCE AS closing_balance,
        ACTIVITY_AMOUNT AS activity_amount,
        GL_MONTH AS gl_month,
        USER_DEFINED1 AS user_defined1,
        USER_DEFINED2 AS user_defined2,
        USER_DEFINED3 AS user_defined3,
        INSERTED_DTTM AS inserted_dttm
    FROM RankedRecords
    WHERE rn = 1
    ORDER BY SOURCE_SHEET_NAME ASC, RECORD_ID ASC;
END
GO

-- ============================================================================
-- 5. usp_GetClientMappingSummary
-- ============================================================================
-- Gets mapping summary for one or more clients.
-- Replaces the complex 5-CTE query in userClientRepository.ts
-- Optionally uses the summary table if available and fresh.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_GetClientMappingSummary' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_GetClientMappingSummary;
GO

CREATE PROCEDURE ml.usp_GetClientMappingSummary
    @ClientIds ml.StringListType READONLY,
    @UseSummaryTable BIT = 1,
    @MaxSummaryAgeMinutes INT = 60
AS
BEGIN
    SET NOCOUNT ON;

    -- If using summary table and it's fresh enough, return from there
    IF @UseSummaryTable = 1
    BEGIN
        -- Check if we have fresh data for all requested clients
        DECLARE @MissingOrStale INT;

        SELECT @MissingOrStale = COUNT(*)
        FROM @ClientIds c
        LEFT JOIN ml.CLIENT_MAPPING_SUMMARY cms ON cms.CLIENT_ID = c.STRING_VALUE
        WHERE cms.CLIENT_ID IS NULL
           OR cms.LAST_CALCULATED_DTTM < DATEADD(MINUTE, -@MaxSummaryAgeMinutes, SYSUTCDATETIME());

        IF @MissingOrStale = 0
        BEGIN
            -- All data is fresh, return from summary table
            SELECT
                cms.CLIENT_ID AS client_id,
                cms.TOTAL_ACCOUNTS AS total_accounts,
                cms.MAPPED_ACCOUNTS AS mapped_accounts
            FROM ml.CLIENT_MAPPING_SUMMARY cms
            INNER JOIN @ClientIds c ON c.STRING_VALUE = cms.CLIENT_ID;
            RETURN;
        END
    END

    -- Otherwise, calculate from scratch
    ;WITH RankedByPeriod AS (
        SELECT
            cf.CLIENT_ID AS client_id,
            fr.ENTITY_ID AS entity_id,
            fr.ACCOUNT_ID AS account_id,
            fr.GL_MONTH AS gl_month,
            COALESCE(fr.ACTIVITY_AMOUNT, 0) AS net_change,
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
        INNER JOIN @ClientIds c ON c.STRING_VALUE = cf.CLIENT_ID
        WHERE cf.IS_DELETED = 0
    ),
    LatestByPeriod AS (
        SELECT client_id, entity_id, account_id, gl_month, net_change
        FROM RankedByPeriod
        WHERE rn = 1
    ),
    MostRecentNonZero AS (
        SELECT
            client_id,
            entity_id,
            account_id,
            gl_month,
            ROW_NUMBER() OVER (
                PARTITION BY client_id, entity_id, account_id
                ORDER BY CASE WHEN net_change <> 0 THEN 0 ELSE 1 END, gl_month DESC
            ) AS account_rn
        FROM LatestByPeriod
    ),
    UniqueAccounts AS (
        SELECT client_id, entity_id, account_id, gl_month
        FROM MostRecentNonZero
        WHERE account_rn = 1
    ),
    RecordsWithMappings AS (
        SELECT
            ua.client_id,
            ua.entity_id,
            ua.account_id,
            ua.gl_month,
            eam.MAPPING_STATUS AS mapping_status,
            eam.MAPPING_TYPE AS mapping_type,
            eam.PRESET_GUID AS preset_id,
            eam.EXCLUSION_PCT AS exclusion_pct
        FROM UniqueAccounts ua
        OUTER APPLY (
            SELECT TOP 1
                eam.MAPPING_STATUS,
                eam.MAPPING_TYPE,
                eam.PRESET_GUID,
                eam.EXCLUSION_PCT
            FROM ml.ENTITY_ACCOUNT_MAPPING eam
            WHERE eam.ENTITY_ACCOUNT_ID = ua.account_id
              AND (eam.ENTITY_ID = ua.entity_id OR ua.entity_id IS NULL)
              AND (eam.GL_MONTH = ua.gl_month OR eam.GL_MONTH IS NULL)
            ORDER BY
                CASE WHEN eam.GL_MONTH = ua.gl_month THEN 0 ELSE 1 END,
                eam.UPDATED_DTTM DESC
        ) eam
    )
    SELECT
        client_id,
        COUNT(1) AS total_accounts,
        SUM(CASE
            WHEN LOWER(COALESCE(mapping_status, '')) IN ('unmapped', 'new') THEN 0
            WHEN LOWER(COALESCE(mapping_status, '')) IN ('mapped', 'excluded') THEN 1
            WHEN LOWER(COALESCE(mapping_type, '')) IN ('exclude', 'excluded') THEN 1
            WHEN preset_id IS NOT NULL THEN 1
            WHEN exclusion_pct IS NOT NULL THEN 1
            ELSE 0
        END) AS mapped_accounts
    FROM RecordsWithMappings
    GROUP BY client_id;
END
GO

-- ============================================================================
-- 6. usp_RefreshClientMappingSummary
-- ============================================================================
-- Refreshes the CLIENT_MAPPING_SUMMARY table for specified clients.
-- Can be called by triggers, scheduled jobs, or application code.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_RefreshClientMappingSummary' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_RefreshClientMappingSummary;
GO

CREATE PROCEDURE ml.usp_RefreshClientMappingSummary
    @ClientIds ml.StringListType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Create temp table to hold calculated summaries
    CREATE TABLE #Summaries (
        CLIENT_ID VARCHAR(36) PRIMARY KEY,
        TOTAL_ACCOUNTS INT,
        MAPPED_ACCOUNTS INT
    );

    -- Calculate summaries for requested clients
    ;WITH RankedByPeriod AS (
        SELECT
            cf.CLIENT_ID AS client_id,
            fr.ENTITY_ID AS entity_id,
            fr.ACCOUNT_ID AS account_id,
            fr.GL_MONTH AS gl_month,
            COALESCE(fr.ACTIVITY_AMOUNT, 0) AS net_change,
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
        INNER JOIN @ClientIds c ON c.STRING_VALUE = cf.CLIENT_ID
        WHERE cf.IS_DELETED = 0
    ),
    LatestByPeriod AS (
        SELECT client_id, entity_id, account_id, gl_month, net_change
        FROM RankedByPeriod
        WHERE rn = 1
    ),
    MostRecentNonZero AS (
        SELECT
            client_id,
            entity_id,
            account_id,
            gl_month,
            ROW_NUMBER() OVER (
                PARTITION BY client_id, entity_id, account_id
                ORDER BY CASE WHEN net_change <> 0 THEN 0 ELSE 1 END, gl_month DESC
            ) AS account_rn
        FROM LatestByPeriod
    ),
    UniqueAccounts AS (
        SELECT client_id, entity_id, account_id, gl_month
        FROM MostRecentNonZero
        WHERE account_rn = 1
    ),
    RecordsWithMappings AS (
        SELECT
            ua.client_id,
            eam.MAPPING_STATUS AS mapping_status,
            eam.MAPPING_TYPE AS mapping_type,
            eam.PRESET_GUID AS preset_id,
            eam.EXCLUSION_PCT AS exclusion_pct
        FROM UniqueAccounts ua
        OUTER APPLY (
            SELECT TOP 1
                eam.MAPPING_STATUS,
                eam.MAPPING_TYPE,
                eam.PRESET_GUID,
                eam.EXCLUSION_PCT
            FROM ml.ENTITY_ACCOUNT_MAPPING eam
            WHERE eam.ENTITY_ACCOUNT_ID = ua.account_id
              AND (eam.ENTITY_ID = ua.entity_id OR ua.entity_id IS NULL)
              AND (eam.GL_MONTH = ua.gl_month OR eam.GL_MONTH IS NULL)
            ORDER BY
                CASE WHEN eam.GL_MONTH = ua.gl_month THEN 0 ELSE 1 END,
                eam.UPDATED_DTTM DESC
        ) eam
    )
    INSERT INTO #Summaries (CLIENT_ID, TOTAL_ACCOUNTS, MAPPED_ACCOUNTS)
    SELECT
        client_id,
        COUNT(1) AS total_accounts,
        SUM(CASE
            WHEN LOWER(COALESCE(mapping_status, '')) IN ('unmapped', 'new') THEN 0
            WHEN LOWER(COALESCE(mapping_status, '')) IN ('mapped', 'excluded') THEN 1
            WHEN LOWER(COALESCE(mapping_type, '')) IN ('exclude', 'excluded') THEN 1
            WHEN preset_id IS NOT NULL THEN 1
            WHEN exclusion_pct IS NOT NULL THEN 1
            ELSE 0
        END) AS mapped_accounts
    FROM RecordsWithMappings
    GROUP BY client_id;

    -- Upsert into summary table
    MERGE ml.CLIENT_MAPPING_SUMMARY AS target
    USING #Summaries AS source
    ON target.CLIENT_ID = source.CLIENT_ID
    WHEN MATCHED THEN
        UPDATE SET
            TOTAL_ACCOUNTS = source.TOTAL_ACCOUNTS,
            MAPPED_ACCOUNTS = source.MAPPED_ACCOUNTS,
            LAST_CALCULATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (CLIENT_ID, TOTAL_ACCOUNTS, MAPPED_ACCOUNTS, LAST_CALCULATED_DTTM)
        VALUES (source.CLIENT_ID, source.TOTAL_ACCOUNTS, source.MAPPED_ACCOUNTS, SYSUTCDATETIME());

    DROP TABLE #Summaries;

    -- Return updated summaries
    SELECT
        CLIENT_ID AS client_id,
        TOTAL_ACCOUNTS AS total_accounts,
        MAPPED_ACCOUNTS AS mapped_accounts,
        LAST_CALCULATED_DTTM AS last_calculated_dttm
    FROM ml.CLIENT_MAPPING_SUMMARY
    WHERE CLIENT_ID IN (SELECT STRING_VALUE FROM @ClientIds);
END
GO

-- ============================================================================
-- 7. usp_RefreshFileUploadSummary
-- ============================================================================
-- Refreshes the FILE_UPLOAD_SUMMARY table for specified file uploads.
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_RefreshFileUploadSummary' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_RefreshFileUploadSummary;
GO

CREATE PROCEDURE ml.usp_RefreshFileUploadSummary
    @FileUploadGuids ml.GuidListType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Calculate and upsert file upload summaries
    MERGE ml.FILE_UPLOAD_SUMMARY AS target
    USING (
        SELECT
            fr.FILE_UPLOAD_GUID,
            COUNT(*) AS TOTAL_RECORDS,
            MIN(fr.GL_MONTH) AS PERIOD_START,
            MAX(fr.GL_MONTH) AS PERIOD_END,
            COUNT(DISTINCT fr.ENTITY_ID) AS ENTITY_COUNT,
            COUNT(DISTINCT fr.ACCOUNT_ID) AS DISTINCT_ACCOUNTS
        FROM ml.FILE_RECORDS fr
        INNER JOIN @FileUploadGuids g ON g.GUID_VALUE = fr.FILE_UPLOAD_GUID
        GROUP BY fr.FILE_UPLOAD_GUID
    ) AS source
    ON target.FILE_UPLOAD_GUID = source.FILE_UPLOAD_GUID
    WHEN MATCHED THEN
        UPDATE SET
            TOTAL_RECORDS = source.TOTAL_RECORDS,
            PERIOD_START = source.PERIOD_START,
            PERIOD_END = source.PERIOD_END,
            ENTITY_COUNT = source.ENTITY_COUNT,
            DISTINCT_ACCOUNTS = source.DISTINCT_ACCOUNTS,
            LAST_CALCULATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
            FILE_UPLOAD_GUID,
            TOTAL_RECORDS,
            PERIOD_START,
            PERIOD_END,
            ENTITY_COUNT,
            DISTINCT_ACCOUNTS,
            LAST_CALCULATED_DTTM
        ) VALUES (
            source.FILE_UPLOAD_GUID,
            source.TOTAL_RECORDS,
            source.PERIOD_START,
            source.PERIOD_END,
            source.ENTITY_COUNT,
            source.DISTINCT_ACCOUNTS,
            SYSUTCDATETIME()
        );

    -- Also update entity counts
    MERGE ml.FILE_UPLOAD_ENTITY_COUNTS AS target
    USING (
        SELECT
            fr.FILE_UPLOAD_GUID,
            fr.ENTITY_ID,
            COUNT(*) AS RECORD_COUNT
        FROM ml.FILE_RECORDS fr
        INNER JOIN @FileUploadGuids g ON g.GUID_VALUE = fr.FILE_UPLOAD_GUID
        WHERE fr.ENTITY_ID IS NOT NULL
        GROUP BY fr.FILE_UPLOAD_GUID, fr.ENTITY_ID
    ) AS source
    ON target.FILE_UPLOAD_GUID = source.FILE_UPLOAD_GUID
        AND target.ENTITY_ID = source.ENTITY_ID
    WHEN MATCHED THEN
        UPDATE SET
            RECORD_COUNT = source.RECORD_COUNT,
            LAST_CALCULATED_DTTM = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (FILE_UPLOAD_GUID, ENTITY_ID, RECORD_COUNT, LAST_CALCULATED_DTTM)
        VALUES (source.FILE_UPLOAD_GUID, source.ENTITY_ID, source.RECORD_COUNT, SYSUTCDATETIME());

    -- Return updated summaries
    SELECT
        fus.FILE_UPLOAD_GUID AS file_upload_guid,
        fus.TOTAL_RECORDS AS total_records,
        fus.PERIOD_START AS period_start,
        fus.PERIOD_END AS period_end,
        fus.ENTITY_COUNT AS entity_count,
        fus.DISTINCT_ACCOUNTS AS distinct_accounts
    FROM ml.FILE_UPLOAD_SUMMARY fus
    INNER JOIN @FileUploadGuids g ON g.GUID_VALUE = fus.FILE_UPLOAD_GUID;
END
GO

-- ============================================================================
-- 8. usp_GetEntityAccountMappingsWithActivity
-- ============================================================================
-- Gets entity account mappings with activity data from the latest file upload.
-- Replaces the complex CTE query in entityAccountMappingRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_GetEntityAccountMappingsWithActivity' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_GetEntityAccountMappingsWithActivity;
GO

CREATE PROCEDURE ml.usp_GetEntityAccountMappingsWithActivity
    @EntityId VARCHAR(36),
    @GlMonths ml.StringListType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasMonthFilter BIT = CASE WHEN EXISTS (SELECT 1 FROM @GlMonths) THEN 1 ELSE 0 END;

    ;WITH LatestUploads AS (
        SELECT FILE_UPLOAD_GUID, ENTITY_ID, GL_MONTH
        FROM (
            SELECT
                fr.FILE_UPLOAD_GUID,
                fr.ENTITY_ID,
                fr.GL_MONTH,
                ROW_NUMBER() OVER (
                    PARTITION BY fr.ENTITY_ID, fr.GL_MONTH
                    ORDER BY fr.INSERTED_DTTM DESC, fr.FILE_UPLOAD_GUID DESC
                ) AS rn
            FROM ml.FILE_RECORDS fr
            WHERE fr.ENTITY_ID = @EntityId
              AND (@HasMonthFilter = 0 OR fr.GL_MONTH IN (SELECT STRING_VALUE FROM @GlMonths))
        ) ranked
        WHERE rn = 1
    ),
    ScopedRecords AS (
        SELECT frInner.*
        FROM ml.FILE_RECORDS frInner
        INNER JOIN LatestUploads lu
            ON lu.FILE_UPLOAD_GUID = frInner.FILE_UPLOAD_GUID
            AND lu.GL_MONTH = frInner.GL_MONTH
            AND (frInner.ENTITY_ID = lu.ENTITY_ID OR frInner.ENTITY_ID IS NULL)
    )
    SELECT
        fr.FILE_UPLOAD_GUID AS file_upload_guid,
        fr.RECORD_ID AS record_id,
        COALESCE(fr.ENTITY_ID, @EntityId) AS entity_id,
        fr.ACCOUNT_ID AS entity_account_id,
        fr.ACCOUNT_NAME AS account_name,
        fr.ACTIVITY_AMOUNT AS activity_amount,
        fr.GL_MONTH AS gl_month,
        eam.POLARITY AS polarity,
        eam.ORIGINAL_POLARITY AS original_polarity,
        eam.MODIFIED_POLARITY AS modified_polarity,
        eam.MAPPING_TYPE AS mapping_type,
        eam.PRESET_GUID AS preset_id,
        eam.MAPPING_STATUS AS mapping_status,
        eam.EXCLUSION_PCT AS exclusion_pct,
        eam.INSERTED_DTTM AS inserted_dttm,
        eam.UPDATED_DTTM AS updated_dttm,
        eam.UPDATED_BY AS updated_by,
        emd.BASIS_DATAPOINT AS basis_datapoint,
        emd.TARGET_DATAPOINT AS target_datapoint,
        emd.IS_CALCULATED AS is_calculated,
        emd.SPECIFIED_PCT AS specified_pct,
        emd.RECORD_ID AS preset_detail_record_id
    FROM ScopedRecords fr
    OUTER APPLY (
        SELECT TOP 1 *
        FROM ml.ENTITY_ACCOUNT_MAPPING eam
        WHERE eam.ENTITY_ACCOUNT_ID = fr.ACCOUNT_ID
          AND (eam.ENTITY_ID = fr.ENTITY_ID OR fr.ENTITY_ID IS NULL)
          AND (eam.GL_MONTH = fr.GL_MONTH OR eam.GL_MONTH IS NULL)
        ORDER BY
            CASE WHEN eam.GL_MONTH = fr.GL_MONTH THEN 0 ELSE 1 END,
            eam.UPDATED_DTTM DESC
    ) eam
    LEFT JOIN ml.ENTITY_MAPPING_PRESETS emp ON emp.PRESET_GUID = eam.PRESET_GUID
    LEFT JOIN ml.ENTITY_MAPPING_PRESET_DETAIL emd ON emd.PRESET_GUID = emp.PRESET_GUID
    WHERE (fr.ENTITY_ID = @EntityId OR fr.ENTITY_ID IS NULL)
    ORDER BY fr.SOURCE_SHEET_NAME ASC, fr.RECORD_ID ASC;
END
GO

-- ============================================================================
-- 9. usp_InsertClientGlData
-- ============================================================================
-- Bulk inserts client GL data, skipping existing records.
-- Replaces the MERGE in clientGlDataRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_InsertClientGlData' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_InsertClientGlData;
GO

CREATE PROCEDURE ml.usp_InsertClientGlData
    @Data ml.ClientGlDataType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @InsertedCount INT = 0;
    DECLARE @TotalCount INT = (SELECT COUNT(*) FROM @Data);

    -- Insert only non-existing records
    INSERT INTO ml.CLIENT_GL_DATA (OPERATION_CD, GL_ID, GL_MONTH, GL_VALUE)
    SELECT d.OPERATION_CD, d.GL_ID, d.GL_MONTH, d.GL_VALUE
    FROM @Data d
    WHERE NOT EXISTS (
        SELECT 1
        FROM ml.CLIENT_GL_DATA existing
        WHERE existing.OPERATION_CD = d.OPERATION_CD
          AND existing.GL_ID = d.GL_ID
          AND existing.GL_MONTH = d.GL_MONTH
    );

    SET @InsertedCount = @@ROWCOUNT;

    SELECT
        @InsertedCount AS created,
        (@TotalCount - @InsertedCount) AS skipped;
END
GO

-- ============================================================================
-- 10. usp_GetClientOperationalStats
-- ============================================================================
-- Gets operational statistics for a client, optionally filtered by GL month.
-- Replaces the JOIN query in clientOperationalStatsRepository.ts
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_GetClientOperationalStats' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_GetClientOperationalStats;
GO

CREATE PROCEDURE ml.usp_GetClientOperationalStats
    @ClientId VARCHAR(36),
    @GlMonth DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @ClientId IS NULL OR LTRIM(RTRIM(@ClientId)) = ''
    BEGIN
        SELECT TOP 0
            CAST(NULL AS VARCHAR(36)) AS operation_cd,
            CAST(NULL AS DATE) AS gl_month,
            CAST(NULL AS VARCHAR(36)) AS account_number,
            CAST(NULL AS DECIMAL(18,2)) AS gl_value;
        RETURN;
    END

    -- Try to use the optimized view first
    IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_CLIENT_OPERATIONAL_STATS_DETAIL' AND schema_id = SCHEMA_ID('ml'))
    BEGIN
        SELECT
            OPERATION_CD AS operation_cd,
            GL_MONTH AS gl_month,
            ACCOUNT_NUMBER AS account_number,
            GL_VALUE AS gl_value
        FROM ml.V_CLIENT_OPERATIONAL_STATS_DETAIL
        WHERE CLIENT_ID = @ClientId
          AND (@GlMonth IS NULL OR GL_MONTH = @GlMonth)
        ORDER BY OPERATION_CD ASC, GL_MONTH ASC, ACCOUNT_NUMBER ASC;
    END
    ELSE
    BEGIN
        -- Fallback to direct query if view doesn't exist
        SELECT
            ops.OPERATION_CD AS operation_cd,
            gl.GL_MONTH AS gl_month,
            gl.GL_ID AS account_number,
            COALESCE(gl.GL_VALUE, 0) AS gl_value
        FROM ml.V_CLIENT_OPERATIONS ops
        INNER JOIN ml.CLIENT_GL_DATA gl ON gl.OPERATION_CD = ops.OPERATION_CD
        INNER JOIN ml.CHART_OF_ACCOUNTS coa ON coa.ACCOUNT_NUMBER = gl.GL_ID
        WHERE ops.CLIENT_ID = @ClientId
          AND coa.IS_FINANCIAL = 0
          AND (@GlMonth IS NULL OR gl.GL_MONTH = @GlMonth)
        ORDER BY ops.OPERATION_CD ASC, gl.GL_MONTH ASC, gl.GL_ID ASC;
    END
END
GO

PRINT 'Stored procedures created successfully.';
GO
