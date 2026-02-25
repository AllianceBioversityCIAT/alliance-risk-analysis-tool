import InterviewClient from './interview-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function InterviewPage() {
  return <InterviewClient />;
}
