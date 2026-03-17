# Key Recommendations — Grouped & Filterable

**Date:** 2026-03-16
**Module:** Risk Scorecard
**Status:** Approved

## Problem

The Key Recommendations section displays all recommendations (up to 28+) as a flat, priority-sorted list. Users cannot tell which risk category a recommendation belongs to, making it hard to scan by domain or assign to the right team. With many recommendations, the list becomes overwhelming.

## Solution

Replace the flat list with a **priority filter bar** + **category-grouped sections**, each with a contextual header showing the category's risk score.

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Key Recommendations (28)                            │
│                                                     │
│ [All] [High (16)] [Medium (8)] [Low (4)]            │
│                                                     │
│ ── 🔴 Market Risk (4) — Score: 65 | High Risk ──   │
│ │ Recommendation text...                [High] ✏️  │
│ │ Recommendation text...              [Medium] ✏️  │
│ │ ...                                               │
│                                                     │
│ ── 🟠 Financial Risk (5) — Score: 71 | High Risk ──│
│ │ Recommendation text...                [High] ✏️  │
│ │ ...                                               │
│                                                     │
│ (... more categories, hidden if 0 matches ...)      │
└─────────────────────────────────────────────────────┘
```

## Filter Bar Behavior

- Pills/chips styled consistently with existing priority badges (orange=High, yellow=Medium, green=Low, neutral=All)
- "All" selected by default, showing all recommendations
- Each pill shows count: `High (16)`, `Medium (8)`, `Low (4)`
- Total count in header updates to reflect active filter
- Categories with 0 matches for the active filter are hidden
- Within each category group, recommendations sorted by priority (High → Medium → Low)

## Category Group Header

- Reuses the same category icon from the risk score cards
- Format: `{icon} {Category Label} ({count}) — Score: {score} | {riskLevel}`
- Risk level uses same color badge as score cards
- Lightweight divider style — labeled separator with subtle background, not a card

## Data Flow

- Currently `allRecommendations = scores.flatMap(s => s.recommendations)` loses category context
- Change: enrich each recommendation with parent category, score, and level before flattening
- No API changes needed — `RiskScoreResponse` already nests recommendations inside each category
- All grouping/filtering is client-side using `useMemo`

## Component Changes

| File | Change |
|------|--------|
| `risk-scorecard-client.tsx` | Add filter state, enrich recommendations with category info, group by category, render new layout |
| New: `recommendation-filter-bar.tsx` | Filter pills component |
| New: `recommendation-category-group.tsx` | Category header + list of RecommendationRow |
| `recommendation-row.tsx` | No changes needed |
| Types (local to web) | `EnrichedRecommendation` extending `RecommendationResponse` with `category`, `categoryLabel`, `score`, `level` |

## Edge Cases

- All filtered out → "No {priority} priority recommendations" empty state
- Category has 0 recommendations → skip entirely
- Single recommendation in category → still render group header
