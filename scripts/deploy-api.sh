#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy-api.sh — Bundle and deploy the API + Worker Lambdas using esbuild
#
# Usage: bash scripts/deploy-api.sh [env]
#   env: dev | staging | production  (default: dev)
#
# Strategy:
#   1. Build shared + API with tsc (preserves decorator metadata)
#   2. Bundle each Lambda entry point with esbuild (inlines all deps except Prisma + pg)
#   3. Copy only external packages (~18 packages, ~16MB) instead of all 1,400+
#   4. Result: ~10-15MB zip vs previous ~80MB, deploys in <2 minutes
###############################################################################

ENV="${1:-dev}"
STACK_NAME="AllianceRiskStack"
S3_KEY="api/latest.zip"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="${ROOT_DIR}/packages/api"
TEMP_DIR=""

# ── Helpers ──────────────────────────────────────────────────────────────────

log()   { echo "▸ $*"; }
ok()    { echo "✓ $*"; }
fail()  { echo "✗ $*" >&2; exit 1; }

cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

# Resolve a pnpm symlink to its real path in .pnpm store
resolve_pkg() {
  local pkg_path="$1"
  if [[ -L "${pkg_path}" ]]; then
    realpath "${pkg_path}"
  elif [[ -d "${pkg_path}" ]]; then
    echo "${pkg_path}"
  else
    return 1
  fi
}

# Copy a package from node_modules, resolving pnpm symlinks
copy_pkg() {
  local pkg_name="$1"
  local search_root="$2"
  local dest_dir="$3"

  local src
  src=$(resolve_pkg "${search_root}/node_modules/${pkg_name}" 2>/dev/null) || return 1

  mkdir -p "${dest_dir}/${pkg_name}"
  cp -R "${src}/"* "${dest_dir}/${pkg_name}/"
}

# ── Prerequisites ────────────────────────────────────────────────────────────

log "Checking prerequisites..."
command -v aws   >/dev/null 2>&1 || fail "aws CLI not found"
command -v pnpm  >/dev/null 2>&1 || fail "pnpm not found"
command -v zip   >/dev/null 2>&1 || fail "zip not found"
command -v jq    >/dev/null 2>&1 || fail "jq not found"

# Verify esbuild is available
ESBUILD="${API_DIR}/node_modules/.bin/esbuild"
if [[ ! -x "${ESBUILD}" ]]; then
  ESBUILD=$(command -v esbuild 2>/dev/null) || fail "esbuild not found — run 'pnpm install' first"
fi

aws sts get-caller-identity >/dev/null 2>&1 || fail "AWS credentials not configured"
ok "Prerequisites OK"

# ── Resolve names from stack outputs ─────────────────────────────────────────

log "Fetching stack outputs..."
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output json 2>/dev/null) || fail "Could not describe stack '${STACK_NAME}'"

get_output() {
  echo "${STACK_OUTPUTS}" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue"
}

API_FUNCTION_NAME="alliance-risk-api"
WORKER_FUNCTION_NAME=$(get_output "WorkerLambdaName")
[[ -z "${WORKER_FUNCTION_NAME}" ]] && WORKER_FUNCTION_NAME="alliance-risk-worker"

DEPLOY_BUCKET=$(get_output "DeployBucketName")
[[ -z "${DEPLOY_BUCKET}" ]] && DEPLOY_BUCKET="alliance-risk-deploy-${ENV}"

ok "API function:    ${API_FUNCTION_NAME}"
ok "Worker function: ${WORKER_FUNCTION_NAME}"
ok "Deploy bucket:   ${DEPLOY_BUCKET}"

# ── Build ────────────────────────────────────────────────────────────────────

log "Building @alliance-risk/shared..."
pnpm --filter @alliance-risk/shared build

log "Building @alliance-risk/api..."
pnpm --filter @alliance-risk/api build

ok "Build complete"

