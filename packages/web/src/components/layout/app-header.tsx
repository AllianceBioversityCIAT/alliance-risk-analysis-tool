'use client';

import { Bell, ChevronDown, Plus, Search } from 'lucide-react';
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

interface AppHeaderProps {
  title: string;
  onStartAssessment?: () => void;
  className?: string;
}

// MVP: Kenya only
const CONTEXT_OPTIONS = [{ label: 'Kenya', flag: '🇰🇪' }];

export function AppHeader({ title, onStartAssessment, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'h-16 flex items-center gap-4 px-6 bg-white border-b border-border shrink-0',
        className,
      )}
    >
      {/* Mobile sidebar trigger */}
      <SidebarTrigger className="md:hidden -ml-2" />

      {/* Left: Title + divider + context selector */}
      <div className="flex items-center gap-3 flex-1">
        <h1 className="text-xl font-bold text-[#1F2937] whitespace-nowrap">{title}</h1>
        <span className="w-px h-6 bg-border shrink-0" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 px-2 gap-1.5 text-sm font-semibold text-[#374151] hover:bg-muted"
            >
              <span className="text-base">🇰🇪</span>
              <span>Kenya</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {CONTEXT_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label}>
                <span className="mr-2 text-base">{opt.flag}</span>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: CTA + divider + search + notification */}
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

        {/* Search input */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search..."
            className="h-9 w-64 pl-8 bg-[#F9FAFB] border-border rounded-lg text-sm"
          />
        </div>

        {/* Notification bell */}
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
