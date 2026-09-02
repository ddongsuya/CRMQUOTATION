import { NextResponse } from 'next/server';
import { presetsForModality } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';

import { withErrorHandling } from '@/lib/api-handler';
async function _GET(req: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(req.url);
  const modality = searchParams.get('modality');
  if (!modality) return NextResponse.json({ presets: [] });
  return NextResponse.json({ presets: presetsForModality(modality) });
}

export const GET = withErrorHandling(_GET);
