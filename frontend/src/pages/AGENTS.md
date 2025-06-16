# Pages Guidelines

These files implement routeable pages.

- Pages should match the route list in the runbook and use React Router v6【F:MapLedger Runbook 3.html†L1028-L1037】.
- Enforce role-based access with MSAL.js; hide SuperUser pages when the user lacks that role【F:MapLedger Runbook 3.html†L312-L321】.
- Compose UI from components in `src/components` and maintain WCAG 2.1 AA accessibility【F:MapLedger Runbook 3.html†L840-L842】.
- Include tests for page behavior to help maintain ≥80% coverage.
