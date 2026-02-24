'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Shield,
  LogOut,
  ChevronUp,
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

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <Sidebar
      className="border-r-0"
      style={{ '--sidebar-width': '256px' } as React.CSSProperties}
    >
      {/* Logo area */}
      <SidebarHeader
        className="h-16 flex items-center px-6"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        <span className="text-white font-bold text-lg tracking-tight">
          Alliance Risk
        </span>
      </SidebarHeader>

      {/* Navigation */}
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
                      className={cn(
                        'relative h-10 rounded-lg px-3 transition-colors',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-[#CCFBF1] hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <Link href={item.href}>
                        {/* Orange left indicator for active item */}
                        {isActive && (
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

      {/* Bottom: User profile */}
      <SidebarFooter
        className="px-3 pb-4"
        style={{ backgroundColor: 'var(--sidebar)' }}
      >
        {/* User profile card */}
        {user && (
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
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-56 mb-1"
            >
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
