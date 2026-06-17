import { NextResponse } from 'next/server';
import { loadData, getItemByKey, itemsForModality, listModalities } from '@/lib/data';
import { getAdmin } from '@/lib/admin';
import { ensureHydrated } from '@/lib/hydrate';

export async function GET(req: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(req.url);
  const keys = searchParams.get('keys');
  const modality = searchParams.get('modality');

  if (keys) {
    const items = keys.split(',').map(getItemByKey).filter(Boolean);
    return NextResponse.json({ items });
  }
  if (modality) {
    return NextResponse.json({ items: itemsForModality(modality) });
  }
  // 전체 목록 — 관리자 카탈로그용 (편집 권한·모달리티 목록 동봉)
  const admin = await getAdmin();
  return NextResponse.json({
    items: loadData().testItems,
    modalities: listModalities(),
    isAdmin: !!admin,
  });
}
