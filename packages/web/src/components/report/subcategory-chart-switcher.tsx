'use client';

import type { SubcategoryScore, SubcategoryChartType } from '@alliance-risk/shared';
import { SubcategoryBarChart } from './subcategory-bar-chart';
import { SubcategoryRadarChart } from './subcategory-radar-chart';
import { SubcategoryDonutChart } from './subcategory-donut-chart';

interface SubcategoryChartSwitcherProps {
  subcategories: SubcategoryScore[];
  chartType: SubcategoryChartType;
}

export function SubcategoryChartSwitcher({ subcategories, chartType }: SubcategoryChartSwitcherProps) {
  if (subcategories.length === 0) return null;

  switch (chartType) {
    case 'radar':
      return <SubcategoryRadarChart subcategories={subcategories} />;
    case 'donut':
      return <SubcategoryDonutChart subcategories={subcategories} />;
    case 'bar':
    default:
      return <SubcategoryBarChart subcategories={subcategories} />;
  }
}
