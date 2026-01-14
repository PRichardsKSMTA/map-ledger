# Map-Ledger Database Optimization Scripts

This directory contains SQL scripts to optimize the Map-Ledger database performance by introducing views, summary tables, stored procedures, and supporting indexes.

## Overview

The optimization targets these performance bottlenecks identified in the application code:

| Original Query | Location | Optimization |
|----------------|----------|--------------|
| Client Mapping Summary (5 CTEs) | `userClientRepository.ts:393-474` | Summary table + stored procedure |
| Entity Account Mappings with Activity | `entityAccountMappingRepository.ts:467-528` | Indexed view + stored procedure |
| Latest File Records | `fileRecordRepository.ts:227-272` | View + stored procedure |
| Bulk Entity Account Mapping Upsert | `entityAccountMappingRepository.ts:605-704` | Stored procedure with TVP |
| Entity SCOA Activity Upsert | `entityScoaActivityRepository.ts:226-264` | Stored procedure with TVP |
| Client Operational Statistics | `clientOperationalStatsRepository.ts:222-237` | Indexed view |
| Client Header Mapping Upsert | `clientHeaderMappingRepository.ts:223-253` | Stored procedure with TVP |
| File Record Aggregations | `clientFileRepository.ts:558-594` | Summary table |

## Installation Order

Run the scripts in numerical order:

```bash
1. 01_summary_tables.sql      # Creates summary tables
2. 02_indexed_views.sql       # Creates optimized views
3. 03_table_valued_types.sql  # Creates TVPs for bulk operations
4. 04_stored_procedures.sql   # Creates stored procedures
5. 05_triggers.sql            # Creates triggers for auto-refresh
6. 06_indexes.sql             # Creates supporting indexes
7. 07_scheduled_jobs.sql      # Creates maintenance jobs (optional)
```

## Script Descriptions

### 01_summary_tables.sql

Creates pre-computed summary tables:

- **`ml.CLIENT_MAPPING_SUMMARY`** - Stores total/mapped account counts per client
- **`ml.FILE_UPLOAD_SUMMARY`** - Stores record counts and date ranges per file upload
- **`ml.FILE_UPLOAD_ENTITY_COUNTS`** - Stores record counts per entity per file upload

### 02_indexed_views.sql

Creates views that materialize common JOIN patterns:

- **`ml.V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH`** - Latest file upload per entity/month
- **`ml.V_LATEST_FILE_RECORDS`** - Latest record per client/entity/account/month
- **`ml.V_CLIENT_OPERATIONAL_STATS_DETAIL`** - Pre-joined operational statistics
- **`ml.V_ENTITY_ACCOUNT_MAPPING_CURRENT`** - Current mapping per entity/account
- **`ml.V_FILE_RECORDS_WITH_MAPPINGS`** - File records with mapping data
- **`ml.V_CLIENT_ACCOUNT_SUMMARY`** - Account summaries with mapping status

### 03_table_valued_types.sql

Creates user-defined table types for bulk operations:

- **`ml.EntityAccountMappingType`** - For bulk mapping upserts
- **`ml.EntityScoaActivityType`** - For bulk SCOA activity upserts
- **`ml.ClientHeaderMappingType`** - For bulk header mapping upserts
- **`ml.ClientGlDataType`** - For bulk GL data inserts
- **`ml.GuidListType`** - Generic GUID list for IN clauses
- **`ml.StringListType`** - Generic string list for IN clauses

### 04_stored_procedures.sql

Creates stored procedures that encapsulate complex logic:

- **`ml.usp_UpsertEntityAccountMappings`** - Bulk upsert mappings (replaces 150-row batches)
- **`ml.usp_UpsertEntityScoaActivity`** - Bulk upsert SCOA activity (replaces 400-row batches)
- **`ml.usp_UpsertClientHeaderMappings`** - Bulk upsert header mappings
- **`ml.usp_GetLatestFileRecordsByClient`** - Get latest records per client
- **`ml.usp_GetClientMappingSummary`** - Get mapping summary (uses cache)
- **`ml.usp_RefreshClientMappingSummary`** - Refresh summary table
- **`ml.usp_RefreshFileUploadSummary`** - Refresh file upload summary
- **`ml.usp_GetEntityAccountMappingsWithActivity`** - Get mappings with activity
- **`ml.usp_InsertClientGlData`** - Bulk insert GL data
- **`ml.usp_GetClientOperationalStats`** - Get operational statistics

