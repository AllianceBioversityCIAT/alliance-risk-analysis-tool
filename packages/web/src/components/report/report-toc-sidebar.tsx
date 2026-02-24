'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TocItem {
  id: string;
  label: string;
  subItems?: { id: string; label: string }[];
}

interface ReportTocSidebarProps {
  items: TocItem[];
}

export function ReportTocSidebar({ items }: ReportTocSidebarProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const allIds = items.flatMap((item) => [
      item.id,
      ...(item.subItems ?? []).map((s) => s.id),
    ]);

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry (topmost visible section)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-64px 0px -60% 0px', threshold: 0 },
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [items]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <nav className="w-64 shrink-0 border-l border-border bg-card sticky top-0 h-screen overflow-y-auto py-6 px-4 hidden lg:block">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2">
        Contents
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  'w-full text-left text-sm px-2 py-1.5 rounded transition-colors',
                  isActive
                    ? 'text-primary font-semibold border-l-2 border-primary pl-[6px]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>

              {/* Sub-items */}
              {item.subItems && item.subItems.length > 0 && (
                <ul className="ml-4 mt-0.5 space-y-0.5">
                  {item.subItems.map((sub) => {
                    const isSubActive = activeId === sub.id;
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => scrollToSection(sub.id)}
                          className={cn(
                            'w-full text-left text-xs px-2 py-1 rounded transition-colors',
                            isSubActive
                              ? 'text-primary font-semibold border-l-2 border-primary pl-[6px]'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {sub.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
