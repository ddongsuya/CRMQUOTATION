import { NextResponse } from 'next/server';
import { presetsForModality } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';

export async function GET(req: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(req.url);
  const modality = searchParams.get('modality');
  if (!modality) return NextResponse.json({ presets: [] });
  return NextResponse.json({ presets: presetsForModality(modality) });
}
