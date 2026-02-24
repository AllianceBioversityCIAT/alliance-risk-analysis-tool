# Infrastructure Quick Reference

Quick commands and configurations for common infrastructure tasks.

## Stack Information

```bash
# Get stack status
aws cloudformation describe-stacks --stack-name AllianceRiskStack

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name AllianceRiskStack \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
  --output table

# Get stack resources
aws cloudformation list-stack-resources \
  --stack-name AllianceRiskStack \
  --output table
```

## Deployment Commands

### CDK Deployment

```bash
cd infra

# Preview changes
pnpm diff

# Deploy with confirmation
pnpm deploy

# Deploy without confirmation (CI/CD)
pnpm deploy -- --require-approval never

# Synthesize template only
pnpm synth
```

### CloudFormation Deployment

```bash
cd infra

# Validate template
pnpm cfn:validate

# Deploy to environment
pnpm cfn:deploy dev
pnpm cfn:deploy staging
pnpm cfn:deploy production
```

## Lambda Functions

### Invoke Functions

```bash
# Test API Lambda
aws lambda invoke \
  --function-name alliance-risk-api \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  response.json && cat response.json

# Invoke Worker Lambda
aws lambda invoke \
  --function-name alliance-risk-worker \
  --payload '{"jobId":"123"}' \
  response.json
```

### View Logs

```bash
# Tail API Lambda logs
aws logs tail /aws/lambda/alliance-risk-api --follow

# Tail Worker Lambda logs
aws logs tail /aws/lambda/alliance-risk-worker --follow

# Filter errors only
aws logs tail /aws/lambda/alliance-risk-api \
  --filter-pattern "ERROR" \
  --follow

# Get logs from specific time
aws logs tail /aws/lambda/alliance-risk-api \
  --since 1h \
  --format short
```

### Update Function Code

```bash
# Build API
cd packages/api
pnpm build

# Package code
cd dist
zip -r ../api.zip .

# Update Lambda
aws lambda update-function-code \
  --function-name alliance-risk-api \
  --zip-file fileb://../api.zip
```

## Database Operations

### Connect to RDS

```bash
# Get endpoint from stack
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name AllianceRiskStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text)

# Get password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id alliance-risk/db-credentials \
  --query 'SecretString' \
  --output text | jq -r '.password')

# Connect
psql -h $DB_ENDPOINT -U postgres -d alliance_risk
```

### Run Migrations

```bash
cd packages/api

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:PASSWORD@ENDPOINT:5432/alliance_risk"

# Run migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed

# Open Prisma Studio
npx prisma studio
```

### Backup & Restore

```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier alliance-risk-db \
  --db-snapshot-identifier alliance-risk-backup-$(date +%Y%m%d)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier alliance-risk-db

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier alliance-risk-db-restored \
  --db-snapshot-identifier alliance-risk-backup-20260224
```

## S3 Operations

### File Bucket

```bash
# List files
aws s3 ls s3://alliance-risk-files-{account-id}/

# Upload file
aws s3 cp local-file.pdf s3://alliance-risk-files-{account-id}/uploads/

# Download file
aws s3 cp s3://alliance-risk-files-{account-id}/reports/report.pdf ./

# Delete file
aws s3 rm s3://alliance-risk-files-{account-id}/uploads/old-file.pdf

# Sync directory
aws s3 sync ./local-dir/ s3://alliance-risk-files-{account-id}/batch/
```

### Web Bucket

```bash
# Deploy frontend
cd packages/web
pnpm build
aws s3 sync out/ s3://alliance-risk-web-{account-id}/ --delete

# Set cache headers
aws s3 sync out/ s3://alliance-risk-web-{account-id}/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html"

aws s3 sync out/ s3://alliance-risk-web-{account-id}/ \
  --cache-control "public, max-age=0, must-revalidate" \
  --exclude "*" \
  --include "*.html"
```

## CloudFront Operations

```bash
# Get distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name AllianceRiskStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

# Invalidate cache (all files)
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"

# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/index.html" "/assets/*"

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id $DIST_ID \
  --id INVALIDATION_ID

# Get distribution config
aws cloudfront get-distribution --id $DIST_ID
```

## Cognito Operations

### User Management

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name AllianceRiskStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoUserPoolId`].OutputValue' \
  --output text)

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password TempPass123!

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --group-name admin

# List users
aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID

# Delete user
aws cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com

# Reset password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --password NewPass123! \
  --permanent
```