# ── Bundle with esbuild ──────────────────────────────────────────────────────

log "Creating deployment package with esbuild..."
TEMP_DIR=$(mktemp -d)
mkdir -p "${TEMP_DIR}/dist/src"

# External packages — these cannot be bundled due to:
# - @prisma/client: generated code with WASM binaries
# - .prisma/client: generated Prisma client (dynamic requires, WASM)
# - @prisma/adapter-pg, driver-adapter-utils: instanceof checks need module identity
# - pg + subdeps: native addon loading patterns
# - @nestjs/microservices, @nestjs/websockets: optional NestJS deps (lazy require, not installed)
EXTERNALS=(
  "@prisma/client"
  ".prisma/client"
  "@prisma/adapter-pg"
  "@prisma/driver-adapter-utils"
  "@prisma/client-runtime-utils"
  "@prisma/debug"
  "pg"
  "pg-pool"
  "pg-cloudflare"
  "@nestjs/microservices"
  "@nestjs/websockets"
)

# Build esbuild --external flags
EXTERNAL_FLAGS=""
for ext in "${EXTERNALS[@]}"; do
  EXTERNAL_FLAGS="${EXTERNAL_FLAGS} --external:${ext}"
done

log "  Bundling lambda.js..."
${ESBUILD} "${API_DIR}/dist/src/lambda.js" \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile="${TEMP_DIR}/dist/src/lambda.js" \
  ${EXTERNAL_FLAGS} \
  --main-fields=main,module \
  --minify-syntax --minify-whitespace --tree-shaking=true \
  --log-level=warning 2>&1 | while IFS= read -r line; do echo "    ${line}"; done

log "  Bundling worker.js..."
${ESBUILD} "${API_DIR}/dist/src/worker.js" \
  --bundle --platform=node --target=node20 --format=cjs \
  --outfile="${TEMP_DIR}/dist/src/worker.js" \
  ${EXTERNAL_FLAGS} \
  --main-fields=main,module \
  --minify-syntax --minify-whitespace --tree-shaking=true \
  --log-level=warning 2>&1 | while IFS= read -r line; do echo "    ${line}"; done

BUNDLE_SIZE=$(du -sh "${TEMP_DIR}/dist" | cut -f1)
ok "Bundles created: ${BUNDLE_SIZE}"

# ── Copy external packages ───────────────────────────────────────────────────

log "Copying external packages..."
NM="${TEMP_DIR}/node_modules"
mkdir -p "${NM}/@prisma" "${NM}/.prisma"

# --- @prisma/client (selective: runtime + PostgreSQL WASM only) ---
log "  @prisma/client (selective)..."
PRISMA_CLIENT_SRC=$(resolve_pkg "${API_DIR}/node_modules/@prisma/client")
mkdir -p "${NM}/@prisma/client/runtime"

# Copy package.json and top-level JS files
cp "${PRISMA_CLIENT_SRC}/package.json" "${NM}/@prisma/client/"
# Copy all top-level .js and .d.ts files (index.js, default.js, etc.)
find "${PRISMA_CLIENT_SRC}" -maxdepth 1 -name "*.js" -exec cp {} "${NM}/@prisma/client/" \;

# Copy runtime: only client.js + PostgreSQL WASM (skip other DB compilers)
cp "${PRISMA_CLIENT_SRC}/runtime/client.js" "${NM}/@prisma/client/runtime/"
find "${PRISMA_CLIENT_SRC}/runtime" -maxdepth 1 -name "*postgresql*" ! -name "*.mjs" \
  -exec cp {} "${NM}/@prisma/client/runtime/" \;

