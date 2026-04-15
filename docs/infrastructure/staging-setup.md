# Staging Environment Setup Guide

This guide describes what is required to stand up a **staging** deployment of the CGIAR Risk Intelligence Tool. Staging is a second, isolated copy of the dev stack intended for:

- Pre-release smoke testing of deploy scripts before they touch production
- Extended UAT with stakeholders who should not see experimental changes that land daily on `dev`
- Load testing against realistic Bedrock quotas without impacting developer workflows

At the time of writing (**2026-04-15**), staging has **not been provisioned**. This document captures the prerequisites, parameters, and cost expectations so someone with AWS access can execute the rollout in a single work session.

---

## 1. Prerequisites

### AWS

| Requirement | Notes |
|-------------|-------|
| Separate AWS account OR same account with resource name suffixing | Recommended: separate AWS account under the CGIAR / Alliance organization to fully isolate billing, IAM, and blast radius. If unavailable, the same account with `ENVIRONMENT=staging` can host both stacks because every resource name embeds `${AWS::StackName}-${Environment}`. |
| Bedrock model access | Enable Moonshot AI Kimi K2.5 in `us-east-1` for the staging account. This is a one-time AWS console action. |
| Cognito quota | Default Cognito limits are sufficient; no pre-work needed. |
| RDS quota | `db.t3.micro` is within the default limit even for a new account. |
| VPC endpoint quota | Default is 50 per VPC — well above the 5 we use. |

### IAM

Provision an IAM principal (role or user) with these attached policies, for both developer access and CI use:

- `AWSCloudFormationFullAccess` (scoped down before production)
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonS3FullAccess`
- `AmazonRDSFullAccess`
- `AmazonCognitoPowerUser`
- `AmazonBedrockFullAccess`
- `AmazonTextractFullAccess`
- `CloudFrontFullAccess`
- `SecretsManagerReadWrite` (for the Worker admin token + DB credentials)
- `IAMFullAccess` (for role creation during stack provisioning — can be scoped down with `iam:PassedToService` conditions once the stack stabilises)

Save the profile locally as `IBD-STAGING` to mirror the dev `IBD-DEV` naming convention.

### Local tooling

Same as for dev deploys (see `INSTALL.md` §7). Confirm the AWS CLI can reach the staging account:

```bash
AWS_PROFILE=IBD-STAGING aws sts get-caller-identity
```

---

## 2. Parameters file

Create `infra/cfn/parameters.staging.json` based on the dev equivalent. Key fields to override:

```json
{
  "Environment": "staging",
  "DbInstanceClass": "db.t3.micro",
  "DbAllocatedStorage": "20",
  "DbBackupRetentionPeriod": "7",
  "ApiCorsOrigin": "https://staging.<your-subdomain>.example.com",
  "EndpointSubnetIds": "subnet-us-east-1a,subnet-us-east-1b,subnet-us-east-1c",
  "DocxExtractionMode": "text"
}
```

**Why each value matters:**

- `Environment=staging` drives the stack name suffix so every resource (Lambdas, S3 buckets, CloudFront distribution) is isolated from `dev`.
- `DbBackupRetentionPeriod=7` is more conservative than the dev default (often 1 day) — staging holds enough test data that a week of backups helps investigation.
- `ApiCorsOrigin` should point at the staging CloudFront URL. Plan this in advance: the URL is a stack output, so the first deploy uses a placeholder and the second deploy tightens it.
- `EndpointSubnetIds` — VPC endpoints for Cognito IDP only work in `us-east-1a / b / c`. If your staging VPC has different AZs, create subnets in those specific zones first.

---

## 3. Deployment sequence

```bash
# 0. Sanity-check the profile
AWS_PROFILE=IBD-STAGING aws sts get-caller-identity

# 1. Initial infrastructure deploy (creates everything: VPC, RDS, Cognito, Lambdas, S3, CloudFront)
AWS_PROFILE=IBD-STAGING pnpm --filter @alliance-risk/infra cfn:deploy staging

# 2. Apply database migrations (RDS is in a private VPC — uses the Worker Lambda's run-sql action)
AWS_PROFILE=IBD-STAGING pnpm migrate:remote

# 3. Seed the admin user and starter prompts into the staging database
#    (Run from a machine that can reach the Worker Lambda; same pattern as migrate:remote)

# 4. Code deploys for API + Worker + Web
AWS_PROFILE=IBD-STAGING pnpm deploy:api
AWS_PROFILE=IBD-STAGING pnpm deploy:web

