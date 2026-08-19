# Judgment Day — `design.md` Review

**Target:** `docs/specs/changes/country-document-match-validation/design.md`
**Mode:** Blind dual review (2 independent judges, model: opus, author model: sonnet — author ≠ auditor)
**Round:** 1
**Date:** 2026-08-18

---

## Merged Ledger

### CONFIRMED SEVERE (both judges independently found the same defect)

#### JD-01 — `assessment.update()` unguarded inside the existing Bedrock try/catch
**Both judges, SEVERE.** design.md §6.2 places the new `prisma.assessment.update({ data: { detectedCountry } })` inside the same `try` block (`gap-detection.handler.ts:194-234`) whose `catch` calls `createErrorFields()` — which overwrites **all 10 Core-10 fields as MISSING** with `aiReasoning: "AI analysis failed: …"`. Any failure of the new write (transient DB error, connection blip, `VarChar(100)` overflow) is caught by a handler whose only recovery path is "Bedrock failed," discarding a **successful** extraction. Violates FR-CMV-001 Sc2 ("BUT it must NOT block gap detection or Core-10 field extraction from completing"), NFR-CMV-011 (fail-quiet), and directly contradicts design.md §12's own "no decision inverts existing behavior" claim.
**Fix:** wrap the new persistence in its own try/catch (log + leave `null`), and/or move it after `createFieldsFromAIResponse`/`updateFieldsFromAIResponse` succeed.

#### JD-02 — Existing handler test mock has no `assessment` key
**Both judges (A: SEVERE, B: WARNING — same fact).** `gap-detection.handler.spec.ts`'s `mockPrisma` = `{ job, prompt, gapField }` — no `assessment`. Adding the JD-01 write makes `this.prisma.assessment` `undefined` in the one existing test, throwing a `TypeError` that (per JD-01) is silently swallowed by the catch block — the existing test would go **green while exercising the error path**, proving nothing.
**Fix:** extend `mockPrisma` with an `assessment: { update: jest.fn() }` before adding any new test.

#### JD-03 — No path to deploy the updated prompt outside local dev
**Judge B only, SEVERE, but well-evidenced (single-judge — recorded as suspect per protocol, escalating due to severity/evidence quality).** RDS is in a private VPC (root `CLAUDE.md`); there is no `seed-remote` script (root `package.json` only has `migrate:deploy`/`migrate:remote`/deploy scripts); `worker.ts` exposes only `run-sql` and `reprocess-failed-docx`. DD-CMV-005 explicitly rejects the one mechanism that *can* reach the deployed DB (`PromptsService` admin flow). **As designed, the deployed `gap_detector` prompt never gains the `detectedCountry` instruction — the feature ships completely inert (no dialog ever fires) in every non-local environment, with all tests green.**
**Fix:** design.md needs an explicit deployment step for the prompt update — e.g., apply it via the Prompt Manager admin UI (the exact mechanism DD-CMV-005 currently rules out), or hand-written SQL via `run-sql`, or a new seed-remote worker action.

### CONFIRMED (real defect, judges split on severity label — recommended fixes, all cheap)

| ID | Finding | A | B |
|---|---|---|---|
| JD-04 | `countryMismatch` only excludes `'unclear'`, doesn't enforce BR-CMV-001's `SUPPORTED_COUNTRY_LABELS` membership — use the already-exported `isSupportedCountry()` | SEVERE | WARNING |
| JD-05 | `detectedCountry` confidence is never captured — BR-CMV-003's "≥0.7" gate is prompt prose only, unenforced and untestable | WARNING | WARNING |
| JD-06 | Backend paths (re-analyze+Bedrock-failure; zero-parse-jobs re-run) leave a stale non-null `detectedCountry` — violates NFR-CMV-011 and FR-CMV-006 | WARNING | WARNING |
| JD-07 | New hint banner has no auto-clear when the mismatch resolves (unlike the pattern it claims to mirror, `:293-298`) | WARNING | WARNING |
| JD-08 | Both system and user prompt already assert "operating in `{{country}}`" before asking the model to verify the country — anchoring bias toward false negatives | WARNING | SEVERE |
| JD-09 | NFR-CMV-012's cited test evidence (`gap-field.controller.spec.ts`) is fully mocked and cannot detect an `allMandatoryComplete` regression | WARNING | SEVERE |
| JD-10 | `detectedCountry` placed last in the output JSON — existing truncation-repair strips trailing incomplete keys first | WARNING | WARNING |
| JD-11 | §10 wrongly credits `if (!id) return` with guarding the "assessment not loaded" case (it guards the URL param, not the query state) | WARNING | WARNING |
| JD-12 | Test-LOC budget (~150-200) under-estimated — no repo precedent for testing a page-client this size; realistic ~280-400 | WARNING | WARNING |
| JD-16 | "memoized alongside `allMandatoryComplete` at line 281" is wrong — line 281 is a plain const, not `useMemo` | WARNING | SUGGESTION |

