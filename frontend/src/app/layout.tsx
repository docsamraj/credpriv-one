import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CredPriv One — Hospital Staff Credentialing Platform',
  description: 'Hospital-grade credentialing, privileging, and committee governance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
