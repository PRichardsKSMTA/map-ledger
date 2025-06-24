# MapLedger Backend

This package contains the Azure Functions that power the MapLedger API.

## Running locally

Install dependencies and start the Functions host:

```bash
cd backend
npm install
func start
```

`func start` requires Azure Functions Core Tools v4. The Functions host will
load environment variables from `local.settings.json` if present.

### Required environment variables

- `SQL_CONNECTION_STRING` – database connection string
- `BLOB_CONNECTION_STRING` – Azure Storage connection string

Secrets must be stored in Azure Key Vault and referenced from these variables
when running locally or in production.

## Pre-commit hook

The repository uses Husky to run `npm run lint` and `npm test` on every commit.
Ensure these commands pass before pushing changes.

## Folder structure

```
src/functions     - HTTP-triggered Azure Functions
src/entities      - TypeORM entity definitions
src/repositories  - data access repositories
src/utils         - shared utility modules
tests             - Jest unit tests
```

These folders follow the backend guidelines outlined in `backend/AGENTS.md`.
