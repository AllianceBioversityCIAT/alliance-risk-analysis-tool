# Execution Log — enhancements/upload-word-documents

## Document Control

| Field | Value |
|-------|-------|
| Module | enhancements/upload-word-documents |
| SDD Reference | docs/specs/enhancements/upload-word-documents/tasks.md |
| Started | 2026-04-13 |
| Last Updated | 2026-04-13 |

---

## Task Execution History

### TASK-T-001: Hoist `mammoth` and `turndown` to module top-level
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~30m
- **Files Changed:**
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.ts` — moved `mammoth` and `turndown` to module-scope imports and kept the extractor flow compiling under NestJS.
- **Decisions Made:**
  - Kept `mammoth` and `turndown` as top-level imports while leaving non-DOCX extraction behavior intact.
  - Verified `scripts/deploy-api.sh` still packages `turndown` and the extraction libraries needed by the Lambda bundle.
- **Issues Encountered:**
  - `pnpm --filter @alliance-risk/api build` and direct `nest build` / `tsc` checks did not surface compile errors, but they hung long enough to be terminated by the tool timeout in this environment.
- **Verification:**
  - Passed: `pnpm exec jest src/infrastructure/extractors/programmatic.extractor.spec.ts --runInBand`
  - Verified by inspection: `scripts/deploy-api.sh` still includes `turndown` in `EXTERNALS` and extraction library packaging.
  - Build command note: `pnpm --filter @alliance-risk/api build` timed out twice without emitting a compile error.

---

### TASK-T-002: Implement `extractRawText` path + mode dispatch
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~25m
- **Files Changed:**
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.ts` — verified the DOCX extractor is split into text/html paths, dispatches by mode, writes the same string to `textContent` and `markdownContent`, and sets mode-specific `extractorModel` labels.
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.docx.spec.ts` — added regression coverage for a real minimal DOCX fixture, legacy HTML-path parity, and unchanged non-DOCX outputs.
- **Decisions Made:**
  - Added a minimal in-test DOCX fixture generator instead of introducing a repository binary fixture for this task.
  - Kept parity assertions focused on observable output so the legacy HTML branch remains rollback-safe.
- **Issues Encountered:**
  - Existing extractor tests covered the dispatch and label behavior, but not a real DOCX buffer or non-DOCX regression parity, so additional tests were added before closing the task.
- **Verification:**
  - Passed: `pnpm exec jest src/infrastructure/extractors/programmatic.extractor.spec.ts src/infrastructure/extractors/programmatic.extractor.docx.spec.ts --runInBand`

---

### TASK-T-003: Inject `ConfigService` + resolve `DOCX_EXTRACTION_MODE`
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~15m
- **Files Changed:**
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.ts` — verified `ConfigService` injection, cached constructor-time mode resolution, and deterministic fallback-to-text behavior.
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.spec.ts` — added coverage for undefined/empty values, case-insensitive normalization, whitespace tolerance, and single-warning behavior on unknown modes.
- **Decisions Made:**
  - Left `ExtractorsModule` unchanged because `ConfigModule` is already global; no extra module import was needed to satisfy DI.
- **Issues Encountered:**
  - Existing tests covered the unknown-mode fallback but not the full normalization matrix required by the task, so additional tests were added before closing it.
- **Verification:**
  - Passed: `pnpm exec jest src/infrastructure/extractors/programmatic.extractor.spec.ts src/infrastructure/extractors/programmatic.extractor.docx.spec.ts --runInBand`

---

### TASK-T-004: Add structured timing telemetry
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~20m
- **Files Changed:**
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.ts` — introduced a local `ExtractionTimingFields` interface and switched timing math to explicit phase-boundary timestamps.
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.spec.ts` — strengthened telemetry assertions for successful DOCX extraction, empty-content warnings, `mode: null` on non-DOCX files, and `total_ms ≈ download_ms + extract_ms`.
- **Decisions Made:**
  - Kept the existing single JSON log payload shape and only tightened the implementation to match the design more explicitly.
  - Left the human-readable `Extracting ... programmatically` log line in place since the structured telemetry remains isolated and parseable.
- **Issues Encountered:**
  - The existing telemetry code was functionally close, but it lacked the named interface and explicit phase timestamps called for by the task, so both implementation and tests were tightened.
- **Verification:**
  - Passed: `pnpm exec jest src/infrastructure/extractors/programmatic.extractor.spec.ts src/infrastructure/extractors/programmatic.extractor.docx.spec.ts --runInBand`

---

### TASK-T-005: Explicit `.doc` rejection in `AssessmentsService`
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~15m
- **Files Changed:**
  - `packages/api/src/domain/assessments/assessments.service.ts` — updated the pre-upload `.doc` rejection message to the task-specified wording.
  - `packages/api/src/domain/assessments/assessments.service.spec.ts` — tightened assertions for the targeted `.doc` rejection, preserved generic unsupported-MIME behavior, and verified DOCX continues through the presign path.
- **Decisions Made:**
  - Kept the rejection in `AssessmentsService.requestUploadUrl()` so the user gets the message before S3 upload, matching the existing request flow.
- **Issues Encountered:**
  - The first generic-MIME assertion hardcoded an outdated allowed MIME list, so it was updated to use `ALLOWED_DOCUMENT_MIME_TYPES` directly.
- **Verification:**
  - Passed: `pnpm exec jest src/domain/assessments/assessments.service.spec.ts --runInBand`

---

### TASK-T-006: Add `DOCX_EXTRACTION_MODE` env var to both Lambdas
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~30m
- **Files Changed:**
  - `infra/cfn/alliance-risk-stack.template.yaml` — added `DOCX_EXTRACTION_MODE: text` to both `alliance-risk-worker` and `alliance-risk-api` Lambda environment blocks.
  - `packages/api/CLAUDE.md` — documented `DOCX_EXTRACTION_MODE` in the Lambda environment variables guidance.
- **Decisions Made:**
  - Left the existing CDK stack code and infra Jest assertions in place because they already included the env var; the checked-in CloudFormation template was the missing parity piece.
- **Issues Encountered:**
  - The repo `cfn:synth` script timed out and truncated the checked-in YAML template when its output redirection was interrupted, so the template had to be restored before reapplying the intended env-var change.
  - The repo `cfn:validate` script failed when invoked through the package script, but direct AWS CLI validation against the restored template succeeded.
- **Verification:**
  - Passed: `pnpm exec jest test/alliance-risk-stack.test.ts --runInBand`
  - Passed: `aws cloudformation validate-template --template-body "file:///Users/jcadavid/Desktop/DEV/Desarrollos/alliance-risk-analysis-tool/infra/cfn/alliance-risk-stack.template.yaml"`
  - Additional check: `pnpm exec cdk synth --no-staging` emitted synthesized output containing `DOCX_EXTRACTION_MODE: text` for both Lambdas.

---

### TASK-T-007: Write `docx-extraction.md` runbook
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~20m
- **Files Changed:**
  - `docs/runbooks/docx-extraction.md` — expanded the runbook with CloudWatch latency queries, rollback commands using `IBD-DEV`, expected timing thresholds, and operator pitfalls.
- **Decisions Made:**
  - Kept the rollback section explicit about re-sending all Lambda environment variables instead of trying to abstract it into a helper script.
  - Left the existing DOCX reprocess commands in the runbook because they are operationally related and already present in the repo.
- **Issues Encountered:**
  - Live AWS access was available, but the worker log group currently has no `extraction_complete` events, so the query syntax could be validated while live result presence could not be demonstrated from current traffic.
- **Verification:**
  - Confirmed AWS access with `aws sts get-caller-identity`
  - Confirmed target log groups exist with `aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/alliance-risk"`
  - Ran the documented Logs Insights query shape against `/aws/lambda/alliance-risk-worker`; query completed successfully but returned `0` DOCX events in the current retention window.

