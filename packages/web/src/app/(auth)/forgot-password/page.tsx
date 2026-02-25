'use client';

import { useRouter } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { sileo } from 'sileo';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleSuccess = () => {
    sileo.success({ title: 'Password reset successfully', description: 'Please sign in with your new password.' });
    router.push('/login');
  };

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
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reset your password</h1>
          <p className="text-gray-500 text-base mt-1">Risk Intelligence Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0px_10px_36px_rgba(0,0,0,0.04)]">
          <ForgotPasswordForm onSuccess={handleSuccess} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Alliance of Bioversity International and CIAT
        </p>
      </div>
    </main>
  );
}
