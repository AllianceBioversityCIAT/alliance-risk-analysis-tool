'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/providers/auth-provider';

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSuccess = () => {
    const returnTo = searchParams.get('returnTo') ?? '/dashboard';
    router.replace(returnTo);
  };

  const handlePasswordChangeRequired = (session: string, username: string) => {
    router.push(
      `/change-password?session=${encodeURIComponent(session)}&username=${encodeURIComponent(username)}`,
    );
  };

  if (isLoading) {
    return null; // Avoid flash before auth check completes
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ backgroundColor: '#E6F5F5' }}>
            {/* Africa map icon */}
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" aria-hidden="true">
              <path
                d="M16 3C9.373 3 4 8.373 4 15c0 4.5 2.3 8.5 5.8 10.9L12 29l1-2 2 1 1-3 3 1 2-2 1 3 2-1.5V24l2-1.5V19l-2-1v-3l1.5-2L24 11l-1-2-2 1-1-2-1 1-1-2-1 1-1-2h-2l-1 2-1-1v3l-2 1v2l1 1v2l-2 1v2l1 2v2l-1 1"
                stroke="#008F8F"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Risk Intelligence Portal
          </h1>
          <p className="text-gray-500 text-base mt-1">Sign in to access climate risk analytics</p>
        </div>

        {/* Login card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0px_10px_36px_rgba(0,0,0,0.04)]">
          <LoginForm
            onSuccess={handleSuccess}
            onPasswordChangeRequired={handlePasswordChangeRequired}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Alliance of Bioversity International and CIAT
        </p>
      </div>
    </main>
  );
}