---

### TASK-T-008: Backfill script `reprocess-failed-docx.ts`
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~70m
- **Files Changed:**
  - `packages/api/src/worker.ts` — extended the authenticated worker action with `assessmentId` filtering, timeout matching, per-document action rows, and idempotent re-check before requeueing.
  - `packages/api/src/worker.reprocess-failed-docx.spec.ts` — added unit coverage for dry-run behavior, Word-only matching, and skip-on-recheck logic.
  - `packages/api/scripts/reprocess-failed-docx.ts` — added the TypeScript wrapper that invokes the worker and renders `{id, fileName, action}` results.
  - `packages/api/scripts/reprocess-failed-docx.sh` — added the shell entrypoint that compiles and runs the TypeScript wrapper.
  - `scripts/deploy-api.sh` — fixed Lambda packaging for mammoth/turndown transitive dependencies and excluded heavy test/fixture directories to avoid stalled deploys.
- **Decisions Made:**
  - Kept the implementation on the existing authenticated worker action instead of introducing a new API surface, matching the design.
  - Returned explicit result rows with `requeued`, `skipped`, and `dry-run-matched` actions so the wrapper can print the requested operator table.
- **Issues Encountered:**
  - The first live deploy exposed a real packaging bug: `mammoth` required `bluebird/js/release/promise`, which was missing from the Lambda bundle.
  - The follow-up deploy path initially stalled while copying `@mixmark-io/domino` because the generic pnpm-store copy helper included large test/fixture trees; excluding those directories fixed the deploy time.
  - Dev currently has no failed Word documents that match the backfill query, so the live verification could confirm the dry-run path and handler execution but not an actual requeue.