# --- .prisma/client (generated) ---
log "  .prisma/client (generated)..."
PRISMA_GENERATED_SRC=$(resolve_pkg "${API_DIR}/node_modules/@prisma/client")
PRISMA_GENERATED_SRC="${PRISMA_GENERATED_SRC%/@prisma/client}/.prisma/client"
if [[ -d "${PRISMA_GENERATED_SRC}" ]]; then
  mkdir -p "${NM}/.prisma/client"
  # Copy all JS files
  find "${PRISMA_GENERATED_SRC}" -maxdepth 1 -name "*.js" -exec cp {} "${NM}/.prisma/client/" \;
  # Copy package.json if exists
  [[ -f "${PRISMA_GENERATED_SRC}/package.json" ]] && cp "${PRISMA_GENERATED_SRC}/package.json" "${NM}/.prisma/client/"
  # Copy schema.prisma if exists
  [[ -f "${PRISMA_GENERATED_SRC}/schema.prisma" ]] && cp "${PRISMA_GENERATED_SRC}/schema.prisma" "${NM}/.prisma/client/"
  # Copy WASM binary (the actual WASM, not base64 encoded)
  find "${PRISMA_GENERATED_SRC}" -maxdepth 1 -name "*.wasm" -exec cp {} "${NM}/.prisma/client/" \;
  # Copy wasm loader files
  find "${PRISMA_GENERATED_SRC}" -maxdepth 1 -name "wasm-*-loader*" ! -name "*.mjs" \
    -exec cp {} "${NM}/.prisma/client/" \; 2>/dev/null || true
else
  log "  WARNING: .prisma/client not found at expected path, will generate at deploy time"
fi

# --- @prisma/adapter-pg ---
log "  @prisma/adapter-pg..."
# adapter-pg has its own copies of @prisma deps, resolve from the adapter's own node_modules
ADAPTER_PG_STORE=$(resolve_pkg "${API_DIR}/node_modules/@prisma/adapter-pg")
ADAPTER_PG_PARENT=$(dirname "$(dirname "${ADAPTER_PG_STORE}")")  # go up from @prisma/adapter-pg
copy_pkg "@prisma/adapter-pg" "${API_DIR}" "${NM}"

# --- @prisma/driver-adapter-utils ---
log "  @prisma/driver-adapter-utils..."
# This may be a peer dep of adapter-pg, check multiple locations
if ! copy_pkg "@prisma/driver-adapter-utils" "${API_DIR}" "${NM}" 2>/dev/null; then
  # Try from the adapter-pg store location
  if [[ -d "${ADAPTER_PG_PARENT}/@prisma/driver-adapter-utils" ]]; then
    mkdir -p "${NM}/@prisma/driver-adapter-utils"
    cp -R "${ADAPTER_PG_PARENT}/@prisma/driver-adapter-utils/"* "${NM}/@prisma/driver-adapter-utils/"
  fi
fi

# --- @prisma/debug (required by driver-adapter-utils) ---
log "  @prisma/debug..."
if ! copy_pkg "@prisma/debug" "${API_DIR}" "${NM}" 2>/dev/null; then
  # Search in pnpm store (co-located with driver-adapter-utils)
  ADAPTER_UTILS_STORE=$(resolve_pkg "${API_DIR}/node_modules/@prisma/driver-adapter-utils" 2>/dev/null) || true
  if [[ -n "${ADAPTER_UTILS_STORE}" ]]; then
    DEBUG_PARENT=$(dirname "$(dirname "${ADAPTER_UTILS_STORE}")")
    if [[ -d "${DEBUG_PARENT}/@prisma/debug" ]]; then
      mkdir -p "${NM}/@prisma/debug"
      cp -R "${DEBUG_PARENT}/@prisma/debug/"* "${NM}/@prisma/debug/"
    fi
  fi
  # Fallback: search in pnpm store
  if [[ ! -d "${NM}/@prisma/debug/dist" ]]; then
    DEBUG_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -type d -name "debug" \
      -path "*/@prisma/debug" 2>/dev/null | head -1)
    if [[ -n "${DEBUG_PATH}" ]]; then
      mkdir -p "${NM}/@prisma/debug"
      cp -R "${DEBUG_PATH}/"* "${NM}/@prisma/debug/"
    fi
  fi
