'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type { SubcategoryScore } from '@alliance-risk/shared';
import { RiskLevel } from '@alliance-risk/shared';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '#16A34A',
  [RiskLevel.MODERATE]: '#EAB308',
  [RiskLevel.HIGH]: '#EA580C',
  [RiskLevel.CRITICAL]: '#DC2626',
};

interface SubcategoryBarChartProps {
  subcategories: SubcategoryScore[];
}

export function SubcategoryBarChart({ subcategories }: SubcategoryBarChartProps) {
  const data = subcategories.map((s) => ({
    name: s.name,
    score: s.score,
    level: s.level,
  }));

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((entry, index) => (
              <Cell key={index} fill={LEVEL_COLORS[entry.level]} />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              style={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
