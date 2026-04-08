'use client';

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import type { SubcategoryScore } from '@alliance-risk/shared';

interface SubcategoryRadarChartProps {
  subcategories: SubcategoryScore[];
}

export function SubcategoryRadarChart({ subcategories }: SubcategoryRadarChartProps) {
  const data = subcategories.map((s) => ({
    name: s.name,
    score: s.score,
  }));

  return (
    <div className="w-full aspect-square max-w-[280px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
