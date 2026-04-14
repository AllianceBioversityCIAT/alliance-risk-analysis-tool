# Upload Word Documents — Task Plan

## 1. Document Control

| Field | Value |
|-------|-------|
| **Document** | Upload Word Documents Enhancement — Task Plan |
| **Project** | CGIAR Risk Intelligence Tool (MVP) |
| **Phase** | Enhancement — DOCX Extraction Performance Fix |
| **Version** | 1.0 |
| **Date** | 2026-04-13 |

### Source Documents

| Ref | Document | Location |
|-----|----------|----------|
| R1 | Upload Word Documents Requirements | `docs/specs/enhancements/upload-word-documents/requirements.md` |
| R2 | Upload Word Documents Design | `docs/specs/enhancements/upload-word-documents/design.md` |

---

## 2. Legend

### Expertise Tags

| Tag | Meaning |
|-----|---------|
| `[BE]` | Backend (NestJS / Node.js) |
| `[INFRA]` | Infrastructure (CloudFormation / CDK) |
| `[DOCS]` | Documentation (runbook / spec annotations) |
| `[OPS]` | Operational (deploy / backfill / client comms) |

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| `[!]` | Blocked |

### Skill References

| Skill | Usage |
|-------|-------|
| `nestjs-expert` | NestJS module + DI + ConfigService integration + Jest test patterns |
| `systematic-debugging` | Tracing cold-start import cost, verifying tight timing-log format |
| `error-handling-patterns` | Targeted error message for legacy `.doc`; defensive env var parsing |
| `aws-serverless` | CloudFormation template edit + Lambda env var propagation; deploy-api.sh interaction |
| `api-design-principles` | DTO validator refinement for the `.doc` rejection path |
| `brainstorming` | Already consumed in Phases 1-2; referenced here for context only |

---

## Phase A: Foundation (Sequential — unblocks everything)

