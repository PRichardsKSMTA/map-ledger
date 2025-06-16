# Entity Guidelines

TypeORM entities are defined here and map directly to the database schema.

- Implement entities for tables described in the runbook such as Industry, MasterClient, ClientOperation, COATemplate, COAAccount, GLUpload, GLAccountRaw, MappingSuggestion, and FinalMapping【F:MapLedger Runbook 3.html†L340-L566】.
- Define relations and cascades according to the schema.
- Entities should be fully typed in TypeScript.
- Unit tests should verify entity mappings as part of overall coverage requirements.
