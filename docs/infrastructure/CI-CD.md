# CI/CD Implementation Guide

This guide provides step-by-step instructions for implementing Continuous Integration and Continuous Deployment for the Alliance Risk Analysis Tool.

## Overview

The CI/CD pipeline automates:
- Code quality checks (linting, testing)
- Building API and Web packages
- Deploying infrastructure via CDK
- Running database migrations
- Deploying frontend to S3/CloudFront

## Pipeline Architecture

```
Code Push → GitHub Actions → Build → Test → Deploy Infrastructure → Migrate DB → Deploy Frontend → Verify
```

## Prerequisites

### AWS Setup

1. **Create IAM User for CI/CD**:

```bash
aws iam create-user --user-name alliance-risk-cicd

aws iam attach-user-policy \
  --user-name alliance-risk-cicd \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

aws iam create-access-key --user-name alliance-risk-cicd
```

Save the `AccessKeyId` and `SecretAccessKey` for GitHub Secrets.

2. **Bootstrap CDK** (one-time per account/region):

```bash
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

### GitHub Setup

1. **Add Repository Secrets**:

Go to repository Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | From IAM user | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | From IAM user | AWS secret key |
| `AWS_REGION` | `us-east-1` | AWS region |
| `DATABASE_URL` | `postgresql://...` | RDS connection string |
| `WEB_BUCKET_NAME` | From stack output | S3 web bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | From stack output | CloudFront distribution ID |

2. **Enable GitHub Actions**:

Go to repository Settings → Actions → General → Allow all actions

## GitHub Actions Workflows

### 1. Main Deployment Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main
      - develop
  workflow_dispatch:

env:
  NODE_VERSION: '20'
  AWS_REGION: us-east-1

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install pnpm
        run: npm install -g pnpm@9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Test
        run: pnpm test
      
      - name: Build API
        run: pnpm --filter @alliance-risk/api build
      
      - name: Build Web
        run: pnpm --filter @alliance-risk/web build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_USER_POOL_ID }}
          NEXT_PUBLIC_COGNITO_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
      
      - name: Upload API artifacts
        uses: actions/upload-artifact@v4
        with:
          name: api-dist
          path: packages/api/dist
          retention-days: 1
      
      - name: Upload Web artifacts
        uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: packages/web/out
          retention-days: 1

  deploy-infrastructure:
    name: Deploy Infrastructure
    needs: build-and-test
    runs-on: ubuntu-latest
    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install pnpm
        run: npm install -g pnpm@9
      
      - name: Download API artifacts
        uses: actions/download-artifact@v4
        with:
          name: api-dist
          path: packages/api/dist
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Install CDK dependencies
        run: |
          cd infra
          pnpm install --frozen-lockfile
      
      - name: Deploy CDK stack
        run: |
          cd infra
          pnpm deploy -- --require-approval never
      
      - name: Get stack outputs
        id: stack-outputs
        run: |
          OUTPUTS=$(aws cloudformation describe-stacks \
            --stack-name AllianceRiskStack \
            --query 'Stacks[0].Outputs' \
            --output json)
          
          echo "API_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')" >> $GITHUB_OUTPUT
          echo "WEB_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="WebBucketName") | .OutputValue')" >> $GITHUB_OUTPUT
          echo "CLOUDFRONT_ID=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="CloudFrontDistributionId") | .OutputValue')" >> $GITHUB_OUTPUT
    
    outputs:
      api-url: ${{ steps.stack-outputs.outputs.API_URL }}
      web-bucket: ${{ steps.stack-outputs.outputs.WEB_BUCKET }}
      cloudfront-id: ${{ steps.stack-outputs.outputs.CLOUDFRONT_ID }}

  migrate-database:
    name: Run Database Migrations
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install pnpm
        run: npm install -g pnpm@9
      
      - name: Install dependencies
        run: |
          cd packages/api
          pnpm install --frozen-lockfile
      
      - name: Run Prisma migrations
        run: |
          cd packages/api
          npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  deploy-frontend:
    name: Deploy Frontend
    needs: [deploy-infrastructure, migrate-database]
    runs-on: ubuntu-latest
    
    steps:
      - name: Download Web artifacts
        uses: actions/download-artifact@v4
        with:
          name: web-dist
          path: web-dist
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Upload to S3
        run: |
          aws s3 sync web-dist/ s3://${{ needs.deploy-infrastructure.outputs.web-bucket }}/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html" \
            --exclude "*.json"
          
          aws s3 sync web-dist/ s3://${{ needs.deploy-infrastructure.outputs.web-bucket }}/ \
            --delete \
            --cache-control "public, max-age=0, must-revalidate" \
            --exclude "*" \
            --include "*.html" \
            --include "*.json"
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ needs.deploy-infrastructure.outputs.cloudfront-id }} \
            --paths "/*"

  verify-deployment:
    name: Verify Deployment
    needs: deploy-frontend
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Health check API
        run: |
          API_URL="${{ needs.deploy-infrastructure.outputs.api-url }}"
          RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/health)
          
          if [ $RESPONSE -eq 200 ]; then
            echo "✅ API health check passed"
          else
            echo "❌ API health check failed with status $RESPONSE"
            exit 1
          fi
      
      - name: Check Lambda logs
        run: |
          echo "Recent API Lambda logs:"
          aws logs tail /aws/lambda/alliance-risk-api --since 5m --format short
