'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { sileo } from 'sileo';

export function ChangePasswordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const session = searchParams.get('session');
  const username = searchParams.get('username');

  // Redirect to login if session or username is missing
  useEffect(() => {
    if (!session || !username) {
      router.replace('/login');
    }
  }, [session, username, router]);

  const handleSuccess = () => {
    sileo.success({ title: 'Password set successfully', description: 'Welcome!' });
    router.replace('/dashboard');
  };

  // Don't render until we confirm required params are present
  if (!session || !username) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: '#E6F5F5' }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-7 h-7"
              stroke="#008F8F"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Set new password</h1>
          <p className="text-gray-500 text-base mt-1">
            You&apos;re required to set a new password to continue
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0px_10px_36px_rgba(0,0,0,0.04)]">
          <ChangePasswordForm
            username={username}
            session={session}
            onSuccess={handleSuccess}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Alliance of Bioversity International and CIAT
        </p>
      </div>
    </main>
  );
}
