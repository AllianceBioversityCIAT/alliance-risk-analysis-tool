'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SubcategoryScore } from '@alliance-risk/shared';
import { RiskLevel } from '@alliance-risk/shared';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: '#16A34A',
  [RiskLevel.MODERATE]: '#EAB308',
  [RiskLevel.HIGH]: '#EA580C',
  [RiskLevel.CRITICAL]: '#DC2626',
};

interface SubcategoryDonutChartProps {
  subcategories: SubcategoryScore[];
}

export function SubcategoryDonutChart({ subcategories }: SubcategoryDonutChartProps) {
  const data = subcategories.map((s) => ({
    name: s.name,
    value: s.score,
    level: s.level,
  }));

  return (
    <div className="w-full aspect-square max-w-[280px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={LEVEL_COLORS[entry.level]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value}/100`, name]}
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
