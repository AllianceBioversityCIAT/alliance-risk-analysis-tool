# General Setup — Requirements Template

> **Purpose:** Canonical format for `requirements.md` in every module spec under `docs/specs/`.  
> **Not a feature spec** — copy/adapt this structure when running `/akili-specify`.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `{domain|enhancement|bugfix|epic}/<module-name>` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | YYYY-MM-DD |
| **Author** | |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Product Requirements | `docs/prd.md` |
| C2 | UX/UI Design | `docs/ux-ui/design.md` |
| C3 | Technical Requirements | `docs/trd/trd.md` |

---

## 2. Requirement Numbering

Use prefixed IDs by module:

| Prefix | Type | Example |
|--------|------|---------|
| `FR-<MOD>-` | Functional requirement | `FR-GAP-001` |
| `NFR-<MOD>-` | Non-functional requirement | `NFR-GAP-010` |
| `BR-<MOD>-` | Business rule | `BR-RISK-003` |

`<MOD>` = 3–5 letter module code (e.g., `GAP`, `UWD`, `RPT`).

---

## 3. Requirement Structure

Each requirement MUST include:

```markdown
### FR-MOD-NNN: Short title

**Priority:** Must | Should | Could  
**Persona:** Analyst | Admin | System  

**Description:** One paragraph — what the system must do.

**Acceptance scenarios:**

#### Scenario N: Descriptive name
- **GIVEN** …
- **WHEN** …
- **THEN** …
- **AND IT MUST** … (strict validations)
- **BUT it must NOT** … (negative constraints)
```

---

## 4. Writing Standards

1. **Testable** — every FR has at least one Given/When/Then scenario
2. **User-centric** — describe observable behavior, not implementation
3. **Negative constraints** — explicitly state forbidden behavior (`BUT it must NOT`)
4. **No solution leakage** — avoid prescribing libraries unless TRD mandates
5. **Traceable** — link to PRD user stories where applicable (`US-NN`)
6. **Measurable NFRs** — include numeric targets (latency, error rate, size limits)

---

## 5. Required Sections (module requirements.md)

1. Document Control  
2. Overview & Scope (in/out for this module)  
3. Functional Requirements (numbered)  
4. Non-Functional Requirements  
5. Business Rules  
6. Dependencies & Assumptions  
7. Open Questions  

---

## 6. Spec Taxonomy

Place specs under:

```
docs/specs/
├── domain/           # Core domain modules (gap-detector, risk-analyzer, report-generator)
├── enhancements/     # Incremental improvements (upload-word-documents)
├── bugfix/           # Targeted defect fixes
└── epic/             # Multi-module initiatives
```

Each folder MUST contain at minimum: `requirements.md`, `design.md`, `tasks.md` (or `task.md`).

Optional: `execution.md` (created by `/akili-execute`), `validation.md` (from `/akili-validate`).

---

## 7. Constitution Alignment Checklist

Before marking requirements complete:

- [ ] Scoped items align with `docs/prd.md` in/out scope
- [ ] Personas match PRD (Analyst / Admin)
- [ ] No frontend-direct-Bedrock requirements
- [ ] Async AI work uses job polling pattern where applicable
- [ ] Static-export routing uses query params, not `[id]` paths
