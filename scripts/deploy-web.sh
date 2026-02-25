#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy-web.sh — Build and deploy the frontend to S3 + CloudFront
#
# Usage: bash scripts/deploy-web.sh [env]
#   env: dev | staging | production  (default: dev)
###############################################################################

ENV="${1:-dev}"
STACK_NAME="AllianceRiskStack"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/packages/web/out"

# ── Helpers ──────────────────────────────────────────────────────────────────

log()   { echo "▸ $*"; }
ok()    { echo "✓ $*"; }
fail()  { echo "✗ $*" >&2; exit 1; }

# ── Prerequisites ────────────────────────────────────────────────────────────

log "Checking prerequisites..."
command -v aws   >/dev/null 2>&1 || fail "aws CLI not found"
command -v pnpm  >/dev/null 2>&1 || fail "pnpm not found"
command -v jq    >/dev/null 2>&1 || fail "jq not found"

aws sts get-caller-identity >/dev/null 2>&1 || fail "AWS credentials not configured"
ok "Prerequisites OK"

# ── Fetch Stack Outputs ─────────────────────────────────────────────────────

log "Fetching stack outputs..."
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output json 2>/dev/null) || fail "Could not describe stack '${STACK_NAME}'"

get_output() {
  echo "${STACK_OUTPUTS}" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue"
}

WEB_BUCKET=$(get_output "WebBucketName")
CF_DIST_ID=$(get_output "CloudFrontDistributionId")
API_URL=$(get_output "ApiUrl")
COGNITO_POOL_ID=$(get_output "CognitoUserPoolId")
COGNITO_CLIENT_ID=$(get_output "CognitoClientId")
CF_URL=$(get_output "CloudFrontUrl")

[[ -z "${WEB_BUCKET}" ]] && fail "WebBucketName not found in stack outputs"
[[ -z "${CF_DIST_ID}" ]] && fail "CloudFrontDistributionId not found in stack outputs. Redeploy the CloudFormation stack first."

ok "Web bucket:     ${WEB_BUCKET}"
ok "CloudFront ID:  ${CF_DIST_ID}"
ok "API URL:        ${API_URL}"

# ── Build ────────────────────────────────────────────────────────────────────

log "Setting NEXT_PUBLIC_* environment variables from stack outputs..."
export NEXT_PUBLIC_API_URL="${API_URL}"
export NEXT_PUBLIC_COGNITO_USER_POOL_ID="${COGNITO_POOL_ID}"
export NEXT_PUBLIC_COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID}"

log "Building @alliance-risk/shared..."
pnpm --filter @alliance-risk/shared build

log "Building @alliance-risk/web..."
pnpm --filter @alliance-risk/web build

[[ -d "${OUT_DIR}" ]] || fail "Build did not produce out/ directory. Check next.config.ts has output: 'export'"
ok "Build complete — out/ directory ready"

# ── Deploy to S3 ────────────────────────────────────────────────────────────

log "Syncing static assets (JS, CSS, images) with immutable cache..."
aws s3 sync "${OUT_DIR}" "s3://${WEB_BUCKET}" \
  --exclude "*.html" \
  --exclude "*.json" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

log "Syncing HTML and JSON files with no-cache..."
aws s3 sync "${OUT_DIR}" "s3://${WEB_BUCKET}" \
  --exclude "*" \
  --include "*.html" \
  --include "*.json" \
  --cache-control "public, max-age=0, must-revalidate" \
  --delete

ok "S3 sync complete"

# ── CloudFront Invalidation ─────────────────────────────────────────────────

log "Creating CloudFront invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${CF_DIST_ID}" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)

ok "Invalidation created: ${INVALIDATION_ID}"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Web deployment complete (${ENV})"
echo "═══════════════════════════════════════════════════"
echo "  S3 bucket:       ${WEB_BUCKET}"
echo "  CloudFront ID:   ${CF_DIST_ID}"
echo "  Invalidation:    ${INVALIDATION_ID}"
[[ -n "${CF_URL}" ]] && echo "  URL:             ${CF_URL}"
echo "═══════════════════════════════════════════════════"
