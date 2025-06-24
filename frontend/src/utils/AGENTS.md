# Utils

**Purpose**    
Helper functions for data transformation.

## Key Exports
| Name | Type | Description |
|------|------|-------------|
| allocationCalculationService | function | Computes allocation ratios |
| getClientTemplateMapping | function | Loads mapping configuration |
| parseTrialBalanceWorkbook | function | Parses Excel GL data |
| suggestColumnMatch | function | Finds likely column matches |

## Runbook Cross-References
§4 Ingestion

## Common Errors
- **Invalid column headers** — thrown when required fields like `AccountCode` or `Description` are missing. Handled by `parseTrialBalanceWorkbook`.
- **Fetch failures** — `getClientTemplateMapping` rejects with `Error` when HTTP status is not OK.

## File Format Assumptions
- Trial balance uploads are Excel `.xlsx` workbooks with a single header row followed by data rows.
- Numeric values may be formatted as strings or numbers; parsing trims whitespace and converts numbers as needed.

## TODO (owner: @unassigned)
1. Provide additional CSV examples
2. Document edge cases for multi-sheet workbooks