- **Verification:**
  - Passed: `pnpm exec jest src/worker.reprocess-failed-docx.spec.ts --runInBand`
  - Passed: `pnpm exec tsc "scripts/reprocess-failed-docx.ts" --module commonjs --target ES2021 --esModuleInterop --outDir "/tmp/reprocess-failed-docx-check"`
  - Passed after deploy: `bash packages/api/scripts/reprocess-failed-docx.sh --dry-run` returned exit `0` with `{ "matched": 0, "requeued": 0, "dryRun": true, "assessmentId": null }`
  - Confirmed in CloudWatch: worker log line `DOCX reprocess dry run matched 0 failed document(s)` from the new handler.

---

### TASK-T-009: Regression DOCX fixture + perf assertion
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~30m
- **Files Changed:**
  - `packages/api/test/fixtures/sample-business-plan.docx` — added a synthetic DOCX fixture with headings, bullets, and three 5-row tables; no customer content.
  - `packages/api/src/infrastructure/extractors/programmatic.extractor.perf.spec.ts` — added an env-gated perf spec for text and html DOCX extraction paths.
- **Decisions Made:**
  - Gated the perf spec behind `RUN_DOCX_PERF=1` so default Jest runs remain stable while still keeping the test checked in and easy to opt into.
  - Used a generated OOXML fixture under `test/fixtures/` instead of relying on an in-memory buffer so future integration tests can reuse the same artifact.
- **Issues Encountered:**
  - Mammoth still reports harmless style-recognition warnings for the synthetic `Title` and `List Bullet` styles on the HTML conversion path, but the extraction output and perf thresholds are unaffected.
- **Verification:**
  - Passed: `RUN_DOCX_PERF=1 pnpm exec jest src/infrastructure/extractors/programmatic.extractor.perf.spec.ts --runInBand`
  - Observed timings on this machine: text mode `60 ms`, html mode `81 ms`, both with `content_length > 3000`.

---

### TASK-T-010: End-to-end integration test
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~20m
- **Files Changed:**
  - `packages/api/src/platform/jobs/handlers/parse-document.handler.spec.ts` — extended the handler spec with two integration-level DOCX scenarios using the checked-in fixture, real `ProgrammaticExtractor`, and real `ExtractorFactory` wiring.
- **Decisions Made:**
  - Kept the new integration scenarios in the existing handler spec instead of creating a separate file so the unit and integration coverage remain close to the handler under test.
  - Mocked only `StorageService.downloadObject`, `PrismaService.assessmentDocument.update`, and the PDF-only `TextractExtractor` stub needed to satisfy `ExtractorFactory` construction.
- **Issues Encountered:**
  - None blocking; the existing unit tests remained stable after adding the real-extractor scenarios.
- **Verification:**
  - Passed: `pnpm exec jest src/platform/jobs/handlers/parse-document.handler.spec.ts --runInBand`

---

### TASK-T-011: Deploy to dev + smoke
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~45m
- **Files Changed:**
  - No additional source changes required during the smoke itself beyond previously completed implementation work.
