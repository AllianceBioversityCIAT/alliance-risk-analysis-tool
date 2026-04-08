'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { FinancialRevenueEntry } from '@alliance-risk/shared';

interface FinancialRevenueChartProps {
  data: FinancialRevenueEntry[];
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toString();
}

export function FinancialRevenueChart({ data }: FinancialRevenueChartProps) {
  if (data.length === 0) return null;

  const currency = data[0]?.currency ?? 'USD';
  const chartData = data.map((d) => ({
    year: d.year.toString(),
    amount: d.amount,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Revenue Trend</h3>
      <p className="text-xs text-muted-foreground mb-4">Annual revenue in {currency}</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v) => formatAmount(Number(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [`${currency} ${formatAmount(Number(value))}`, 'Revenue']}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
