import { NextResponse } from 'next/server';
import { suggestFromPlan, type SuggestInput } from '@/lib/suggest';

export async function POST(req: Request) {
  const body = (await req.json()) as SuggestInput;
  return NextResponse.json(suggestFromPlan(body));
}
