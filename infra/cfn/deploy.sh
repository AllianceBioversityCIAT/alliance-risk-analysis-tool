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
