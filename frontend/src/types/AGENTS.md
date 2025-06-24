# Types

**Purpose**    
Shared TypeScript types and interfaces.

## Key Exports
| Name | Type | Description |
|------|------|-------------|
| User | interface | Authenticated user fields |
| ClientProfile | interface | Client metadata structure |
| GLUpload | interface | GL upload session record |
| GLAccountRaw | interface | Parsed trial balance row |
| MappingSuggestion | interface | AI suggested mapping |
| FinalMapping | interface | Approved final mapping |

## Runbook Cross-References
§3 System Architecture

## Field Mapping
Backend API uses snake_case JSON whereas the UI consumes camelCase. Example:
`GLUploadID` → `glUploadId`, `FileURL` → `fileUrl`.

## TODO (owner: @unassigned)
1. Document mapping between API and UI fields
