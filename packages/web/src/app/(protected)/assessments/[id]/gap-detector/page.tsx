import GapDetectorClient from './gap-detector-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function GapDetectorPage() {
  return <GapDetectorClient />;
}
