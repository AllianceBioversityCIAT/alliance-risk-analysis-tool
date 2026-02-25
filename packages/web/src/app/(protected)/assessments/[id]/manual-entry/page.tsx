import ManualEntryClient from './manual-entry-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function ManualEntryPage() {
  return <ManualEntryClient />;
}
