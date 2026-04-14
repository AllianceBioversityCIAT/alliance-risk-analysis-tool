#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BUILD_DIR="$(mktemp -d /tmp/reprocess-failed-docx-build.XXXXXX)"
API_DIR="${ROOT_DIR}/packages/api"

cleanup() {
  rm -rf "${BUILD_DIR}"
}

trap cleanup EXIT

cd "${API_DIR}"
pnpm exec tsc "scripts/reprocess-failed-docx.ts" --module commonjs --target ES2021 --esModuleInterop --outDir "${BUILD_DIR}" >/dev/null
node "${BUILD_DIR}/reprocess-failed-docx.js" "$@"
