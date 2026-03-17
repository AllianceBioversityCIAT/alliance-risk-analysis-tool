'use client';

import {
  DollarSign,
  CloudSun,
  Users,
  Factory,
  TrendingUp,
  Scale,
  Monitor,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CategoryConfig {
  label: string;
  icon: LucideIcon;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  FINANCIAL: { label: 'Financial', icon: DollarSign },
  CLIMATE_ENVIRONMENTAL: { label: 'Climate & Environmental', icon: CloudSun },
  BEHAVIORAL: { label: 'Behavioral', icon: Users },
  OPERATIONAL: { label: 'Operational', icon: Factory },
  MARKET: { label: 'Market', icon: TrendingUp },
  GOVERNANCE_LEGAL: { label: 'Governance & Legal', icon: Scale },
  TECHNOLOGY_DATA: { label: 'Technology & Data', icon: Monitor },
};

const DEFAULT_CONFIG: CategoryConfig = { label: '', icon: Shield };

export function getCategoryConfig(raw: string): CategoryConfig {
  const config = CATEGORY_CONFIG[raw];
  if (config) return config;
  return { ...DEFAULT_CONFIG, label: raw.replace(/_/g, ' ') };
}

export function getCategoryLabel(raw: string): string {
  return getCategoryConfig(raw).label;
}

export function getCategoryIcon(raw: string): LucideIcon {
  return getCategoryConfig(raw).icon;
}