### Authentication Testing

```bash
# Get Client ID
CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name AllianceRiskStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoClientId`].OutputValue' \
  --output text)

# Initiate auth
aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=user@example.com,PASSWORD=Pass123!
```

## Monitoring

### CloudWatch Metrics

```bash
# Lambda invocations (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=alliance-risk-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=alliance-risk-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiId,Value=API_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### CloudWatch Alarms

```bash
# Create Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name alliance-risk-api-errors \
  --alarm-description "API Lambda errors > 5 in 5 minutes" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=alliance-risk-api \
  --evaluation-periods 1

# List alarms
aws cloudwatch describe-alarms

# Delete alarm
aws cloudwatch delete-alarms --alarm-names alliance-risk-api-errors
```

## Cost Management

```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Get cost forecast
aws ce get-cost-forecast \
  --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+30 days' +%Y-%m-%d) \
  --metric BLENDED_COST \
  --granularity MONTHLY

# Set budget
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

## Troubleshooting

### Check Stack Status

```bash
# Stack events (recent)
aws cloudformation describe-stack-events \
  --stack-name AllianceRiskStack \
  --max-items 20

# Failed resources
aws cloudformation describe-stack-events \
  --stack-name AllianceRiskStack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### Lambda Debugging

```bash
# Get function configuration
aws lambda get-function-configuration \
  --function-name alliance-risk-api

# Get function code location
aws lambda get-function \
  --function-name alliance-risk-api \
  --query 'Code.Location'

# List function versions
aws lambda list-versions-by-function \
  --function-name alliance-risk-api
```

### Network Debugging

```bash
# Test API endpoint
curl -X GET https://API_ENDPOINT/health

# Test with authentication
curl -X GET https://API_ENDPOINT/api/users \
  -H "Authorization: Bearer TOKEN"

# Check DNS resolution
nslookup CLOUDFRONT_DOMAIN

# Test CloudFront
curl -I https://CLOUDFRONT_DOMAIN
```

## Environment Variables

### Local Development

```bash
# packages/api/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/alliance_risk"
COGNITO_USER_POOL_ID="us-east-1_xxxxx"
COGNITO_CLIENT_ID="xxxxx"
COGNITO_REGION="us-east-1"
WORKER_LAMBDA_NAME="alliance-risk-worker"
FILE_BUCKET_NAME="alliance-risk-files-xxxxx"
ENVIRONMENT="development"
```

### Frontend Configuration

```bash
# packages/web/.env.local
NEXT_PUBLIC_API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"
NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_xxxxx"
NEXT_PUBLIC_COGNITO_CLIENT_ID="xxxxx"
```

## Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Stack operations
alias stack-status='aws cloudformation describe-stacks --stack-name AllianceRiskStack'
alias stack-outputs='aws cloudformation describe-stacks --stack-name AllianceRiskStack --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" --output table'
alias stack-events='aws cloudformation describe-stack-events --stack-name AllianceRiskStack --max-items 20'

# Lambda logs
alias logs-api='aws logs tail /aws/lambda/alliance-risk-api --follow'
alias logs-worker='aws logs tail /aws/lambda/alliance-risk-worker --follow'

# Deployment
alias deploy-infra='cd infra && pnpm deploy'
alias deploy-web='cd packages/web && pnpm build && aws s3 sync out/ s3://$(stack-outputs | grep WebBucketName | awk "{print \$4}")/ --delete'
```

## Emergency Procedures

### Rollback Deployment

```bash
# Cancel in-progress update
aws cloudformation cancel-update-stack --stack-name AllianceRiskStack

# Rollback to previous version
aws cloudformation continue-update-rollback --stack-name AllianceRiskStack
```

### Disable Lambda Function

```bash
# Update function to return error
aws lambda update-function-configuration \
  --function-name alliance-risk-api \
  --environment Variables={MAINTENANCE_MODE=true}
```

### Emergency Database Restore

```bash
# Get latest snapshot
SNAPSHOT=$(aws rds describe-db-snapshots \
  --db-instance-identifier alliance-risk-db \
  --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime) | [-1].DBSnapshotIdentifier' \
  --output text)

# Restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier alliance-risk-db-emergency \
  --db-snapshot-identifier $SNAPSHOT
```

## References

- Main documentation: [README.md](./README.md)
- CI/CD guide: [CI-CD.md](./CI-CD.md)
- AWS CLI reference: https://awscli.amazonaws.com/v2/documentation/api/latest/index.html
