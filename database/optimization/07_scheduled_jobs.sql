-- ============================================================================
-- MAP-LEDGER DATABASE OPTIMIZATION
-- Part 7: Scheduled Jobs for Summary Table Maintenance
-- ============================================================================
-- These SQL Server Agent jobs automatically refresh summary tables on a
-- schedule. Adjust the schedules based on your data change frequency.
-- ============================================================================

-- NOTE: These jobs require SQL Server Agent to be running.
-- For Azure SQL Database, use Azure Automation or Logic Apps instead.

-- ============================================================================
-- Helper Procedure: Refresh All Stale Client Mapping Summaries
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_RefreshAllStaleClientMappingSummaries' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_RefreshAllStaleClientMappingSummaries;
GO

CREATE PROCEDURE ml.usp_RefreshAllStaleClientMappingSummaries
    @MaxAgeMinutes INT = 60,
    @BatchSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StaleClients ml.StringListType;
    DECLARE @ProcessedCount INT = 0;
    DECLARE @TotalStale INT;

    -- Find clients with stale summaries
    INSERT INTO @StaleClients (STRING_VALUE)
    SELECT TOP (@BatchSize) cms.CLIENT_ID
    FROM ml.CLIENT_MAPPING_SUMMARY cms
    WHERE cms.LAST_CALCULATED_DTTM < DATEADD(MINUTE, -@MaxAgeMinutes, SYSUTCDATETIME())
    ORDER BY cms.LAST_CALCULATED_DTTM ASC;

    SET @TotalStale = @@ROWCOUNT;

    -- Also add clients with file records but no summary
    INSERT INTO @StaleClients (STRING_VALUE)
    SELECT DISTINCT cf.CLIENT_ID
    FROM ml.CLIENT_FILES cf
    INNER JOIN ml.FILE_RECORDS fr ON fr.FILE_UPLOAD_GUID = cf.FILE_UPLOAD_GUID
    WHERE cf.IS_DELETED = 0
      AND NOT EXISTS (
          SELECT 1 FROM ml.CLIENT_MAPPING_SUMMARY cms
          WHERE cms.CLIENT_ID = cf.CLIENT_ID
      )
      AND NOT EXISTS (
          SELECT 1 FROM @StaleClients sc
          WHERE sc.STRING_VALUE = cf.CLIENT_ID
      );

    SET @TotalStale = @TotalStale + @@ROWCOUNT;

    IF @TotalStale > 0
    BEGIN
        EXEC ml.usp_RefreshClientMappingSummary @ClientIds = @StaleClients;
        SET @ProcessedCount = @TotalStale;
    END

    SELECT
        @ProcessedCount AS clients_refreshed,
        @TotalStale AS total_stale_found;
END
GO

-- ============================================================================
-- Helper Procedure: Refresh All File Upload Summaries
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_RefreshAllFileUploadSummaries' AND schema_id = SCHEMA_ID('ml'))
    DROP PROCEDURE ml.usp_RefreshAllFileUploadSummaries;
GO

CREATE PROCEDURE ml.usp_RefreshAllFileUploadSummaries
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MissingGuids ml.GuidListType;

    -- Find file uploads without summaries
    INSERT INTO @MissingGuids (GUID_VALUE)
    SELECT DISTINCT fr.FILE_UPLOAD_GUID
    FROM ml.FILE_RECORDS fr
    WHERE NOT EXISTS (
        SELECT 1 FROM ml.FILE_UPLOAD_SUMMARY fus
        WHERE fus.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
    );

    DECLARE @MissingCount INT = @@ROWCOUNT;

    IF @MissingCount > 0
    BEGIN
        EXEC ml.usp_RefreshFileUploadSummary @FileUploadGuids = @MissingGuids;
    END

    SELECT @MissingCount AS file_uploads_refreshed;
END
GO

-- ============================================================================
-- SQL Server Agent Job: Refresh Stale Client Mapping Summaries
-- ============================================================================
-- Runs every 15 minutes to refresh stale client mapping summaries.
-- ============================================================================

USE msdb;
GO

-- Delete job if it exists
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'MapLedger_RefreshClientMappingSummaries')
BEGIN
    EXEC msdb.dbo.sp_delete_job @job_name = N'MapLedger_RefreshClientMappingSummaries';
END
GO

-- Create the job
EXEC msdb.dbo.sp_add_job
    @job_name = N'MapLedger_RefreshClientMappingSummaries',
    @enabled = 1,
    @description = N'Refreshes stale client mapping summaries in the MapLedger database.',
    @category_name = N'Database Maintenance',
    @owner_login_name = N'sa';
GO

