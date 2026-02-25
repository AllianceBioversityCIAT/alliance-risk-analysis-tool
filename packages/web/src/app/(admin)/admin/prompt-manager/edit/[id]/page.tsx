import EditPromptClient from './edit-prompt-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function EditPromptPage() {
  return <EditPromptClient />;
}
