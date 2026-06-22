/**
 * PATCH  /api/crm/studies/[id]  — 시험 정보·날짜 수정 (보고서안 발행일 등)
 * DELETE /api/crm/studies/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const s = await prisma.study.findUnique({ where: { id }, include: { deal: true } });
  if (!s || !owners.includes(s.deal.ownerId)) return null;
  return s;
}

const date = (v: unknown) => (v ? new Date(String(v)) : null);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['itemName', 'studyNumber', 'director'] as const) {
    if (k in body) data[k] = String(body[k] ?? '').trim() || null;
  }
  for (const k of ['requestSentAt', 'intakeCompletedAt', 'reportDraftDueAt', 'reportDraftIssuedAt', 'invoiceRequestedAt', 'invoiceIssuedAt'] as const) {
    if (k in body) data[k] = date(body[k]);
  }
  const study = await prisma.study.update({ where: { id }, data });
  return NextResponse.json({ study });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.study.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