### 05_triggers.sql

Creates triggers for automatic summary table maintenance:

- **`ml.TR_FILE_RECORDS_AFTER_INSERT`** - Refresh file summary on insert
- **`ml.TR_FILE_RECORDS_AFTER_DELETE`** - Refresh file summary on delete
- **`ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_*`** - Mark client summaries stale on mapping changes
- **`ml.TR_CLIENT_FILES_AFTER_*`** - Mark client summaries stale on file changes

### 06_indexes.sql

Creates supporting indexes for optimal query performance:

- Composite indexes for entity/account/month lookups
- Covering indexes to avoid key lookups
- Filtered indexes for common query patterns

### 07_scheduled_jobs.sql

Creates SQL Server Agent jobs for periodic maintenance:

- **`MapLedger_RefreshClientMappingSummaries`** - Runs every 15 minutes
- **`MapLedger_RefreshFileUploadSummaries`** - Runs every hour

## Usage in Application Code

### Before (Current Implementation)

```typescript
// entityAccountMappingRepository.ts - 150-row batch limit
const UPSERT_BATCH_SIZE = 150;
for (let i = 0; i < inputs.length; i += UPSERT_BATCH_SIZE) {
  const batch = inputs.slice(i, i + UPSERT_BATCH_SIZE);
  await upsertBatch(batch); // 1950 parameters per batch
}
```

### After (Using Stored Procedure with TVP)

```typescript
// Using mssql package with TVP
import sql from 'mssql';

const tvp = new sql.Table('ml.EntityAccountMappingType');
tvp.columns.add('ENTITY_ID', sql.VarChar(36));
tvp.columns.add('ENTITY_ACCOUNT_ID', sql.VarChar(36));
// ... add all columns

inputs.forEach(input => {
  tvp.rows.add(input.entityId, input.entityAccountId, ...);
});

const result = await pool.request()
  .input('Mappings', tvp)
  .execute('ml.usp_UpsertEntityAccountMappings');
```

### Using Summary Tables

```typescript
// userClientRepository.ts - Use cached summary
const result = await pool.request()
  .input('ClientIds', clientIdsTvp)
  .input('UseSummaryTable', true)
  .input('MaxSummaryAgeMinutes', 60)
  .execute('ml.usp_GetClientMappingSummary');
```

## Performance Expectations

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Client mapping summary | ~500ms | ~50ms | 10x |
| Bulk mapping upsert (1000 rows) | ~7 batches | ~1 call | 7x fewer round trips |
| File record aggregation | ~200ms | ~20ms | 10x |
| Entity account mappings | ~300ms | ~100ms | 3x |

## Maintenance

### Monitor Summary Table Freshness

```sql
-- Check client mapping summary freshness
SELECT
    CLIENT_ID,
    TOTAL_ACCOUNTS,
    MAPPED_ACCOUNTS,
    LAST_CALCULATED_DTTM,
    DATEDIFF(MINUTE, LAST_CALCULATED_DTTM, SYSUTCDATETIME()) AS age_minutes
FROM ml.CLIENT_MAPPING_SUMMARY
ORDER BY LAST_CALCULATED_DTTM ASC;
```

### Force Refresh All Summaries

```sql
-- Refresh all client mapping summaries
DECLARE @AllClients ml.StringListType;
INSERT INTO @AllClients (STRING_VALUE)
SELECT DISTINCT CLIENT_ID FROM ml.CLIENT_FILES WHERE IS_DELETED = 0;

EXEC ml.usp_RefreshClientMappingSummary @ClientIds = @AllClients;
```

### Check Index Health

