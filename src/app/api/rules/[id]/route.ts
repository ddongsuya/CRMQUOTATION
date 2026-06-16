/**
 * GET /api/rules/:id — 특정 룰 1개 조회 (예: PF-001, AD-006)
 */
import { NextResponse } from 'next/server';
import { findRuleById } from '@/lib/rules-catalog';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const rule = findRuleById(params.id);
  if (!rule) {
    return NextResponse.json({ error: `Rule not found: ${params.id}` }, { status: 404 });
  }
  return NextResponse.json(rule);
}