fi

# --- @prisma/client-runtime-utils ---
log "  @prisma/client-runtime-utils..."
if ! copy_pkg "@prisma/client-runtime-utils" "${API_DIR}" "${NM}" 2>/dev/null; then
  # Search in pnpm store
  CRU_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -type d -name "client-runtime-utils" \
    -path "*/@prisma/client-runtime-utils" 2>/dev/null | head -1)
  if [[ -n "${CRU_PATH}" ]]; then
    mkdir -p "${NM}/@prisma/client-runtime-utils"
    cp -R "${CRU_PATH}/"* "${NM}/@prisma/client-runtime-utils/"
  fi
fi

# --- pg + all subdependencies ---
log "  pg + subdependencies..."

# pg's deps are co-located in the pnpm store under pg@version/node_modules/
PG_STORE_ROOT="${ROOT_DIR}/node_modules/.pnpm/pg@8.18.0/node_modules"

# Direct pg deps (all co-located in pg's store)
PG_PACKAGES=(pg pg-pool pg-protocol pg-types pg-connection-string pg-cloudflare pgpass)
for pkg in "${PG_PACKAGES[@]}"; do
  if [[ -d "${PG_STORE_ROOT}/${pkg}" ]]; then
    mkdir -p "${NM}/${pkg}"
    cp -R "${PG_STORE_ROOT}/${pkg}/"* "${NM}/${pkg}/"
  else
    # Fallback: search in pnpm store
    copy_pkg "${pkg}" "${ROOT_DIR}" "${NM}" 2>/dev/null || true
  fi
done

# pg-types subdeps and their transitive deps (separate store entries)
PG_TYPES_PACKAGES=(pg-int8 postgres-bytea postgres-date postgres-interval xtend)
for pkg in "${PG_TYPES_PACKAGES[@]}"; do
  PKG_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -maxdepth 3 -type d \
    -name "${pkg}" -path "*/${pkg}@*/node_modules/${pkg}" 2>/dev/null | head -1)
  if [[ -n "${PKG_PATH}" ]]; then
    mkdir -p "${NM}/${pkg}"
    cp -R "${PKG_PATH}/"* "${NM}/${pkg}/"
  fi
done

# postgres-array: v3 at top level (for adapter-pg), v2 nested inside pg-types (for pg-types)
PA3_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -maxdepth 3 -type d \
  -name "postgres-array" -path "*/postgres-array@3*/node_modules/postgres-array" 2>/dev/null | head -1)
if [[ -n "${PA3_PATH}" ]]; then
  mkdir -p "${NM}/postgres-array"
  cp -R "${PA3_PATH}/"* "${NM}/postgres-array/"
fi

PA2_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -maxdepth 3 -type d \
  -name "postgres-array" -path "*/postgres-array@2*/node_modules/postgres-array" 2>/dev/null | head -1)
if [[ -n "${PA2_PATH}" ]]; then
  mkdir -p "${NM}/pg-types/node_modules/postgres-array"
  cp -R "${PA2_PATH}/"* "${NM}/pg-types/node_modules/postgres-array/"
fi

# pgpass subdep: split2
SPLIT2_PATH=$(find "${ROOT_DIR}/node_modules/.pnpm" -maxdepth 3 -type d \
  -name "split2" -path "*/split2@*/node_modules/split2" 2>/dev/null | head -1)
if [[ -n "${SPLIT2_PATH}" ]]; then
  mkdir -p "${NM}/split2"
  cp -R "${SPLIT2_PATH}/"* "${NM}/split2/"
fi

# ── Cleanup external packages ────────────────────────────────────────────────

log "Cleaning up external packages..."

