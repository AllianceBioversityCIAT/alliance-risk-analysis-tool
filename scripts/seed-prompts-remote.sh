#!/usr/bin/env bash
# Seed/update risk_analysis and report_generation prompts on remote RDS via Worker Lambda.
set -euo pipefail

FUNCTION_NAME="alliance-risk-worker"
SECRET_ID="alliance-risk/worker-admin-token"

echo "▸ Fetching worker admin token..."
TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --query 'SecretString' --output text | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

if [[ -z "$TOKEN" ]]; then
  echo "✗ Failed to fetch admin token"
  exit 1
fi
echo "✓ Token retrieved"

invoke_sql() {
  local sql="$1"
  local desc="$2"
  echo "▸ Executing: $desc"

  export SEED_TOKEN="$TOKEN"
  export SEED_SQL="$sql"
  PAYLOAD=$(python3 -c "
import json, os
token = os.environ['SEED_TOKEN']
sql = os.environ['SEED_SQL']
print(json.dumps({'action': 'run-sql', 'authToken': token, 'sql': sql}))
")

  aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --payload "$PAYLOAD" \
    --cli-binary-format raw-in-base64-out \
    /tmp/seed-result.json > /dev/null 2>&1

  RESPONSE=$(cat /tmp/seed-result.json)
  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [[ "$SUCCESS" = "True" ]]; then
    echo "  ✓ $desc — success"
  else
    echo "  ✗ $desc — failed"
    echo "  $(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown')[:200])" 2>/dev/null)" >&2
    return 1
  fi
}

echo "▸ Generating and sending prompt SQL..."

# Use Python for proper escaping — E'' string syntax with escaped newlines/quotes
python3 << 'PYEOF' > /tmp/ra_sql.txt
# Risk Analysis system prompt
ra_sys = r"""You are an expert agricultural risk analyst specializing in smallholder farming enterprises, agribusinesses, and agricultural value chains in developing countries. Your task is to perform a comprehensive risk assessment across 7 risk categories, each with 5 subcategories.

## Risk Categories and Subcategories

1. **FINANCIAL** - Revenue Stability, Cost Structure, Debt Levels, Cash Flow, Financial Controls
2. **CLIMATE_ENVIRONMENTAL** - Weather Exposure, Climate Adaptation, Resource Sustainability, Environmental Compliance, Disaster Preparedness
3. **BEHAVIORAL** - Management Capability, Decision-Making Patterns, Risk Awareness, Change Readiness, Stakeholder Relationships
4. **OPERATIONAL** - Supply Chain, Production Capacity, Process Maturity, Quality Controls, Workforce Capability
5. **MARKET** - Market Access, Price Volatility, Competition, Demand Trends, Market Diversification
6. **GOVERNANCE_LEGAL** - Legal Compliance, Governance Structure, Regulatory Risk, Contractual Obligations, Transparency
7. **TECHNOLOGY_DATA** - Technology Adoption, Data Management, Cybersecurity, Digital Infrastructure, Innovation Capacity

## Scoring: 0-30 LOW, 31-60 MODERATE, 61-80 HIGH, 81-100 CRITICAL

Base scores on EVIDENCE from documents. Missing information = higher risk (60-80). Be specific in evidence citations. Provide actionable recommendations. Consider the agricultural context.

## Output: Return ONLY valid JSON:
{"categories": [{"category": "FINANCIAL", "score": 45, "level": "MODERATE", "narrative": "...", "evidence": "...", "subcategories": [{"name": "Revenue Stability", "indicator": "...", "score": 40, "level": "MODERATE", "evidence": "...", "mitigation": "..."}], "recommendations": [{"text": "...", "priority": "HIGH"}]}]}

Return exactly 7 categories with 5 subcategories each. Priorities: LOW, MEDIUM, HIGH. 1-3 recommendations per category."""

ra_user = r"""Perform a comprehensive risk analysis on the following agricultural business.

## Business Data
{{business_data}}

## Document Content
{{document_content}}

Score all 7 categories with 5 subcategories each. Return JSON."""

# Escape for PostgreSQL E'' string
def pg_escape(s):
    return s.replace("\\", "\\\\").replace("'", "''").replace("\n", "\\n").replace("\t", "\\t")

sql = f"UPDATE prompts SET system_prompt = E'{pg_escape(ra_sys)}', user_prompt_template = E'{pg_escape(ra_user)}', is_active = true, updated_at = NOW() WHERE section = 'risk_analysis' AND name = 'Risk Analysis - Default'"
print(sql)
PYEOF

RA_SQL=$(cat /tmp/ra_sql.txt)
invoke_sql "$RA_SQL" "Update risk_analysis prompt"

python3 << 'PYEOF' > /tmp/rg_sql.txt
rg_sys = r"""You are an expert report writer for agricultural risk assessments. Synthesize risk analysis results into a structured report.

Generate: 1) Executive Summary (3-5 sentences), 2) Strengths (3-6 items with evidence), 3) Weaknesses (3-6 items with evidence), 4) Key Findings (4-8 items, prioritized).

Write for non-technical decision-makers. Be specific with scores and evidence. Prioritize by severity.

## Output: Return ONLY valid JSON:
{"executiveSummary": "...", "strengths": ["..."], "weaknesses": ["..."], "keyFindings": ["..."]}"""

rg_user = r"""Generate a risk assessment report from these results:

## Risk Analysis Results
{{risk_results}}

Produce executive summary, strengths, weaknesses, and key findings. Return JSON."""

def pg_escape(s):
    return s.replace("\\", "\\\\").replace("'", "''").replace("\n", "\\n").replace("\t", "\\t")

sql = f"UPDATE prompts SET system_prompt = E'{pg_escape(rg_sys)}', user_prompt_template = E'{pg_escape(rg_user)}', is_active = true, updated_at = NOW() WHERE section = 'report_generation' AND name = 'Report Generator - Default'"
print(sql)
PYEOF

RG_SQL=$(cat /tmp/rg_sql.txt)
invoke_sql "$RG_SQL" "Update report_generation prompt"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Prompt seeding complete"
echo "═══════════════════════════════════════════════════"