### SINGLE-JUDGE (suspect — not auto-fixed, recorded for visibility)

| ID | Finding | Judge |
|---|---|---|
| JD-13 | Two amber banners (validation-rejection + mismatch-hint) can stack with no precedence rule | A |
| JD-14 | `getCountryFlag()` takes `SupportedCountryLabel`, will be called with plain `string`; reuse `CountryBadge`/`isSupportedCountry()` instead | A + B (suggestion-level both) |
| JD-15 | Hint/dialog copy "Risk analysis won't start until you confirm" contradicts the feature's own non-blocking premise | A + B (suggestion-level both) |
| JD-17 | §7's ordering instructions risk a TDZ `ReferenceError` if the click wrapper is declared before `countryMismatch` (design anchors wrapper at "line 196", `countryMismatch` at "line 281") | A only |
| JD-18 | Seed lookup keyed by `(section, name)`, not guaranteed to hit whichever prompt is actually `isActive` if an admin created a separate one | A only |
| JD-19 | DD-CMV-005 "unconditionally" overstates — the update is the `else if (existing)` branch; a fresh DB takes the `create` branch instead | B only |
| JD-20 | New test file's path unspecified — repo convention is colocated `__tests__/` | B only |
| JD-21 | Two DB writes per job (status/progress update + new detectedCountry update) could fold into one | B only |

---

## Summary

| | Count |
|---|---|
| Confirmed SEVERE (both judges, same defect) | 2 (JD-01, JD-02) |
| Confirmed SEVERE (single judge, high-evidence, escalated) | 1 (JD-03) |
| Confirmed (real, severity split) | 8 (JD-04 – JD-12, JD-16) |
| Single-judge / suggestions | 8 (JD-13 – JD-21) |

**Judge A totals:** 5 SEVERE, 11 WARNING, 8 SUGGESTION.
**Judge B totals:** 4 SEVERE, 9 WARNING, 6 SUGGESTION.

## Recommendation (round 1)

JD-01 + JD-02 together mean design.md's central "purely additive, no regression" claim (§12) is **false as written** — a plausible, easy-to-hit failure path (a transient DB error on the new write) silently destroys a successful gap-detection run. JD-03 means the feature would ship non-functional outside a developer's laptop (user decision: left manual, see design.md §6.4, not automated). These three should be fixed in `design.md` before `tasks.md` is decomposed from it — otherwise every downstream task inherits the same blind spots.

JD-04 through JD-12 are all real and cheap to address (mostly one-line guards, ordering notes, or budget corrections) and are worth folding into the same fix pass rather than discovering them mid-implementation.

---

## Round 2 — Scoped Re-Judgment (after fix round 1)

Both judges re-verified JD-01 through JD-21 against the fixed `design.md`. Consolidated result: **18-20 of 21 items RESOLVED**, but **3 confirmed FIX-CAUSED DEFECTS** (real problems introduced by the round-1 fix itself, not carried over from round 1):

- **JD-02 (re-opened):** the round-1 fix's rationale was wrong — it claimed the *existing* handler test would break, but that test calls `processUploadMode()` directly and never touches `prisma.assessment` under the new (DD-CMV-006, fold-into-`execute()`) design. The real gap was under-specifying what the *new* `execute()`-level tests need to mock.
- **JD-06 / §10 row (re-opened):** the fix incorrectly stated `createSkeletonFields()` needed to gain its own `Assessment`-clearing write — re-introducing exactly the "second, separately-guarded write" shape DD-CMV-006 was designed to eliminate.
- **JD-15 (re-opened):** the round-1 copy fix replaced a "blocking-sounding" line with a new line that was itself factually wrong ("proceeds as soon as you click Analyze Risks again" contradicts FR-CMV-004 Scenario 2, which requires the dialog to reappear on every click while unresolved).

