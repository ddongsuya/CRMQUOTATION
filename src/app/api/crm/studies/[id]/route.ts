/**
 * PATCH  /api/crm/studies/[id]  — 시험 정보·날짜 수정 (보고서안 발행일 등)
 * DELETE /api/crm/studies/[id]
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { studyPatchSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const s = await prisma.study.findUnique({ where: { id }, include: { deal: true } });
  if (!s || !owners.includes(s.deal.ownerId)) return null;
  return s;
}

async function _PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = await parseBody(req, studyPatchSchema);
  if (!parsed.ok) return parsed.res;
  // 텍스트: trim·''→null, 날짜: ''·null→null(해제), 키 없음 → undefined(Prisma 가 무시)
  const study = await prisma.study.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ study });
}

async function _DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id 오류' }, { status: 400 });
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.study.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
