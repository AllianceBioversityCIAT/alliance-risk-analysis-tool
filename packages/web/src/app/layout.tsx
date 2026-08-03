import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sileo';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { CountryFilterProvider } from '@/providers/country-filter-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Alliance Risk Analysis',
  description: 'Agricultural risk assessment platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <CountryFilterProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </CountryFilterProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
