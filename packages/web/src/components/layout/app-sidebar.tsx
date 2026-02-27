'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Shield,
  LogOut,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    label: 'Prompt Manager',
    href: '/admin/prompt-manager',
    icon: FileText,
    adminOnly: true,
  },
  {
    label: 'Admin',
    href: '/admin/users',
    icon: Shield,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{ '--sidebar-width': '256px' } as React.CSSProperties}
    >
      {/* ── Brand / Logo ─────────────────────────────────────────────────────── */}
      <SidebarHeader
        className="p-0 flex-shrink-0"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {isCollapsed ? (
          /* Collapsed: centred icon monogram */
          <div className="flex items-center justify-center h-14 w-full">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/15">
              <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
          </div>
        ) : (
          /* Expanded: full brand lockup flush to top */
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
            {/* Shield icon as logomark */}
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/15 shrink-0">
              <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            {/* Wordmark */}
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-[15px] tracking-tight">
                Alliance Risk
              </span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-white/50 mt-0.5">
                Intelligence
              </span>
            </div>
          </div>
        )}

        {/* Separator between brand and nav */}
        <div
          className="mx-3 mb-1"
          style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.10)' }}
        />
      </SidebarHeader>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <SidebarContent style={{ backgroundColor: 'var(--sidebar)' }}>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      className={cn(
                        'relative h-10 rounded-lg px-3 transition-colors',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-[#CCFBF1] hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <Link href={item.href}>
                        {/* Orange active indicator */}
                        {isActive && !isCollapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                            style={{ backgroundColor: '#F18E1C' }}
                          />
                        )}
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 text-sm font-medium">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: user profile ─────────────────────────────────────────────── */}
      <SidebarFooter
        className="px-3 pb-4"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {user && !isCollapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{ backgroundColor: 'rgba(17,94,89,0.5)' }}
              >
                <AvatarInitials
                  name={user.email ?? user.username ?? 'User'}
                  withRing
                  size="sm"
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.username ?? user.email}
                  </p>
                  <p className="text-xs text-[#CCFBF1] truncate">
                    {user.email}
                  </p>
                </div>
                <ChevronUp className="h-4 w-4 text-[#CCFBF1] shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {user && isCollapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 mx-auto">
                <AvatarInitials
                  name={user.email ?? user.username ?? 'User'}
                  withRing
                  size="sm"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56 mb-1">
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
