export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function AssessmentIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
