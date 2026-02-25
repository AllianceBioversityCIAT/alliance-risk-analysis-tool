#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/alliance-risk-stack.template.yaml"
PARAMS_FILE="${SCRIPT_DIR}/parameters.json"
STACK_NAME="AllianceRiskStack"

ENV="${1:-dev}"

if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI is not installed" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required to parse parameters.json" >&2
  exit 1
fi

if ! jq -e ".${ENV}" "$PARAMS_FILE" &>/dev/null; then
  echo "ERROR: Unknown environment '${ENV}'. Use: dev | staging | production" >&2
  exit 1
fi

# Build --parameter-overrides from parameters.json
OVERRIDES=$(jq -r ".${ENV}.Parameters | to_entries | map(\"\(.key)=\(.value)\") | .[]" "$PARAMS_FILE")

# ── Bootstrap: Ensure deploy bucket + placeholder Lambda code exist ─────────
# The Lambda resources in the stack reference S3 code that must exist before
# the stack can be created. On first deploy, we bootstrap the bucket and
# upload a minimal placeholder zip.

DEPLOY_BUCKET=$(jq -r ".${ENV}.Parameters.ApiCodeS3Bucket" "$PARAMS_FILE")
S3_KEY=$(jq -r ".${ENV}.Parameters.ApiCodeS3Key" "$PARAMS_FILE")

echo "▸ Ensuring deploy bucket '${DEPLOY_BUCKET}' exists..."
if ! aws s3api head-bucket --bucket "${DEPLOY_BUCKET}" 2>/dev/null; then
  aws s3api create-bucket --bucket "${DEPLOY_BUCKET}" --region us-east-1
  echo "✓ Created bucket: ${DEPLOY_BUCKET}"
else
  echo "✓ Bucket exists: ${DEPLOY_BUCKET}"
fi

# Upload placeholder zip if the Lambda code doesn't exist yet (first deploy)
if ! aws s3api head-object --bucket "${DEPLOY_BUCKET}" --key "${S3_KEY}" 2>/dev/null; then
  echo "▸ Uploading placeholder Lambda code (first deploy)..."
  PLACEHOLDER_DIR=$(mktemp -d)
  echo 'exports.handler = async () => ({ statusCode: 200, body: "placeholder" });' \
    > "${PLACEHOLDER_DIR}/index.js"
  (cd "${PLACEHOLDER_DIR}" && zip -q lambda.zip index.js)
  aws s3 cp "${PLACEHOLDER_DIR}/lambda.zip" "s3://${DEPLOY_BUCKET}/${S3_KEY}"
  rm -rf "${PLACEHOLDER_DIR}"
  echo "✓ Placeholder uploaded — run 'pnpm deploy:api' after stack deploy to upload real code"
fi

# ── Deploy ──────────────────────────────────────────────────────────────────

echo "▸ Validating template..."
aws cloudformation validate-template --template-body "file://${TEMPLATE}" > /dev/null

echo "▸ Deploying stack '${STACK_NAME}' (env: ${ENV})..."
aws cloudformation deploy \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides $OVERRIDES \
  --no-fail-on-empty-changeset

echo "▸ Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table
