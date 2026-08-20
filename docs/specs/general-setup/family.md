# General Setup — Spec Family Manifest Template

> **Purpose:** Canonical schema for `family.md`, authored **only** when a proposal is split into
> multiple child specs. A flat, unsplit spec needs no `family.md` — its absence is not a gap.

---

## When To Create One

`/akili-propose` or `/akili-specify` authors exactly one `family.md` per spec family, placed at the
**parent** spec path, the moment a proposal's scope is chunked into ordered child specs. It never
appears for a single bounded change.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Parent spec path** | `docs/specs/{taxonomy}/<parent-name>/` |
| **Date created** | YYYY-MM-DD |
| **Last updated** | YYYY-MM-DD |
| **Spec-family status** | `open` \| `complete` |

---

## 2. Child Table

One row per child spec:

| # | Spec Path | Depends on | Parallel-safe | Status |
|---|-----------|------------|----------------|--------|
| 1 | `<family>/<child-a>` | none | yes | pending |
| 2 | `<family>/<child-b>` | `<family>/<child-a>` | no | pending |

**Column definitions:**

- `#` — build order (1..n).
- `Spec Path` — must correspond to a real folder under `docs/specs/`.
- `Depends on` — spec path(s) this child requires to be `done` first, or `none`.
- `Parallel-safe` — `yes` if this child can run concurrently with siblings that don't depend on it (fleet eligibility); `no` if it shares files/domain with another child.
- `Status` — one of `pending` / `active` / `done` / `blocked`. Phase-level detail (task-by-task progress) lives in each child's own `tasks.md`/`execution.md`, never duplicated here.

---

## 3. Closed-Set Rule

The child table above is the **exhaustive** set of specs in this family. No AKILI command may
create a new child spec folder for this family without first adding a row here. Adding a row is a
HITL-approved manifest edit — never a silent side effect of `/akili-execute` or `/akili-test`.

---

## 4. Review Checklist

- [ ] Every row's `Spec Path` maps to an existing folder under `docs/specs/`.
- [ ] Dependency edges form a DAG (no cycles).
- [ ] `Parallel-safe: yes` rows genuinely touch disjoint files/domains — verified, not assumed.
- [ ] `Spec-family status` flips to `complete` only when every child row is `done`.
