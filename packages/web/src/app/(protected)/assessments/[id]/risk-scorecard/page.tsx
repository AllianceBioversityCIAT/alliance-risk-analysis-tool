import RiskScorecardClient from './risk-scorecard-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function RiskScorecardPage() {
  return <RiskScorecardClient />;
}
