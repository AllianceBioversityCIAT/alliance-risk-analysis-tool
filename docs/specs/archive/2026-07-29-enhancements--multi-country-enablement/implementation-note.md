# Multi-Country Enablement — Implementation Note

> **Spec:** `docs/specs/enhancements/multi-country-enablement/`  
> **Date:** 2026-07-27

---

## Supported Countries

| Label | Flag | Storage value |
|-------|------|---------------|
| Kenya | 🇰🇪 | `"Kenya"` |
| Ethiopia | 🇪🇹 | `"Ethiopia"` |
| Nigeria | 🇳🇬 | `"Nigeria"` |
| Zambia | 🇿🇲 | `"Zambia"` |

**Configuration path:** `packages/shared/src/constants/supported-countries.ts`

Adding a country requires updating the shared allowlist, redeploying API + Web, and updating production prompts (see checklist below). No database migration is needed — `Assessment.country` already exists as `VARCHAR(100)`.

---

## Dashboard Country Filter

- **Context:** `CountryFilterProvider` mounted at root `app/layout.tsx` (not `(protected)/layout.tsx` as originally designed) — moved so `(admin)` routes using `AppLayout` don't crash without the provider
- **Persistence:** `localStorage` key `alliance_active_country`
- **Behavior:** Header selector sets active country; dashboard list and stats always filter by the selected country
- **Fallback:** Invalid or missing stored value defaults to Kenya

---

## API Contract

| Endpoint | Country behavior |
|----------|------------------|
| `POST /api/assessments` | Optional `country`; validated against allowlist; defaults to Kenya |
| `GET /api/assessments?country=` | Filters list to one country |
| `GET /api/assessments/stats?country=` | Scopes stat counts to one country |
| `PUT /api/assessments/:id` | `country` allowed only when `status === DRAFT` |

---

## AI Prompt Injection (`{{country}}`)

Job handlers inject `assessment.country` into prompts before Bedrock calls:

- **Gap detection** — system + user prompts
- **Risk analysis** — system + user prompts
- **Report generation** — narrative prompts + financial extraction context

**Seed prompts** in `packages/api/prisma/seed.ts` include `{{country}}` placeholders. Run `npx --prefix packages/api tsx prisma/seed.ts` against local DB to refresh defaults.

### Production prompt admin checklist

After deploy, update **active** prompts in Prompt Manager for these sections:

1. `gap_detector` — add country-context instruction with `{{country}}`
2. `risk_analysis` — replace Kenya-specific wording with `{{country}}`
3. `report_generation` — add country context to system and user templates

Verify each active prompt contains `{{country}}` or country-agnostic wording. Handlers log a **warning** when assessment country ≠ Kenya and the template contains hardcoded `"Kenya"` without the placeholder.

---

## Assessment Country vs Gap Field Country

| Concept | Source | Purpose |
|---------|--------|---------|
| **Assessment country** | `Assessment.country` (intake selection) | Dashboard filter, API validation, AI injection |
| **Country of operation** | Gap field `country_of_operation` | Extracted from uploaded documents — unchanged |

These are intentionally separate. Do not conflate intake country with extracted document data.

---

## Known Limitations

- Country allowlist is code-level — no admin UI to add countries at runtime
- AI uses general knowledge for country context; accuracy depends on model training and prompt quality
- Existing assessments retain their stored country; no retroactive migration
- Country cannot be changed after assessment leaves `DRAFT` status

---

## Verification (manual QA)

1. Select each country in header → dashboard list/stats update
2. Create assessment in Nigeria → verify `country` on row badge and in workflow sub-header
3. Run gap detection / risk analysis → confirm prompts receive Nigeria (CloudWatch logs or prompt preview)
4. Attempt `PUT` country change on non-DRAFT assessment → expect 400

---

## Rollback

Revert deploy. No schema changes to undo. Kenya remains the default for omitted country values.
