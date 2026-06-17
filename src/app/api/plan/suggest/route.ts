import { NextResponse } from 'next/server';
import { suggestFromPlan, type SuggestInput } from '@/lib/suggest';
import { ensureHydrated } from '@/lib/hydrate';

export async function POST(req: Request) {
  await ensureHydrated();
  const body = (await req.json()) as SuggestInput;
  return NextResponse.json(suggestFromPlan(body));
}
