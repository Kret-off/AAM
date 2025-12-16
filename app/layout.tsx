import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/providers/toast-provider';

export const metadata: Metadata = {
  title: 'Assist after meeting (AAM)',
  description: 'Internal web app for processing video meetings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-gray-50">
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}

