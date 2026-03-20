'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { FinancialCostEntry, FinancialMargins } from '@alliance-risk/shared';

interface FinancialCostChartProps {
  data: FinancialCostEntry[];
  margins?: FinancialMargins;
}

const COLORS = [
  '#0F766E', '#14B8A6', '#2DD4BF', '#5EEAD4',
  '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
];

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toString();
}

export function FinancialCostChart({ data, margins }: FinancialCostChartProps) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.category,
    value: d.amount,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Cost Breakdown</h3>
      <p className="text-xs text-muted-foreground mb-4">Distribution by category</p>

      <div className="flex flex-col lg:flex-row items-start gap-6">
        <div className="h-[220px] w-full max-w-[280px] mx-auto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [formatAmount(Number(value)), '']}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {margins && (margins.gross !== null || margins.operating !== null) && (
          <div className="flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margins</p>
            {margins.gross !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-foreground">Gross Margin</span>
                <span className="text-sm font-bold text-foreground">{(margins.gross * 100).toFixed(1)}%</span>
              </div>
            )}
            {margins.operating !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-foreground">Operating Margin</span>
                <span className="text-sm font-bold text-foreground">{(margins.operating * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
