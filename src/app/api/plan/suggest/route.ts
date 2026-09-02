import { NextResponse } from 'next/server';
import { suggestFromPlan, type SuggestInput } from '@/lib/suggest';
import { ensureHydrated } from '@/lib/hydrate';

import { withErrorHandling } from '@/lib/api-handler';
async function _POST(req: Request) {
  await ensureHydrated();
  const body = (await req.json()) as SuggestInput;
  return NextResponse.json(suggestFromPlan(body));
}

export const POST = withErrorHandling(_POST);