```sql
-- Check index fragmentation
SELECT
    OBJECT_NAME(ips.object_id) AS TableName,
    i.name AS IndexName,
    ips.avg_fragmentation_in_percent
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
WHERE OBJECT_SCHEMA_NAME(ips.object_id) = 'ml'
  AND ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

## Azure SQL Database Notes

For Azure SQL Database, the SQL Server Agent jobs won't work. Use one of these alternatives:

1. **Azure Automation Runbooks** - PowerShell scripts that execute the stored procedures
2. **Azure Logic Apps** - Recurrence trigger with SQL connector
3. **Azure Functions** - Timer trigger with SQL client

See `07_scheduled_jobs.sql` for example implementations.

## Rollback

To remove all optimization objects:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS ml.TR_FILE_RECORDS_AFTER_INSERT;
DROP TRIGGER IF EXISTS ml.TR_FILE_RECORDS_AFTER_DELETE;
DROP TRIGGER IF EXISTS ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_INSERT;
DROP TRIGGER IF EXISTS ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_UPDATE;
DROP TRIGGER IF EXISTS ml.TR_ENTITY_ACCOUNT_MAPPING_AFTER_DELETE;
DROP TRIGGER IF EXISTS ml.TR_CLIENT_FILES_AFTER_INSERT;
DROP TRIGGER IF EXISTS ml.TR_CLIENT_FILES_AFTER_UPDATE;

-- Drop stored procedures
DROP PROCEDURE IF EXISTS ml.usp_UpsertEntityAccountMappings;
DROP PROCEDURE IF EXISTS ml.usp_UpsertEntityScoaActivity;
DROP PROCEDURE IF EXISTS ml.usp_UpsertClientHeaderMappings;
DROP PROCEDURE IF EXISTS ml.usp_GetLatestFileRecordsByClient;
DROP PROCEDURE IF EXISTS ml.usp_GetClientMappingSummary;
DROP PROCEDURE IF EXISTS ml.usp_RefreshClientMappingSummary;
DROP PROCEDURE IF EXISTS ml.usp_RefreshFileUploadSummary;
DROP PROCEDURE IF EXISTS ml.usp_GetEntityAccountMappingsWithActivity;
DROP PROCEDURE IF EXISTS ml.usp_InsertClientGlData;
DROP PROCEDURE IF EXISTS ml.usp_GetClientOperationalStats;
DROP PROCEDURE IF EXISTS ml.usp_RefreshAllStaleClientMappingSummaries;
DROP PROCEDURE IF EXISTS ml.usp_RefreshAllFileUploadSummaries;

-- Drop views
DROP VIEW IF EXISTS ml.V_LATEST_FILE_UPLOADS_BY_ENTITY_MONTH;
DROP VIEW IF EXISTS ml.V_LATEST_FILE_RECORDS;
DROP VIEW IF EXISTS ml.V_CLIENT_OPERATIONAL_STATS_DETAIL;
DROP VIEW IF EXISTS ml.V_ENTITY_ACCOUNT_MAPPING_CURRENT;
DROP VIEW IF EXISTS ml.V_FILE_RECORDS_WITH_MAPPINGS;
DROP VIEW IF EXISTS ml.V_CLIENT_ACCOUNT_SUMMARY;

-- Drop table types (must drop procedures using them first)
DROP TYPE IF EXISTS ml.EntityAccountMappingType;
DROP TYPE IF EXISTS ml.EntityScoaActivityType;
DROP TYPE IF EXISTS ml.ClientHeaderMappingType;
DROP TYPE IF EXISTS ml.ClientGlDataType;
DROP TYPE IF EXISTS ml.GuidListType;
DROP TYPE IF EXISTS ml.StringListType;

-- Drop summary tables
DROP TABLE IF EXISTS ml.FILE_UPLOAD_ENTITY_COUNTS;
DROP TABLE IF EXISTS ml.FILE_UPLOAD_SUMMARY;
DROP TABLE IF EXISTS ml.CLIENT_MAPPING_SUMMARY;

-- Drop indexes (only the ones added by this optimization)
-- Check sys.indexes before dropping to avoid removing original indexes
```
