import type { Metadata } from 'next';
import AppChrome from '@/components/AppChrome';
import Providers from '@/components/Providers';
import Toaster from '@/components/Toaster';
import './globals.css';

export const metadata: Metadata = {
  title: '코아스템켐온 견적 시스템',
  description: '비임상시험 견적서 작성 — 개발 중',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased bg-slate-50/60 text-ink">
        <Providers>
          <AppChrome>{children}</AppChrome>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
