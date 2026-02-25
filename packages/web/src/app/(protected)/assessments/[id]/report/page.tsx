import ReportClient from './report-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function ReportPage() {
  return <ReportClient />;
}
