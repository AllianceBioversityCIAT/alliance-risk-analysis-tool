import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alliance Risk Analysis',
  description: 'Agricultural risk assessment platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
