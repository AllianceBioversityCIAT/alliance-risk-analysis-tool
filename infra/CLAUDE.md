# CLAUDE.md — @alliance-risk/infra

AWS CDK infrastructure and CloudFormation templates for the Alliance Risk platform.

## Commands

```bash
# CDK workflow
pnpm build            # tsc
pnpm synth            # cdk synth
pnpm deploy           # cdk deploy
pnpm diff             # cdk diff
pnpm test             # jest (snapshot tests)

# CloudFormation workflow (no CDK dependency required)
pnpm cfn:synth        # regenerate template from CDK
pnpm cfn:validate     # aws cloudformation validate-template
pnpm cfn:deploy       # bash cfn/deploy.sh (pass env: dev|staging|production)
```

## Structure

```
bin/
  app.ts                              # CDK app entry point
lib/
  alliance-risk-stack.ts              # Single stack — all resources
cfn/
  alliance-risk-stack.template.yaml   # Standalone CloudFormation template
  parameters.json                     # Environment-specific parameter overrides
  deploy.sh                           # Wrapper for aws cloudformation deploy
test/
  alliance-risk-stack.test.ts         # Snapshot test for template stability
```

## Stack Resources

Single stack (`AllianceRiskStack`) provisions:
- **Cognito** — User Pool, Client, `admin` group
- **RDS PostgreSQL 15** — `db.t3.micro`, credentials in Secrets Manager
- **API Lambda** — ARM64, 1024MB, Node.js 20, behind API Gateway HTTP API
- **Worker Lambda** — ARM64, 1024MB, 15min timeout, async invocation
- **API Gateway HTTP API** — 30s timeout, routes to API Lambda
- **S3** — file storage bucket + web hosting bucket
- **CloudFront** — SPA distribution with OAI, 403/404 fallback to `/index.html`
- **IAM** — Cognito, Bedrock, Textract, S3, Lambda:InvokeFunction policies

## Conventions

- One stack, one file (`lib/alliance-risk-stack.ts`) — do not split into nested stacks
- CDK and CloudFormation templates must stay in parity; after CDK changes run `pnpm cfn:synth`
- Environment variables for Lambdas are defined in the stack, not in `.env` files
- DB credentials go through Secrets Manager, never hardcoded
- All Lambdas use ARM64 architecture for cost optimization

## Two Deployment Paths

| Path | Tool | When to use |
|------|------|-------------|
| CDK | `pnpm deploy` | Development — requires Node.js + CDK CLI |
| CloudFormation | `pnpm cfn:deploy` | CI/CD or environments without CDK toolchain |

## TypeScript

- Strict mode enabled
- CommonJS module system
- `ts-node` used by CDK CLI to run `bin/app.ts` directly