### T-001: Hoist `mammoth` and `turndown` to module top-level `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `systematic-debugging`
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-UWD-010, FR-UWD-011, FR-UWD-012, NFR-UWD-032
- **Design Ref:** §2 (extractDocx before/after), §6 (ProgrammaticExtractor surface)
- **Scope:**
  - Replace `const mammoth = await import('mammoth')` inside `extractDocx` with `import mammoth from 'mammoth'` at file top
  - Replace the dynamic `TurndownService` import inside `htmlToMarkdown` with `import TurndownService from 'turndown'` at file top
  - Handle mammoth/turndown ESM-vs-CJS interop (both are CJS; `import x from 'x'` with `esModuleInterop: true` produces the correct default export)
  - Verify `scripts/deploy-api.sh` externals list still includes `turndown` under `EXTERNALS` (it should; top-level import doesn't affect bundling target)
  - Run `pnpm --filter @alliance-risk/api build` and confirm bundle size doesn't grow by more than 1 MB (NFR-UWD-032)
- **Tests:** Existing `programmatic.extractor.spec.ts` must continue to pass without modification.
- **Done when:** Top-level imports compile cleanly; dist bundle produced by esbuild runs in Lambda without runtime `MODULE_NOT_FOUND`; existing tests green.

---

## Phase B: Core Feature (Sequential after T-001)

### T-002: Implement `extractRawText` path + mode dispatch `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `systematic-debugging`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-UWD-001, FR-UWD-002, FR-UWD-003, FR-UWD-004, FR-UWD-005, NFR-UWD-001, NFR-UWD-002, NFR-UWD-003
- **Design Ref:** §2 (new extractDocx flow), §6 (method signatures)
- **Scope:**
  - Split current `extractDocx(buffer)` into two private methods:
    - `extractDocxAsText(buffer)` — new, uses `mammoth.extractRawText({ buffer })`
    - `extractDocxAsHtml(buffer)` — renamed from existing inline logic, byte-for-byte preserved
  - Route to one or the other inside `extractDocx(buffer)` based on `this.docxMode` (from T-003)
  - Both paths must return the same string type, assigned to BOTH `textContent` and `markdownContent` of the returned `ExtractionResult` (FR-UWD-002)
  - Update `metadata.extractorModel` to carry `programmatic-docx-text` or `programmatic-docx-html` per mode
- **Tests:**
  - Unit test: `extractDocxAsText` returns non-empty string for a minimal DOCX fixture
  - Unit test: `extractDocxAsHtml` produces output byte-identical to pre-change behavior on the same fixture
  - Unit test: non-DOCX MIME types (Excel, CSV, HTML, MD) produce identical output before/after (FR-UWD-005)
- **Done when:** Both DOCX paths work; `metadata.extractorModel` reflects the mode; non-DOCX paths remain unchanged in output and timing.

### T-003: Inject `ConfigService` + resolve `DOCX_EXTRACTION_MODE` `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `error-handling-patterns`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-UWD-030, FR-UWD-031, FR-UWD-032, FR-UWD-034
- **Design Ref:** §6 (Mode resolution logic), §9 (CloudFormation changes)
- **Scope:**
  - Add `ConfigService` to `ProgrammaticExtractor` constructor params
  - Add `private readonly docxMode: DocxExtractionMode` field
  - Implement `resolveDocxMode()` per design §6:
    - Read `DOCX_EXTRACTION_MODE`; lowercase + trim
    - Accept `text` or `html`; anything else → warn log + default `text`
    - Missing env var → default `text`
  - Call `this.docxMode = this.resolveDocxMode()` in constructor (ONCE per cold start per FR-UWD-032)
  - Add explicit `ConfigService` to `ExtractorsModule` imports if not already present (should be available via `ConfigModule.forRoot({ isGlobal: true })` in `AppModule`)
- **Tests:**
  - Unit test: `resolveDocxMode()` returns `text` for undefined / empty / unknown values
  - Unit test: returns `text` for `TEXT`, `text`, `  text  ` (case + whitespace tolerance)
  - Unit test: returns `html` for `html`, `HTML`, `Html`
  - Unit test: emits `warn` log exactly once for unknown values
- **Done when:** Mode resolution is deterministic, cached per container, and a flipped env var takes effect on next cold start without code changes.

### T-004: Add structured timing telemetry `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `systematic-debugging`
- **Size:** M
- **Dependencies:** T-001, T-002, T-003
- **Requirements:** FR-UWD-020, FR-UWD-021, FR-UWD-022, FR-UWD-023, NFR-UWD-020
- **Design Ref:** §6 (Timing telemetry shape)
- **Scope:**
  - Add `ExtractionTimingFields` interface local to the file
  - Capture `downloadStartedAt`, `downloadCompletedAt`, `extractCompletedAt` via `Date.now()` in `extract()`
  - Build a single JSON object with `{ event: 'extraction_complete', mime, fileName, mode, download_ms, extract_ms, total_ms, content_length }`
  - Log at `info` level via `this.logger.log(JSON.stringify(obj))`
  - When `content_length === 0`, emit `this.logger.warn(...)` with the same object (FR-UWD-022, FR-UWD-042 context)
  - `mode` is `null` for non-DOCX MIME types
  - Ensure extracted content itself is **never** logged — only its length (NFR-UWD-040)
- **Tests:**
  - Unit test: Logger spy captures one `log` call with parseable JSON matching the schema for a successful DOCX extract
  - Unit test: empty-content extraction triggers `warn` instead of `log`
  - Unit test: non-DOCX extraction (e.g., CSV) emits `mode: null`
  - Unit test: `total_ms` equals `download_ms + extract_ms` within ±5 ms tolerance
- **Done when:** CloudWatch Logs Insights can run the query in design §6 and get aggregated p95/max/count per 5-minute bin.

---

## Phase C: Edge Cases (Parallel with Phase B)

### T-005: Explicit `.doc` rejection in `AssessmentsService` `[BE]`

- **Status:** `[x]`
- **Skills:** `api-design-principles`, `nestjs-expert`, `error-handling-patterns`
- **Size:** S
- **Dependencies:** None (touches a different file than T-001-T-004)
- **Requirements:** FR-UWD-040, FR-UWD-043, FR-UWD-063
- **Design Ref:** §6 (AssessmentsService — clearer `.doc` rejection)
- **Scope:**
  - In the MIME validation path of `AssessmentsService` (or the `RequestUploadDto` validator), add a conditional BEFORE the generic "Unsupported file type" rejection:
    - If `mimeType === 'application/msword'` → throw `BadRequestException('Legacy .doc format is not supported. Please save the document as .docx (Word 2007+) and re-upload.')`
  - Rejection fires on the `POST /api/assessments/:id/documents` request (pre-S3-upload) so the user sees the error in the upload dialog, not as an async failure
  - No change to `ALLOWED_DOCUMENT_MIME_TYPES` in shared — `.doc` remains absent (the new conditional just gives a better message for a known-unsupported MIME)
- **Tests:**
  - Unit test: calling `requestUpload` with `mimeType: 'application/msword'` throws `BadRequestException` with the specific message
  - Unit test: other unsupported MIME types (e.g., `application/x-rar`) still receive the generic rejection message
  - Unit test: DOCX MIME (`...wordprocessingml.document`) proceeds to the S3 presign step successfully
- **Done when:** A user uploading a `.doc` file sees the actionable message in the upload dialog; existing generic rejections unchanged.

---

## Phase D: Infrastructure (Parallel with Phase B, required before deploy)

### T-006: Add `DOCX_EXTRACTION_MODE` env var to both Lambdas `[INFRA]`

- **Status:** `[x]`
- **Skills:** `aws-serverless`
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-UWD-030, FR-UWD-033, FR-UWD-034, NFR-UWD-010
- **Design Ref:** §9 (Infrastructure & Deployment)
- **Scope:**
  - In `infra/cfn/alliance-risk-stack.template.yaml`, add `DOCX_EXTRACTION_MODE: text` under the `Environment.Variables` block of BOTH `alliance-risk-api` and `alliance-risk-worker` Lambda resources
  - Mirror the change in `infra/lib/alliance-risk-stack.ts` (CDK) so `pnpm cfn:synth` keeps parity
  - Run `pnpm cfn:synth` and verify the generated template diff matches the manual YAML edit
  - Update the Lambda Environment Variables table in `packages/api/CLAUDE.md` to document `DOCX_EXTRACTION_MODE`
- **Tests:**
  - `pnpm --filter @alliance-risk/infra test` snapshot test regenerated and committed
  - `pnpm --filter @alliance-risk/infra cfn:validate` passes
- **Done when:** `pnpm cfn:synth` produces a clean diff; CFN template validates; CLAUDE.md env-var table updated.

---

## Phase E: Supporting Materials (Parallel — no code dependencies)

### T-007: Write `docx-extraction.md` runbook `[DOCS]`

- **Status:** `[x]`
- **Skills:** — (no skill required)
- **Size:** S
- **Dependencies:** T-004 (log format must be finalized first)
- **Requirements:** NFR-UWD-020, NFR-UWD-021
- **Design Ref:** §6 (CloudWatch Insights query example), §9 (Rollback plan)
- **Scope:**
  - Create `docs/runbooks/docx-extraction.md`
  - Sections:
    - **How to check DOCX extraction latency** — copy-pasteable CloudWatch Insights query
    - **How to roll back from `text` to `html` mode** — exact `aws lambda update-function-configuration` command with `IBD-DEV` profile note
    - **Known pitfalls** — env-var replacement gotcha (must re-specify all vars), cold-start propagation (~30s)
    - **Expected timings** — p95 < 1s for documents up to 500 KB; flag anything over 5s as abnormal
- **Tests:** Runbook manually verified by following the query and rollback steps on dev.
- **Done when:** Runbook is in place and the CloudWatch query returns results from a live deployment.

### T-008: Backfill script `reprocess-failed-docx.ts` `[BE]` `[OPS]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `aws-serverless`
- **Size:** M
- **Dependencies:** T-002
- **Requirements:** FR-UWD-050, FR-UWD-051, FR-UWD-052
- **Design Ref:** §11 (Backfill Script)
- **Scope:**
  - Create `packages/api/scripts/reprocess-failed-docx.ts`
  - Accept flags: `--dry-run` (default off), `--assessment-id=<uuid>` (optional filter)
  - Query logic:
    ```sql
    SELECT id, assessment_id, file_name, mime_type, error_message
    FROM assessment_document
    WHERE status = 'FAILED'
      AND mime_type IN (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      )
      AND (error_message ILIKE '%mammoth%'
           OR error_message ILIKE '%turndown%'
           OR error_message IS NULL
           OR error_message ILIKE '%timeout%');
    ```
  - For each row (unless `--dry-run`): call `JobsService.create(PARSE_DOCUMENT, { assessmentId, documentId, s3Key, mimeType, fileName }, adminUserId)`
  - Idempotency: skip rows already in `PARSING` or `PARSED` at time of re-check
  - Invocation wrapper: `packages/api/scripts/reprocess-failed-docx.sh` mirroring `scripts/migrate-remote.sh` pattern (uses Worker Lambda `run-sql`-style authenticated action)
  - Output: table of `{id, fileName, action}` where action is `requeued` / `skipped` / `dry-run-matched`
- **Tests:**
  - Unit test: dry-run mode does NOT call `JobsService.create`
  - Unit test: rows with Word MIME and mammoth error are matched; rows with PDF MIME are not
  - Unit test: rows already in `PARSING` status are skipped
- **Done when:** Running `reprocess-failed-docx.sh --dry-run` on dev lists the matching documents; removing `--dry-run` successfully re-queues them.

---

## Phase F: Testing (After Phases B + C + D)

### T-009: Regression DOCX fixture + perf assertion `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `systematic-debugging`
- **Size:** M
- **Dependencies:** T-002, T-004
- **Requirements:** FR-UWD-060, FR-UWD-061, FR-UWD-062, NFR-UWD-001
- **Design Ref:** §10 (Testing Strategy)
- **Scope:**
  - Create `packages/api/test/fixtures/sample-business-plan.docx` — a synthetic Word document with:
    - Multiple headings (H1, H2, H3)
    - At least 3 tables of 5+ rows
    - A bulleted list
    - No embedded images (keep fixture size < 100 KB)
    - **Not derived from any real client document**
  - Write `programmatic.extractor.perf.spec.ts`:
    - Load fixture
    - Run `extract()` in text mode — assert completion in < 2000 ms, non-empty content
    - Run `extract()` in html mode — assert completion in < 5000 ms, non-empty content
    - Both modes produce content_length > 500 chars for this fixture
  - Mark perf test with `@jest.slow` or env-gated skip to avoid CI flakiness on slow runners
- **Tests:** The perf spec IS the test.
- **Done when:** Both modes pass on developer machines; CI either runs the perf test consistently or skips it gracefully via env var.

### T-010: End-to-end integration test `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`
- **Size:** M
- **Dependencies:** T-009
- **Requirements:** FR-UWD-060 (integration-level), NFR-UWD-012
- **Design Ref:** §10 (Testing Strategy)
- **Scope:**
  - Extend `parse-document.handler.spec.ts` with an integration scenario:
    - Real `ProgrammaticExtractor` instance (not mocked)
    - Real mammoth + turndown imports
    - Mock only `StorageService.downloadObject` → returns the fixture buffer
    - Mock `PrismaService.assessmentDocument.update`
    - Assert `ExtractionResult` fields have expected shapes
    - Assert handler status transitions: `PARSING` → `PARSED`
  - Run the same scenario with `DOCX_EXTRACTION_MODE=html` (via `process.env` manipulation within the test) and assert the legacy path also succeeds
- **Tests:** The e2e spec IS the test.
- **Done when:** Both modes pass handler-level integration; no regression in existing `parse-document.handler.spec.ts` scenarios.

---

## Phase G: Release (Sequential — after all prior phases)

### T-011: Deploy to dev + smoke `[OPS]`

- **Status:** `[x]`
- **Skills:** `aws-serverless`
- **Size:** S
- **Dependencies:** T-001, T-002, T-003, T-004, T-005, T-006, T-009, T-010
- **Requirements:** NFR-UWD-001, NFR-UWD-002, NFR-UWD-020
- **Design Ref:** §9 (Deployment order)
- **Scope:**
  - Infra deploy: `AWS_PROFILE=IBD-DEV pnpm --filter @alliance-risk/infra cfn:deploy dev`
  - API deploy: `AWS_PROFILE=IBD-DEV pnpm deploy:api`
  - Smoke: upload the Ecovado sample DOCX via the deployed CloudFront UI, parse, observe CloudWatch Insights query — confirm p95 < 1s
  - Verify env var is set on both Lambdas: `aws lambda get-function-configuration --function-name alliance-risk-worker | jq '.Environment.Variables.DOCX_EXTRACTION_MODE'`
- **Tests:** Manual smoke documented in execution log.
- **Done when:** Ecovado sample uploads and extracts in <1s on deployed dev; CloudWatch query returns the expected structured fields.

### T-012: Run backfill on dev `[OPS]`

- **Status:** `[x]`
- **Skills:** `aws-serverless`
- **Size:** S
- **Dependencies:** T-008, T-011
- **Requirements:** FR-UWD-050, FR-UWD-051, FR-UWD-052
- **Design Ref:** §11 (Backfill Script)
- **Scope:**
  - `./scripts/reprocess-failed-docx.sh --dry-run` — list matching documents
  - Review the list for sanity; escalate to user if count > 20
  - `./scripts/reprocess-failed-docx.sh` — actually re-queue
  - Poll `Job` table for `COMPLETED` status on re-queued jobs
  - Verify `AssessmentDocument.status` transitions from `FAILED` → `PARSING` → `PARSED` for affected rows
- **Tests:** Manual verification via DB query and CloudWatch.
- **Done when:** All previously-`FAILED` Word docs that were due to extraction issues are now `PARSED`, or marked with a different error if mammoth itself fails on them. On 2026-04-13 dev had zero matching failed Word docs, so the dry-run and live run both completed with `matched: 0` and `requeued: 0`.

### T-013: Client communication (optional) `[OPS]`

- **Status:** `[!]`
- **Skills:** — (non-technical)
- **Size:** S
- **Dependencies:** T-011
- **Requirements:** — (operational follow-up; not tied to an FR)
- **Design Ref:** §13 (Open Questions)
- **Scope:**
  - Per the open question in design §13 #2: confirm with the team whether we notify the CGIAR partner who filed the report
  - If yes: send a short message acknowledging the fix and inviting them to retry the Ecovado upload
  - If no: mark closed; client will discover the fix organically
- **Blocker:** Pending product/team decision on whether to proactively contact the client after the dev fix verification.
- **Tests:** —
- **Done when:** Decision recorded; communication sent if applicable.

---

## 3. Dependency Graph

```
Phase A (Foundation):
   T-001 (top-level imports)
     │
     ├─────────────┬─────────────┬─────────────┐
     ▼             ▼             ▼             │
  Phase B:       T-003         T-002         Phase C:
               (mode           (extract      T-005 (.doc rejection)
                resolve)        RawText
                               dispatch)
                 │             │
                 └─────┬───────┘
                       ▼
                     T-004 (timing logs)
                       │
                       ▼
                 T-007 (runbook)       T-008 (backfill script)
                                             │ depends on T-002
                                             ▼
Phase D (Infra — can run in parallel with B/C):
   T-006 (CFN env var)

Phase F (Testing):
   T-002, T-004 ──► T-009 (regression perf) ──► T-010 (e2e integration)

Phase G (Release):
   All above ──► T-011 (deploy + smoke) ──► T-012 (backfill run)
                                              │
                                              ▼
                                            T-013 (client comms, optional)
```

**Critical path**: T-001 → T-002 → T-004 → T-009 → T-010 → T-011 → T-012.
Estimated critical path time: ~1-1.5 days of focused work.

**Parallelization opportunities**:
- T-003 runs in parallel with T-002 after T-001
- T-005 (`.doc` rejection) is independent and can be picked up by a second engineer at any time
- T-006 (infra) is independent and can be picked up by a second engineer at any time
- T-007 (runbook) waits only on T-004 log format

---

## 4. Task Summary

| Phase | Task IDs | Sizes | Expertise |
|-------|----------|-------|-----------|
| A — Foundation | T-001 | 1S | BE |
| B — Core feature | T-002, T-003, T-004 | 2S + 1M | BE |
| C — Edge case | T-005 | 1S | BE |
| D — Infra | T-006 | 1S | INFRA |
| E — Supporting | T-007, T-008 | 1S + 1M | DOCS + BE/OPS |
| F — Testing | T-009, T-010 | 2M | BE |
| G — Release | T-011, T-012, T-013 | 3S | OPS |
| **Total** | **13 tasks** | **~20h** | **BE: 8, INFRA: 1, DOCS: 1, OPS: 3** |

### Size Distribution

| Size | Count | Est. Hours Each | Total |
|------|-------|-----------------|-------|
| S | 8 | 1-2 h | ~12 h |
| M | 5 | 2-4 h | ~15 h |
| L | 0 | — | — |
| XL | 0 | — | — |
| **Estimate** | — | — | **~20-27 h** |

---

## 5. Requirement Coverage Matrix

| Requirement | Task(s) |
|-------------|---------|
| FR-UWD-001 (extractRawText default) | T-002 |
| FR-UWD-002 (populate textContent + markdownContent) | T-002 |
| FR-UWD-003 (html mode via flag) | T-002, T-003 |
| FR-UWD-004 (legacy path byte-for-byte compatible) | T-002, T-009 |
| FR-UWD-005 (non-DOCX paths unchanged) | T-002 |
| FR-UWD-010 (top-level mammoth import) | T-001 |
| FR-UWD-011 (top-level turndown import) | T-001 |
| FR-UWD-012 (bundle safety) | T-001 |
| FR-UWD-020 (structured timing log) | T-004 |
| FR-UWD-021 (ms via Date.now at phase boundaries) | T-004 |
| FR-UWD-022 (warn on zero content) | T-004 |
| FR-UWD-023 (CloudWatch Insights compatible format) | T-004, T-007 |
| FR-UWD-030 (env var exists) | T-003, T-006 |
| FR-UWD-031 (accepted values / unknown handling) | T-003 |
| FR-UWD-032 (resolved once per cold start) | T-003 |
| FR-UWD-033 (set on both Lambdas via CFN) | T-006 |
| FR-UWD-034 (toggle without code deploy) | T-006, T-011 |
| FR-UWD-040 (.doc rejected clearly) | T-005 |
| FR-UWD-041 (mammoth error → FAILED status) | T-002 (preserves existing handler behavior) |
| FR-UWD-042 (empty raw text → PARSED + warn) | T-002, T-004 |
| FR-UWD-043 (rejection fires pre-S3) | T-005 |
| FR-UWD-050 (backfill script) | T-008 |
| FR-UWD-051 (idempotent) | T-008 |
| FR-UWD-052 (via run-sql-style pattern) | T-008 |
| FR-UWD-060 (unit tests both modes) | T-002, T-003, T-004, T-010 |
| FR-UWD-061 (non-DOCX unchanged) | T-002, T-009 |
| FR-UWD-062 (regression fixture < 2s) | T-009 |
| FR-UWD-063 (.doc rejection unit test) | T-005 |
| NFR-UWD-001 (500 KB < 2s p95) | T-009, T-011 |
| NFR-UWD-002 (Ecovado sample < 1s p95) | T-011 |
| NFR-UWD-003 (memory ≤ 512 MB) | T-009 (measured), T-011 (verified on dev) |
| NFR-UWD-010 (rollback < 2 min) | T-006, T-007 |
| NFR-UWD-011 (no new runtime deps) | T-001 (enforced by bundle review) |
| NFR-UWD-012 (risk analysis parity) | T-012 (smoke via re-parse of representative assessments) |
| NFR-UWD-020 (queryable in CloudWatch within 1 min) | T-004, T-007, T-011 |
| NFR-UWD-021 (query template documented) | T-007 |
| NFR-UWD-030 (existing rows readable) | T-002 (no schema change) |
| NFR-UWD-031 (ExtractionResult shape unchanged) | T-002 |
| NFR-UWD-032 (bundle size +1 MB max) | T-001 |
| NFR-UWD-040 (do not log extracted content) | T-004 |

**Coverage: All 38 requirements are mapped to at least one task.**
