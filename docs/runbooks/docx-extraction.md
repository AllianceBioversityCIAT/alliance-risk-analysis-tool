# DOCX Extraction Runbook

## How To Check DOCX Extraction Latency

Run this CloudWatch Logs Insights query against `/aws/lambda/alliance-risk-worker`.

```sql
fields @timestamp, mode, download_ms, extract_ms, total_ms, content_length, fileName
| filter event = "extraction_complete"
| filter mime like /wordprocessingml/
| stats avg(total_ms) as avg_total_ms, pct(total_ms, 95) as p95_total_ms, max(total_ms) as max_total_ms, count(*) as docs by bin(5m)
| sort @timestamp desc
```

Expected timings:
- `p95_total_ms < 1000` for DOCX documents up to 500 KB
- investigate any document consistently over `5000 ms`

If you need recent per-file samples instead of aggregates, use:

```sql
fields @timestamp, fileName, mode, download_ms, extract_ms, total_ms, content_length
| filter event = "extraction_complete"
| filter mime like /wordprocessingml/
| sort @timestamp desc
| limit 50
```

## How To Roll Back From `text` To `html` Mode

Use the `IBD-DEV` AWS profile. AWS Lambda replaces the full `Variables` object on update, so re-send every existing variable, not just `DOCX_EXTRACTION_MODE`.

Worker:

```bash
AWS_PROFILE=IBD-DEV aws lambda update-function-configuration \
  --function-name alliance-risk-worker \
  --environment '{"Variables":{"ENVIRONMENT":"production","AWS_ACCOUNT_ID":"569113802249","S3_BUCKET_NAME":"alliance-risk-files-569113802249","DOCX_EXTRACTION_MODE":"html","DATABASE_URL":"<existing-database-url>","WORKER_ADMIN_TOKEN":"<existing-worker-admin-token>"}}'
```

API:

```bash
AWS_PROFILE=IBD-DEV aws lambda update-function-configuration \
  --function-name alliance-risk-api \
  --environment '{"Variables":{"ENVIRONMENT":"production","COGNITO_USER_POOL_ID":"<existing-user-pool-id>","COGNITO_CLIENT_ID":"<existing-client-id>","S3_BUCKET_NAME":"alliance-risk-files-569113802249","AWS_ACCOUNT_ID":"569113802249","WORKER_FUNCTION_NAME":"alliance-risk-worker","CORS_ORIGIN":"https://app.alliance-risk.example.com","DOCX_EXTRACTION_MODE":"html","DATABASE_URL":"<existing-database-url>"}}'
```

The change takes effect on the next cold start, typically within about 30 seconds.

## Known Pitfalls

- Lambda environment updates replace the full variable set. If you omit an existing variable, that variable is removed.
- Cold-start propagation is not instant. Allow about 30 seconds for new containers to pick up the updated mode.
- Validate the active mode from logs by checking the `mode` field in `extraction_complete` events.

## Reprocess Failed Word Documents

Dry run:

```bash
node packages/api/scripts/reprocess-failed-docx.js --dry-run
```

Execute:

```bash
node packages/api/scripts/reprocess-failed-docx.js
```