- **Decisions Made:**
  - Used the checked-in synthetic fixture `packages/api/test/fixtures/sample-business-plan.docx` for the dev smoke because the client's Ecovado sample is not present in the workspace and is intentionally not checked into git.
  - Created a temporary Cognito smoke user (`smoke.docx.dev@example.com`) to exercise the deployed CloudFront UI end-to-end without relying on unknown existing credentials.
- **Issues Encountered:**
  - The first `AWS_PROFILE=IBD-DEV pnpm deploy:api` attempt collided with an in-progress Lambda update (`ResourceConflictException`); retrying after the functions returned to `Active` succeeded.
  - CloudWatch Logs Insights did not return parsed `extraction_complete` rows for the ANSI-colored NestJS log output, so the extraction timing was verified from the raw CloudWatch log stream instead.
- **Verification:**
  - Passed: `AWS_PROFILE=IBD-DEV pnpm --filter @alliance-risk/infra cfn:deploy dev`
  - Passed: `AWS_PROFILE=IBD-DEV pnpm deploy:api`
  - Verified env vars:
    - `AWS_PROFILE=IBD-DEV aws lambda get-function-configuration --function-name alliance-risk-api` → `DOCX_EXTRACTION_MODE=text`
    - `AWS_PROFILE=IBD-DEV aws lambda get-function-configuration --function-name alliance-risk-worker` → `DOCX_EXTRACTION_MODE=text`
  - UI smoke passed on deployed CloudFront (`https://d363y7wran37rr.cloudfront.net`): login → forced password set → dashboard → create assessment → upload DOCX → redirect to gap detector.
  - API verification passed: `GET /api/assessments/628d7a52-2e74-4659-8c79-cece4d6b06b1/documents` returned the uploaded DOCX with `status: "PARSED"`.
  - Raw worker CloudWatch log contained the structured extraction event:
    - `{"event":"extraction_complete","mime":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","fileName":"sample-business-plan.docx","mode":"text","download_ms":288,"extract_ms":192,"total_ms":480,"content_length":3088}`
  - Latency target met: observed `total_ms = 480`, below the `< 1000 ms` dev smoke target.

---

### TASK-T-012: Run backfill on dev
- **Status:** Completed
- **Date:** 2026-04-13
- **Duration:** ~10m
- **Files Changed:**
  - `docs/specs/enhancements/upload-word-documents/tasks.md` — marked the dev backfill task complete and recorded the zero-row outcome.
  - `docs/specs/enhancements/upload-word-documents/execution.md` — logged the live dev backfill verification results.
- **Decisions Made:**
  - Closed the task with a zero-row operational result because the backfill script was verified in both dry-run and live modes against dev, and there were no failed Word documents matching the designed requeue filter.
  - Did not manufacture a failing dev record solely to satisfy the manual requeue path because the task scope is to run the deployed backfill on existing dev data.
- **Issues Encountered:**
  - Dev still has no matching failed Word documents, so there were no `FAILED -> PARSING -> PARSED` transitions or downstream job completions to poll during this step.
- **Verification:**
  - Passed: `AWS_PROFILE=IBD-DEV bash packages/api/scripts/reprocess-failed-docx.sh --dry-run` returned `{ "matched": 0, "requeued": 0, "dryRun": true, "assessmentId": null }`
  - Passed: `AWS_PROFILE=IBD-DEV bash packages/api/scripts/reprocess-failed-docx.sh` returned `{ "matched": 0, "requeued": 0, "dryRun": false, "assessmentId": null }`
  - Additional check: recent `/aws/lambda/alliance-risk-worker` logs showed normal worker processing during the verification window and no backfill failures.

---

### TASK-T-013: Client communication (optional)
- **Status:** Deferred / Blocked
- **Date:** 2026-04-13
- **Duration:** ~5m
- **Files Changed:**
  - `docs/specs/enhancements/upload-word-documents/tasks.md` — marked the optional client communication task as blocked pending a team decision.
- **Decisions Made:**
  - Left client outreach unresolved because design §13 explicitly treats this as an operator-level decision, not an implementation task.
  - Recorded the task as blocked rather than completed so the remaining non-technical follow-up stays visible.
- **Issues Encountered:**
  - No authoritative instruction exists in the repo for whether the CGIAR partner should be notified proactively after the fix.
- **Verification:**
  - Confirmed `design.md` §13 open question #2 is still undecided.
