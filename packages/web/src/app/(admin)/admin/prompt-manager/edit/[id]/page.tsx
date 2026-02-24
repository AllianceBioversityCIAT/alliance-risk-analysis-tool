import EditPromptClient from './edit-prompt-client';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [];
}

// This is a Server Component wrapper so `generateStaticParams` is recognized
// by `output: 'export'`. All client-side logic lives in EditPromptClient.
export default function EditPromptPage() {
  return <EditPromptClient />;
}
