import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Raja Rani Admin',
  description: 'Raja Rani platform administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-gray-900 antialiased">{children}</body>
    </html>
  );
}