Additional NEW findings from round 2 (both judges independently, same substance): missing `let detectedCountry = null` initializer in `execute()` (Prisma treats `undefined` as "no change," silently defeating null-clearing); §4 contradicted §6.2 on whether `"unclear"` is ever persisted to the DB; the hint banner copy was narrowed to one sentence, dropping the two remediation paths FR-CMV-005 Sc1 requires; `requirements.md` NFR-CMV-012 still asserted the disproven "verified by `gap-field.controller.spec.ts`" claim after design.md's own correction.

**Fix round 2 applied** — addressed all of the above (see current `design.md` for corrected text) plus minor line-reference accuracy fixes.

---

## Round 3 — Final Scoped Re-Judgment (after fix round 2, last permitted round)

Both judges re-verified items (a)–(g) covering every round-2 finding. **All 7 are independently confirmed RESOLVED by both judges** — no disagreement there.

**However, the judges reached different overall verdicts:**

- **Judge A: READY.** Found only cosmetic/suggestion-level residuals (a stale `requirements.md` mention of `"unclear"`, a missing `$transaction` mock note, minor line-reference drift).
- **Judge B: NOT READY.** Found the same cosmetic residuals as Judge A, **plus one SEVERE, well-evidenced finding not previously in the ledger:**

  **NEW — SEVERE (Judge B, round 3): §7's "No hook changes … no new fetch" claim forecloses the exact fix FR-CMV-006 and the JD-07 auto-clear both depend on.** Verified: `useAssessment` has a 2-minute `staleTime` (`use-assessments.ts:78`); the only `['assessment', id]` query invalidation anywhere in the web package lives in `useUpdateAssessment` (unrelated to gap-detection/re-analysis); `useReAnalyzeGaps` invalidates only `['gap-fields', …]`; the job-completion effect on the gap-detector screen only fires a toast. Consequence: after a successful re-analysis (following a document replacement, FR-CMV-006's own scenario), `assessment.detectedCountry` in the client cache does not refresh for up to 2 minutes — the mismatch dialog can keep firing on a resolved mismatch, and the JD-07 hint auto-clear (which depends on `countryMismatch` going false) cannot fire either. This is the same class of issue **Judge A flagged in round 1 as S4** (single-judge at the time, not carried into the merged "confirmed" bucket that got fixed) — now independently re-surfaced by Judge B in round 3.

**This is a genuine judge contradiction on a SEVERE finding, and both fix-round and re-judgment budgets (2 of 2 each) are now exhausted per the Judgment Day protocol.** Per protocol: "Judges contradict → Escalate for explicit human decision" and "Any issue remains after round two → Escalate and stop."

## Final Status: **ESCALATED ⚠️ → Resolved by explicit user decision, out-of-band fix applied**

Escalated to the user rather than applying a third, unauthorized fix round. User explicitly approved one additional targeted fix outside the formal 2-round budget (option 1: "apply the fix and continue to `tasks.md`").

**Fix applied:** `design.md` §7 now adds `queryClient.invalidateQueries({ queryKey: ['assessment', id] })` to the existing `jobStatus === JobStatus.COMPLETED` effect (the same effect that already invalidates `['gap-fields', id]` and fires the re-analysis-complete toast) — one additive line in an existing effect, no new hook, no new query key beyond the one already used everywhere else in the app for this exact resource. §11 gained a corresponding test row.

This closes the last outstanding SEVERE finding. Combined with all prior rounds:

| Round | SEVERE found | SEVERE resolved |
|---|---|---|
| 1 | JD-01, JD-02 (confirmed both judges), JD-03 (single-judge, escalated, resolved by design choice not automation) | — |
| 2 (post fix-1) | 3 fix-caused (JD-02 reopened, JD-06 row, JD-15 copy) | JD-01, JD-03 |
| 3 (post fix-2) | 1 new (query invalidation) | JD-02, JD-06, JD-15 and all round-2 NEW findings |
| Post fix-3 (this fix, out-of-band) | — | Query invalidation finding |

**Net result: every SEVERE finding across all rounds is now resolved.** Remaining open items are SUGGESTION-level only (a stale `"unclear"` mention in `requirements.md`'s glossary/scenarios — cosmetic, no behavioral gap since `isSupportedCountry()` guards it either way; a missing `$transaction` mock note for a re-analyze-success test case not currently in the enumerated test list; minor line-reference drift) — none block `tasks.md` decomposition, and are noted here for whoever writes the handler test task to pick up.

**JUDGMENT: APPROVED ✅** (post out-of-band fix, user-authorized)
