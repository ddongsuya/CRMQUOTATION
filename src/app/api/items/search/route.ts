import { NextResponse } from 'next/server';
import { loadData } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';

/** Modality-specific masters that don't tag themselves in modalityPool. */
const MODALITY_SOURCE_PREFIX: Record<string, string> = {
  '화장품': '화장품_',
  '복합제': '복합제_',
  '스크리닝': '스크리닝_',
  '심혈관계스크리닝': '심혈관계스크리닝_',
  '백신': '백신_',
  '세포치료제': 'SEND_CTD',
  '의료기기(ISO10993)': '의료기기_',
  '건강기능식품': '건기식_',
};

export async function POST(req: Request) {
  const body = (await req.json()) as {
    modality?: string;
    query?: string;
    priceStandard?: 'MFDS' | 'OECD';
    excipientCount?: number;
    limit?: number;
  };
  await ensureHydrated();
  const { testItems } = loadData();
  const q = (body.query ?? '').trim().toLowerCase();
  const limit = Math.min(body.limit ?? 50, 200);
  const std = body.priceStandard ?? 'MFDS';
  const exc = body.excipientCount;

  const sourcePrefix = body.modality ? MODALITY_SOURCE_PREFIX[body.modality] : undefined;

  const filtered = testItems.filter(it => {
    if (sourcePrefix) {
      // For modality-specific masters, restrict by source
      if (!it.key.startsWith(sourcePrefix)) {
        // For 신약군 modalities (no entry in MODALITY_SOURCE_PREFIX), use modalityPool
        return false;
      }
    } else if (body.modality) {
      if (!it.modalityPool.includes(body.modality)) return false;
    }
    if (q) {
      const hay = (it.testName + ' ' + (it.adminRoute ?? '') + ' ' + (it.category ?? '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Resolve unit price respecting tiers
  const resolvePrice = (it: typeof testItems[number]) => {
    const tiers = it.priceTiers;
    if (tiers && typeof exc === 'number') {
      const want = exc <= 2 ? '2' : exc === 3 ? '3' : '4';
      const v = tiers[want] ?? tiers['3'] ?? tiers['2'] ?? tiers['4'];
      if (v != null && Number.isFinite(v)) return Number(v);
    }
    const v = std === 'MFDS' ? it.priceMfds : it.priceOecd;
    return v != null && Number.isFinite(v) ? Number(v) : 0;
  };

  const hits = filtered.slice(0, limit).map(it => ({
    key: it.key,
    testName: it.testName,
    adminRoute: it.adminRoute,
    category: it.category,
    studyWeeks: it.studyWeeks,
    unitPrice: resolvePrice(it),
  }));

  return NextResponse.json({ hits, total: filtered.length });
}
