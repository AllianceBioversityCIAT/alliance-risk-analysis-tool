'use client';

import { Search } from 'lucide-react';
import { AgentSection, AGENT_SECTION_LABELS } from '@alliance-risk/shared';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PromptFilters } from '@/hooks/use-prompts';

interface PromptFiltersProps {
  filters: PromptFilters;
  onFiltersChange: (filters: PromptFilters) => void;
}

export function PromptFiltersBar({ filters, onFiltersChange }: PromptFiltersProps) {
  const sections = Object.values(AgentSection);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts…"
          value={filters.search ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          className="pl-9"
          aria-label="Search prompts"
        />
      </div>

      <Select
        value={filters.section ?? 'all'}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            section: v === 'all' ? undefined : (v as AgentSection),
          })
        }
      >
        <SelectTrigger className="w-48" aria-label="Filter by section">
          <SelectValue placeholder="All Sections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sections</SelectItem>
          {sections.map((s) => (
            <SelectItem key={s} value={s}>
              {AGENT_SECTION_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.isActive === undefined ? 'all' : filters.isActive ? 'active' : 'inactive'}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            isActive: v === 'all' ? undefined : v === 'active',
          })
        }
      >
        <SelectTrigger className="w-36" aria-label="Filter by status">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
