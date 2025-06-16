# Function Guidelines

This folder contains individual Azure Functions.

- Each subfolder should implement one API endpoint such as `/api/industries`, `/api/masterclients`, `/api/operations`, `/api/gl/*`, and `/api/mapping/*`【F:MapLedger Runbook 3.html†L370-L380】【F:MapLedger Runbook 3.html†L500-L612】.
- Use TypeORM repositories from `src/entities` and `src/repositories` for data access.
- Validate JWT tokens and enforce RBAC for each request【F:MapLedger Runbook 3.html†L312-L321】.
- Write Jest tests that mock Azure Function context and external dependencies; aim for ≥80% coverage【F:MapLedger Runbook 3.html†L1341-L1372】.
