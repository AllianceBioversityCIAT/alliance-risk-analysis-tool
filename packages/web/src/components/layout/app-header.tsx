'use client';

import { Bell, ChevronDown, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { SUPPORTED_COUNTRIES } from '@alliance-risk/shared';
import {
  ALL_COUNTRIES_FILTER,
  type CountryFilterValue,
} from '@/providers/country-filter-provider';

const countryOptions: { value: CountryFilterValue; label: string; flag: string }[] = [
  { value: ALL_COUNTRIES_FILTER, label: 'All countries', flag: '🌍' },
  ...SUPPORTED_COUNTRIES.map((c) => ({ value: c.label, label: c.label, flag: c.flag })),
];

interface AppHeaderProps {
  title: string;
  onStartAssessment?: () => void;
  className?: string;
  searchQuery?: string;
  onSearch?: (value: string) => void;
  activeCountry: CountryFilterValue;
  onCountryChange: (country: CountryFilterValue) => void;
}

export function AppHeader({
  title,
  onStartAssessment,
  className,
  searchQuery = '',
  onSearch,
  activeCountry,
  onCountryChange,
}: AppHeaderProps) {
  const hasSearch = onSearch !== undefined;
  const activeOption = countryOptions.find((opt) => opt.value === activeCountry);

  return (
    <header
      className={cn(
        'h-16 flex items-center gap-4 px-6 bg-white border-b border-border shrink-0',
        className,
      )}
    >
      <SidebarTrigger className="-ml-2" />

      <div className="flex items-center gap-3 flex-1">
        <h1 className="text-xl font-bold text-[#1F2937] whitespace-nowrap">{title}</h1>
        <span className="w-px h-6 bg-border shrink-0" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 px-2 gap-1.5 text-sm font-semibold text-[#374151] hover:bg-muted"
              aria-label="Select country context"
            >
              <span className="text-base">{activeOption?.flag}</span>
              <span>{activeOption?.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {countryOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onCountryChange(opt.value)}
                className={cn(activeCountry === opt.value && 'bg-muted font-medium')}
              >
                <span className="mr-2 text-base">{opt.flag}</span>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        {onStartAssessment && (
          <Button
            onClick={onStartAssessment}
            className="h-9 gap-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white shadow-[0_1px_2px_#bbf7d0] rounded-lg text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Start New Assessment
          </Button>
        )}

        <span className="w-px h-6 bg-border shrink-0" />

        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={hasSearch ? (e) => onSearch(e.target.value) : undefined}
            readOnly={!hasSearch}
            aria-label="Search assessments"
            className={cn(
              'h-9 pl-8 bg-[#F9FAFB] border-border rounded-lg text-sm transition-all',
              searchQuery ? 'w-72 pr-8' : 'w-64',
              !hasSearch && 'cursor-default',
            )}
          />
          {hasSearch && searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4 text-[#374151]" />
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-warning"
            aria-label="Unread notifications"
          />
        </Button>
      </div>
    </header>
  );
}
