#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# migrate-remote.sh — Run Prisma migrations on remote RDS via Worker Lambda
#
# The RDS is in a private VPC and unreachable from local machines.
# This script sends migration SQL to the Worker Lambda's run-sql action.
#
# Usage: bash scripts/migrate-remote.sh
###############################################################################

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/packages/api/prisma/migrations"
WORKER_FUNCTION="alliance-risk-worker"

log()  { echo "▸ $*"; }
ok()   { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

# Prerequisites
command -v aws    >/dev/null 2>&1 || fail "aws CLI not found"
command -v python3 >/dev/null 2>&1 || fail "python3 not found"
aws sts get-caller-identity >/dev/null 2>&1 || fail "AWS credentials not configured"

# Discover migration directories (sorted by timestamp prefix)
MIGRATION_DIRS=$(find "${MIGRATIONS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

if [[ -z "${MIGRATION_DIRS}" ]]; then
  ok "No migrations found"
  exit 0
fi

TOTAL=0
for MIGRATION_DIR in ${MIGRATION_DIRS}; do
  MIGRATION_NAME=$(basename "${MIGRATION_DIR}")
  SQL_FILE="${MIGRATION_DIR}/migration.sql"

  [[ -f "${SQL_FILE}" ]] || continue

  log "Applying migration: ${MIGRATION_NAME}"

  # Build JSON payload with proper escaping
  PAYLOAD_FILE=$(mktemp)
  python3 -c "
import json
sql = open('${SQL_FILE}').read()
payload = json.dumps({'action': 'run-sql', 'sql': sql}, ensure_ascii=True)
with open('${PAYLOAD_FILE}', 'w') as f:
    f.write(payload)
"

  RESULT_FILE=$(mktemp)
  aws lambda invoke --function-name "${WORKER_FUNCTION}" \
    --payload "fileb://${PAYLOAD_FILE}" \
    --cli-read-timeout 120 \
    "${RESULT_FILE}" >/dev/null 2>&1

  RESULT=$(cat "${RESULT_FILE}")
  SUCCESS=$(echo "${RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))")
  EXECUTED=$(echo "${RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('executed', 0))")

  rm -f "${PAYLOAD_FILE}" "${RESULT_FILE}"

  if [[ "${SUCCESS}" == "True" ]]; then
    ok "${MIGRATION_NAME}: ${EXECUTED} statements"
    TOTAL=$((TOTAL + EXECUTED))
  else
    ERROR=$(echo "${RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error', 'unknown'))")
    # If error is about existing objects, migration was already applied — skip
    if echo "${ERROR}" | grep -qi "already exists"; then
      ok "${MIGRATION_NAME}: already applied (skipped)"
    else
      fail "${MIGRATION_NAME} failed: ${ERROR}"
    fi
  fi
done

# Ensure _prisma_migrations tracking table exists
log "Updating migration tracking table..."
TRACKING_SQL="CREATE TABLE IF NOT EXISTS \"_prisma_migrations\" (
  \"id\" VARCHAR(36) NOT NULL,
  \"checksum\" VARCHAR(64) NOT NULL,
  \"finished_at\" TIMESTAMPTZ,
  \"migration_name\" VARCHAR(255) NOT NULL,
  \"logs\" TEXT,
  \"rolled_back_at\" TIMESTAMPTZ,
  \"started_at\" TIMESTAMPTZ NOT NULL DEFAULT now(),
  \"applied_steps_count\" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (\"id\")
)"

for MIGRATION_DIR in ${MIGRATION_DIRS}; do
  MIGRATION_NAME=$(basename "${MIGRATION_DIR}")
  [[ -f "${MIGRATION_DIR}/migration.sql" ]] || continue
  TRACKING_SQL="${TRACKING_SQL};
INSERT INTO \"_prisma_migrations\" (\"id\", \"checksum\", \"finished_at\", \"migration_name\", \"applied_steps_count\")
VALUES ('$(python3 -c "import uuid; print(uuid.uuid4())")', 'remote-migration', now(), '${MIGRATION_NAME}', 1)
ON CONFLICT DO NOTHING"
done

PAYLOAD_FILE=$(mktemp)
RESULT_FILE=$(mktemp)
python3 -c "
import json
sql = '''${TRACKING_SQL}'''
payload = json.dumps({'action': 'run-sql', 'sql': sql}, ensure_ascii=True)
with open('${PAYLOAD_FILE}', 'w') as f:
    f.write(payload)
"

aws lambda invoke --function-name "${WORKER_FUNCTION}" \
  --payload "fileb://${PAYLOAD_FILE}" \
  --cli-read-timeout 60 \
  "${RESULT_FILE}" >/dev/null 2>&1
rm -f "${PAYLOAD_FILE}" "${RESULT_FILE}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Migration complete: ${TOTAL} total statements"
echo "═══════════════════════════════════════════════════"
