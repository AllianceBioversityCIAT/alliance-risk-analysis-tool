import { Suspense } from 'react';
import { ChangePasswordPageClient } from './change-password-client';

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordPageClient />
    </Suspense>
  );
}