# Remove TypeScript types, source maps, docs
find "${NM}" -type f \( \
  -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.ts.map" -o \
  -name "*.js.map" -o -name "*.ts.map" -o -name "*.mjs.map" -o \
  -name "*.md" -o -name "*.markdown" -o \
  -name "CHANGELOG*" -o -name "LICENSE*" -o -name "LICENCE*" -o \
  -name "README*" -o -name ".npmignore" -o -name ".eslintrc*" -o \
  -name "tsconfig.json" -o -name ".editorconfig" \
  \) -delete 2>/dev/null || true

# Remove test/doc directories
find "${NM}" -type d \( \
  -name "test" -o -name "tests" -o -name "__tests__" -o \
  -name "docs" -o -name "example" -o -name "examples" -o \
  -name ".github" \
  \) -exec rm -rf {} + 2>/dev/null || true

# Remove .mjs duplicates (Lambda uses CommonJS)
find "${NM}" -name "*.mjs" -delete 2>/dev/null || true

# Remove empty directories
find "${NM}" -type d -empty -delete 2>/dev/null || true

# ── Copy Prisma schema ───────────────────────────────────────────────────────

mkdir -p "${TEMP_DIR}/prisma"
cp "${API_DIR}/prisma/schema.prisma" "${TEMP_DIR}/prisma/"

# ── Summary ──────────────────────────────────────────────────────────────────

NM_SIZE=$(du -sh "${NM}" | cut -f1)
TOTAL_SIZE=$(du -sh "${TEMP_DIR}" | cut -f1)
ok "External packages: ${NM_SIZE}"
ok "Total unzipped:    ${TOTAL_SIZE}"

# ── Create zip ───────────────────────────────────────────────────────────────

log "Creating zip archive..."
ZIP_FILE="${TEMP_DIR}/lambda.zip"
cd "${TEMP_DIR}"
zip -r "${ZIP_FILE}" dist node_modules prisma > /dev/null

ZIP_SIZE=$(du -h "${ZIP_FILE}" | cut -f1)
ok "Package created: ${ZIP_SIZE}"

# ── Upload to S3 ────────────────────────────────────────────────────────────

log "Uploading to s3://${DEPLOY_BUCKET}/${S3_KEY}..."
aws s3 cp "${ZIP_FILE}" "s3://${DEPLOY_BUCKET}/${S3_KEY}"
ok "Upload complete"

# ── Update Lambda Functions ─────────────────────────────────────────────────

log "Updating API Lambda (${API_FUNCTION_NAME})..."
aws lambda update-function-code \
  --function-name "${API_FUNCTION_NAME}" \
  --s3-bucket "${DEPLOY_BUCKET}" \
  --s3-key "${S3_KEY}" \
  --output text > /dev/null

log "Updating Worker Lambda (${WORKER_FUNCTION_NAME})..."
aws lambda update-function-code \
  --function-name "${WORKER_FUNCTION_NAME}" \
  --s3-bucket "${DEPLOY_BUCKET}" \
  --s3-key "${S3_KEY}" \
  --output text > /dev/null

log "Waiting for functions to become active..."
aws lambda wait function-active-v2 --function-name "${API_FUNCTION_NAME}"
aws lambda wait function-active-v2 --function-name "${WORKER_FUNCTION_NAME}"

# ── Done ─────────────────────────────────────────────────────────────────────

API_URL=$(get_output "ApiUrl")

echo ""
echo "═══════════════════════════════════════════════════"
echo "  API deployment complete (${ENV})"
echo "═══════════════════════════════════════════════════"
echo "  Package size:  ${ZIP_SIZE}"
echo "  S3 location:   s3://${DEPLOY_BUCKET}/${S3_KEY}"
echo "  API Lambda:    ${API_FUNCTION_NAME}"
echo "  Worker Lambda: ${WORKER_FUNCTION_NAME}"
[[ -n "${API_URL}" ]] && echo "  API URL:       ${API_URL}"
echo "═══════════════════════════════════════════════════"