# 5. Smoke test
#    - Open the staging CloudFront URL
#    - Sign in with the seeded admin credentials
#    - Follow docs/testing/analyst-test-protocol.md §1 (Smoke path)
```

Expected total wall-clock time for a first deploy: **45–75 minutes**, mostly dominated by CloudFormation creating RDS and the initial CloudFront distribution (~25–30 minutes alone).

Subsequent code-only deploys take **2–5 minutes** each.

---

## 4. Cost estimate

Rough monthly running cost for a staging environment with low traffic (assuming <100 assessments per month, <1000 Lambda invocations per day):

| Service | Monthly cost estimate (USD) | Notes |
|---------|:---------------------------:|-------|
| RDS `db.t3.micro` | $13–$15 | On 24/7; consider an automated stop/start schedule to halve it |
| Lambdas (API + Worker) | $1–$3 | Very light traffic; the first million invocations are free |
| API Gateway | $1–$2 | |
| S3 (storage + requests) | $1–$3 | Depends on uploaded file volume |
| CloudFront | $1–$2 | Low traffic |
| Cognito | $0 | Free tier covers MAU well beyond staging needs |
| Secrets Manager | ~$0.80 | Two secrets (DB creds + Worker admin token) |
| Textract | variable | Pay-per-page. Budget $1 per 600 pages. |
| Bedrock (Kimi K2.5) | variable | Budget $1–$5 per assessment depending on document size; ≤$5–$25/month for typical staging use |
| CloudWatch Logs | $2–$5 | Retention set to 7 days recommended |
| **Approximate total** | **$25–$70 / month** | Varies primarily with Bedrock and Textract usage |

**Cost controls to apply before go-live:**

- Set a CloudWatch billing alarm at $100/month for the staging account.
- Turn on S3 lifecycle rules: expire uploaded-but-never-parsed files after 30 days.
- Set Log Group retention to 7 days (default is forever, which racks up quickly).

---

## 5. Stakeholder sign-offs required before standing up staging

This guide deliberately stops short of running the commands because:

- ✅ **Technical readiness is complete.** All scripts, parameters, and IAM policies are documented above and proven on the dev stack.
- ⏸ **Budget approval** is required. The $25–$70/month estimate needs an owner.
- ⏸ **IAM account provisioning** is required. An existing CGIAR Alliance AWS administrator must create the `IBD-STAGING` profile.
- ⏸ **DNS / subdomain decision** is required for `ApiCorsOrigin`. Either use the raw CloudFront URL or reserve a subdomain like `staging.risk.alliancebioversityciat.org`.

Once those three sign-offs are in place, execute section 3 above. The deploy is fully documented and tested.

---

## 6. Relationship to production

Staging is configured to mirror production as closely as feasible, with cost-conscious compromises:

| Aspect | Staging choice | Production target |
|--------|----------------|-------------------|
| Region | `us-east-1` | `us-east-1` |
| RDS instance | `db.t3.micro` | `db.t3.small` or larger |
| RDS Multi-AZ | No | Yes |
| RDS backups | 7-day retention | 30-day retention + point-in-time recovery |
| Cognito MFA | Optional | Required |
| CloudFront WAF rules | None | Attached |
| Log retention | 7 days | 90 days |
| Cost per month | ~$25–$70 | ~$150–$300 |

The production environment is **explicitly out of scope** for this handover snapshot (per the MVP status report). Provisioning production requires a separate scoping exercise covering SLA commitments, data residency requirements for the CGIAR partner geographies, and security-review sign-off.

---

## 7. Tear-down

If staging is no longer needed, tear it down in reverse order. This keeps CloudFormation happy and avoids dangling resources.

```bash
# 1. Empty the S3 buckets (required before stack deletion)
AWS_PROFILE=IBD-STAGING aws s3 rm s3://alliance-risk-web-<staging-account-id>/ --recursive
AWS_PROFILE=IBD-STAGING aws s3 rm s3://alliance-risk-files-<staging-account-id>/ --recursive
AWS_PROFILE=IBD-STAGING aws s3 rm s3://alliance-risk-deploy-staging/ --recursive

# 2. Delete the stack
AWS_PROFILE=IBD-STAGING aws cloudformation delete-stack --stack-name AllianceRiskStack-staging

# 3. Monitor
AWS_PROFILE=IBD-STAGING aws cloudformation wait stack-delete-complete --stack-name AllianceRiskStack-staging
```

Expected tear-down time: 20–30 minutes (RDS takes the longest to delete).

---

## 8. Known gotchas carried over from dev

From `MEMORY.md` and `docs/runbooks/docx-extraction.md`:

- `aws lambda update-function-configuration --environment` **replaces all env vars**. Always include the full set when patching a single value.
- Cognito IDP VPC endpoint only supports AZs `us-east-1a/b/c`. If your staging VPC has subnets in `d/e/f`, the stack provisioning will fail.
- Prisma `.prisma/client` WASM assets must be included in the Lambda bundle. `scripts/deploy-api.sh` handles this — do not simplify the external-package copy logic without testing against staging first.
- `bluebird` (transitive dependency of `mammoth`) must remain in the `TRANSITIVE_DEPS` list of `deploy-api.sh`. Removing it causes a runtime `Cannot find module 'bluebird/js/release/promise'` in the Worker Lambda.

Once staging is running and the smoke protocol passes, update the MVP status report (`docs/specs/mvp-report/mvp-status-report.md`) to reflect the new environment.
