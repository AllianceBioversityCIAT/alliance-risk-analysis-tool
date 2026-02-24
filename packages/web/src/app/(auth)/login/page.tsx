import { Suspense } from 'react';
import { LoginPageClient } from './login-client';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}
