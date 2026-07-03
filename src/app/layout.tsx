import type { Metadata } from 'next';
import AppChrome from '@/components/AppChrome';
import Providers from '@/components/Providers';
import Toaster from '@/components/Toaster';
import { loadData } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';
import './globals.css';

export const metadata: Metadata = {
  title: '코아스템켐온 견적 시스템',
  description: '비임상시험 견적서 작성 — 개발 중',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureHydrated();
  const { testItems, presets, blocks } = loadData();
  const modalities = new Set<string>();
  for (const it of testItems) for (const m of it.modalityPool) modalities.add(m);
  const stats = { items: testItems.length, presets: presets.length, blocks: blocks.length, modalities: modalities.size };

  return (
    <html lang="ko">
      <body className="antialiased bg-slate-50 text-ink-body">
        <Providers>
          <AppChrome stats={stats}>{children}</AppChrome>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
