'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-secondary">
      {/* Card */}
      <div className="w-full max-w-[480px] bg-card rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] px-10 py-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <svg width="130" height="49" viewBox="0 0 130 49" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" aria-label="Alliance Risk Logo">
            <path d="M0 0H130V49H0V0Z" fill="url(#pattern0_448_4)"/>
            <defs>
              <pattern id="pattern0_448_4" patternContentUnits="objectBoundingBox" width="1" height="1">
                <use xlinkHref="#image0_448_4" transform="matrix(0.000801282 0 0 0.00212585 0 -0.0335884)"/>
              </pattern>
              <image id="image0_448_4" width="1248" height="502" preserveAspectRatio="none" xlinkHref="data:image/png;base64,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"/>
            </defs>
          </svg>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Risk Intelligence Portal
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Sign in to access climate risk analytics
          </p>
        </div>

        {/* Form */}
        <LoginForm
          onSuccess={handleSuccess}
          onPasswordChangeRequired={handlePasswordChangeRequired}
        />
      </div>

      {/* Footer links */}
      <div className="flex items-center gap-4 mt-8 text-sm text-muted-foreground">
        <Link href="#" className="hover:text-foreground transition-colors">
          Need Help?
        </Link>
        <span className="text-border">|</span>
        <Link href="#" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
      </div>

      {/* Tagline */}
      <p className="mt-5 text-[11px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
        Innovating for a Food-Secure Future
      </p>
    </main>
  );
}
