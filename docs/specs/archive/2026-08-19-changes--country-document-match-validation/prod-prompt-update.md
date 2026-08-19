# Production `gap_detector` Prompt Update — Manual Step

This is the manual production update step described in `design.md` §6.4 (DD-CMV-005): local dev picks up the new prompt automatically via `seed.ts` + `npx --prefix packages/api tsx prisma/seed.ts`, but staging/production RDS is in a private VPC with no `seed-remote` path, so an Admin must apply this same change by hand through the Prompt Manager admin UI.

## 1. Text to paste — "## Country Detection" block

Paste this block **immediately before** the existing `## Output Format` heading in the System Prompt field:

```
## Country Detection

Independent of the country context stated earlier in this prompt, look **only** at what the documents themselves say and determine the primary country where this business actually operates. The context above reflects a value the user selected when starting this assessment — it may be wrong, and this check exists specifically to catch that. Do not let it influence your answer here.

Return this as a top-level `detectedCountry` value: the country's common English name (e.g. `"Kenya"`, `"Tanzania"`, `"Malawi"`) if the documents clearly support one — **it does not need to be one of the four countries mentioned elsewhere in this prompt; name whichever real country the documents actually describe.** If the documents don't clearly indicate an operating country at all, return the literal string `"unclear"` instead. Also return a `detectedCountryConfidence` number from 0.0 to 1.0 for that classification, using the same bar as `VERIFIED` above (≥ 0.7 means confident) — if you're below that confidence, return `"unclear"` with a correspondingly low confidence.
```

## 2. Replacement — reordered "## Output Format" JSON example

Replace the existing `## Output Format` JSON example with this reordered version (`detectedCountry` and `detectedCountryConfidence` now come **before** `fields` — this matters for truncation-safety, since the handler's `repairTruncatedJson()` strips the trailing incomplete key first when a response is cut off by `maxTokens`; ordering the smaller, cheaper-to-emit country fields first means the model writes them before it can run out of tokens partway through the much larger `fields` array):

```
## Output Format

Return a JSON object with this exact structure:
{
  "detectedCountry": "<the detected country's common English name, or \"unclear\">",
  "detectedCountryConfidence": <0.0-1.0>,
  "fields": [
    {
      "field": "<field_key>",
      "status": "VERIFIED" | "PARTIAL" | "MISSING",
      "extractedValue": "<relevant text from document(s) or null>",
      "confidence": <0.0-1.0>,
      "reasoning": "<1-2 sentence explanation of classification, mentioning which document(s) provided the information>"
    }
  ]
}

You MUST return exactly 10 field entries, one for each Core 10 field.
Return ONLY the JSON object, no additional text.
```

## 3. Where to make this change

1. Go to **Prompt Manager** (`/admin/prompt-manager`).
2. Find the active `gap_detector` prompt — currently named **"Gap Detector - Default"** in this environment, but **verify against whichever `gap_detector` prompt is actually `isActive: true`** before editing. Per DD-CMV-005's caveat: the local seed script looks up the prompt to update by `{ section: 'gap_detector', name: 'Gap Detector - Default' }` (`seed.ts`), while the handler at runtime selects whichever `gap_detector` prompt has `isActive: true`, most recently updated (`gap-detection.handler.ts` — `prisma.prompt.findFirst({ where: { section: 'gap_detector', isActive: true }, orderBy: { updatedAt: 'desc' } })`). If an Admin has since created and activated a *different* `gap_detector` prompt, this edit must target that prompt instead — not necessarily the one named "Gap Detector - Default".
3. Open it for editing.
4. In the **System Prompt** field:
   - Paste the "## Country Detection" block (§1 above) immediately before the existing "## Output Format" heading.
   - Replace the existing "## Output Format" JSON example with the reordered version (§2 above).
5. **Save** — this creates a new `PromptVersion` snapshot via `PromptsService` (`PUT /api/admin/prompts/:id/update`) and keeps the prompt `isActive: true`, exactly like any other admin prompt edit.

No other field (User Prompt Template, model, temperature, etc.) needs to change for this update.