```

### 2. Pull Request Workflow

Create `.github/workflows/pr-check.yml`:

```yaml
name: PR Checks

on:
  pull_request:
    branches:
      - main
      - develop

env:
  NODE_VERSION: '20'

jobs:
  lint-and-test:
    name: Lint and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install pnpm
        run: npm install -g pnpm@9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Test
        run: pnpm test --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
      
      - name: Build packages
        run: pnpm build
      
      - name: Check CDK diff
        run: |
          cd infra
          pnpm install --frozen-lockfile
          pnpm diff
```

### 3. Scheduled Maintenance Workflow

Create `.github/workflows/maintenance.yml`:

```yaml
name: Scheduled Maintenance

on:
  schedule:
    # Run every Sunday at 2 AM UTC
    - cron: '0 2 * * 0'
  workflow_dispatch:

env:
  AWS_REGION: us-east-1

jobs:
  cleanup-logs:
    name: Cleanup Old Logs
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Set log retention
        run: |
          for log_group in /aws/lambda/alliance-risk-api /aws/lambda/alliance-risk-worker; do
            aws logs put-retention-policy \
              --log-group-name $log_group \
              --retention-in-days 30
          done
  
  backup-database:
    name: Create Database Snapshot
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Create RDS snapshot
        run: |
          TIMESTAMP=$(date +%Y%m%d-%H%M%S)
          aws rds create-db-snapshot \
            --db-instance-identifier alliance-risk-db \
            --db-snapshot-identifier alliance-risk-backup-${TIMESTAMP}
```

## Environment-Specific Deployments

### Development Environment

Triggered on push to `develop` branch:

```yaml
on:
  push:
    branches:
      - develop
```

### Production Environment

Triggered on push to `main` branch with manual approval:

```yaml
on:
  push:
    branches:
      - main

jobs:
  deploy:
    environment:
      name: production
      url: https://app.alliance-risk.example.com
```

Configure environment protection rules in GitHub:
- Settings → Environments → production
- Add required reviewers
- Add deployment branch rule (main only)

## Rollback Strategy

### Automatic Rollback

Add to deployment workflow:

```yaml
- name: Rollback on failure
  if: failure()
  run: |
    echo "Deployment failed, rolling back..."
    cd infra
    pnpm deploy -- --require-approval never --rollback
```

### Manual Rollback

```bash
# List recent deployments
aws cloudformation describe-stack-events \
  --stack-name AllianceRiskStack \
  --max-items 50

# Rollback to previous version
aws cloudformation cancel-update-stack \
  --stack-name AllianceRiskStack

# Or redeploy specific version
git checkout <previous-commit>
cd infra
pnpm deploy
```

## Monitoring & Notifications

### Slack Notifications

Add to workflow:

```yaml
- name: Notify Slack on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "✅ Deployment successful",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Status:* Success\n*Environment:* ${{ github.ref }}\n*Commit:* ${{ github.sha }}"
            }
          }
        ]
      }

- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "❌ Deployment failed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Status:* Failed\n*Environment:* ${{ github.ref }}\n*Commit:* ${{ github.sha }}"
            }
          }
        ]
      }
```

## Best Practices

### 1. Secrets Management

- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Rotate AWS access keys regularly
- Use AWS Secrets Manager for application secrets

### 2. Testing Strategy

- Run unit tests on every PR
- Run integration tests before deployment
- Implement smoke tests after deployment
- Monitor error rates post-deployment

### 3. Deployment Safety

- Use manual approval for production
- Implement blue-green deployments for zero downtime
- Always test in development first
- Keep rollback plan ready

### 4. Performance

- Cache dependencies between workflow runs
- Use artifacts for build outputs
- Parallelize independent jobs
- Optimize Docker layer caching

### 5. Cost Optimization

- Use self-hosted runners for frequent builds
- Clean up old artifacts and logs
- Monitor GitHub Actions usage
- Optimize workflow triggers

## Troubleshooting

### Common Issues

#### 1. CDK Deployment Fails

**Error**: `Stack is in UPDATE_ROLLBACK_COMPLETE state`

**Solution**:
```bash
aws cloudformation delete-stack --stack-name AllianceRiskStack
# Wait for deletion, then redeploy
```

#### 2. Database Migration Fails

**Error**: `Connection refused`

**Solution**:
- Verify DATABASE_URL secret is correct
- Check RDS security group allows GitHub Actions IP
- Use VPN or bastion host for private RDS

#### 3. CloudFront Invalidation Timeout

**Error**: `Invalidation takes too long`

**Solution**:
- Don't wait for invalidation completion
- Use `--no-wait` flag
- Invalidate only changed paths

#### 4. Artifact Upload Fails

**Error**: `No files found`

**Solution**:
- Verify build step completed successfully
- Check artifact path is correct
- Ensure files exist before upload

## Next Steps

1. **Implement workflows**: Copy workflow files to `.github/workflows/`
2. **Configure secrets**: Add all required secrets to GitHub
3. **Test in development**: Push to `develop` branch and verify
4. **Enable production**: Configure environment protection rules
5. **Monitor deployments**: Set up CloudWatch alarms and Slack notifications
6. **Document runbooks**: Create incident response procedures

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK CI/CD](https://docs.aws.amazon.com/cdk/v2/guide/cdk_pipeline.html)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [CloudFront Invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