-- Add job step
EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'MapLedger_RefreshClientMappingSummaries',
    @step_name = N'Refresh Summaries',
    @subsystem = N'TSQL',
    @command = N'EXEC ml.usp_RefreshAllStaleClientMappingSummaries @MaxAgeMinutes = 60, @BatchSize = 100;',
    @database_name = N'MapLedger', -- Change this to your database name
    @retry_attempts = 3,
    @retry_interval = 1;
GO

-- Add schedule (every 15 minutes)
EXEC msdb.dbo.sp_add_schedule
    @schedule_name = N'Every15Minutes_ClientSummary',
    @freq_type = 4, -- Daily
    @freq_interval = 1,
    @freq_subday_type = 4, -- Minutes
    @freq_subday_interval = 15,
    @active_start_time = 0;
GO

EXEC msdb.dbo.sp_attach_schedule
    @job_name = N'MapLedger_RefreshClientMappingSummaries',
    @schedule_name = N'Every15Minutes_ClientSummary';
GO

-- Add job to local server
EXEC msdb.dbo.sp_add_jobserver
    @job_name = N'MapLedger_RefreshClientMappingSummaries',
    @server_name = N'(LOCAL)';
GO

-- ============================================================================
-- SQL Server Agent Job: Refresh File Upload Summaries
-- ============================================================================
-- Runs every hour to ensure all file uploads have summary data.
-- ============================================================================

-- Delete job if it exists
IF EXISTS (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'MapLedger_RefreshFileUploadSummaries')
BEGIN
    EXEC msdb.dbo.sp_delete_job @job_name = N'MapLedger_RefreshFileUploadSummaries';
END
GO

-- Create the job
EXEC msdb.dbo.sp_add_job
    @job_name = N'MapLedger_RefreshFileUploadSummaries',
    @enabled = 1,
    @description = N'Refreshes file upload summaries for any uploads without summary data.',
    @category_name = N'Database Maintenance',
    @owner_login_name = N'sa';
GO

-- Add job step
EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'MapLedger_RefreshFileUploadSummaries',
    @step_name = N'Refresh Summaries',
    @subsystem = N'TSQL',
    @command = N'EXEC ml.usp_RefreshAllFileUploadSummaries;',
    @database_name = N'MapLedger', -- Change this to your database name
    @retry_attempts = 3,
    @retry_interval = 1;
GO

-- Add schedule (every hour)
EXEC msdb.dbo.sp_add_schedule
    @schedule_name = N'EveryHour_FileSummary',
    @freq_type = 4, -- Daily
    @freq_interval = 1,
    @freq_subday_type = 8, -- Hours
    @freq_subday_interval = 1,
    @active_start_time = 0;
GO

EXEC msdb.dbo.sp_attach_schedule
    @job_name = N'MapLedger_RefreshFileUploadSummaries',
    @schedule_name = N'EveryHour_FileSummary';
GO

-- Add job to local server
EXEC msdb.dbo.sp_add_jobserver
    @job_name = N'MapLedger_RefreshFileUploadSummaries',
    @server_name = N'(LOCAL)';
GO

USE [MapLedger]; -- Change this to your database name
GO

PRINT 'Scheduled jobs created successfully.';
PRINT 'NOTE: Update the database name in the job steps if your database is not named "MapLedger".';
PRINT 'NOTE: For Azure SQL Database, use Azure Automation Runbooks or Logic Apps instead of SQL Agent jobs.';
GO

-- ============================================================================
-- Azure SQL Alternative: Elastic Jobs or Automation Runbooks
-- ============================================================================
-- If using Azure SQL Database, you cannot use SQL Server Agent.
-- Instead, use one of these approaches:
--
-- Option 1: Azure Automation Runbook
-- - Create an Azure Automation Account
-- - Create a PowerShell runbook that executes the stored procedures
-- - Schedule the runbook to run on your desired interval
--
-- Option 2: Azure Logic Apps
-- - Create a Logic App with a Recurrence trigger
-- - Add a "SQL Server - Execute stored procedure" action
-- - Configure it to call the refresh procedures
--
-- Option 3: Azure Functions Timer Trigger
-- - Create an Azure Function with a Timer trigger
-- - Use the SQL client to execute the stored procedures
--
-- Example Azure Function (C#):
-- [FunctionName("RefreshMappingSummaries")]
-- public static async Task Run(
--     [TimerTrigger("0 */15 * * * *")] TimerInfo myTimer,
--     ILogger log)
-- {
--     using var conn = new SqlConnection(connectionString);
--     await conn.OpenAsync();
--     using var cmd = new SqlCommand("ml.usp_RefreshAllStaleClientMappingSummaries", conn);
--     cmd.CommandType = CommandType.StoredProcedure;
--     cmd.Parameters.AddWithValue("@MaxAgeMinutes", 60);
--     cmd.Parameters.AddWithValue("@BatchSize", 100);
--     await cmd.ExecuteNonQueryAsync();
-- }
-- ============================================================================
