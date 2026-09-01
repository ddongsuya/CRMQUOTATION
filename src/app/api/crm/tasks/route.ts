/**
 * GET  /api/crm/tasks?companyId=&dealId=&done=  — 내 할 일 목록 (미완료 우선, 기한 오름차순)
 * POST /api/crm/tasks                            — 할 일 생성 { title, memo?, dueAt?, companyId?, contactId?, dealId? }
 *
 * 할 일(Task) = 일정(약속)과 구분되는 액션 아이템 — 완료 체크가 본질, 기한은 선택.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const owners = await visibleOwnerIds();
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const dealId = searchParams.get('dealId');
  const done = searchParams.get('done');   // '0' | '1' | null(전체)
  const tasks = await prisma.task.findMany({
    where: {
      ownerId: { in: owners },
      ...(companyId ? { companyId: Number(companyId) } : {}),
      ...(dealId ? { dealId: Number(dealId) } : {}),
      ...(done === '0' ? { done: false } : done === '1' ? { done: true } : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: [{ done: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 300,
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const ownerId = await currentUserId();
  const b = await req.json().catch(() => null) as { title?: string; memo?: string; dueAt?: string | null; companyId?: number; contactId?: number; dealId?: number } | null;
  const title = String(b?.title ?? '').trim();
  if (!title) return NextResponse.json({ error: '할 일 내용을 입력하세요.' }, { status: 400 });

  // 의뢰자/안건이 오면 회사도 자동 연결 (기업별 to-do 집계 근거)
  let companyId = b?.companyId ? Number(b.companyId) : null;
  if (!companyId && b?.contactId) {
    const c = await prisma.contact.findUnique({ where: { id: Number(b.contactId) }, select: { companyId: true } });
    companyId = c?.companyId ?? null;
  }
  if (!companyId && b?.dealId) {
    const d = await prisma.deal.findUnique({ where: { id: Number(b.dealId) }, select: { contact: { select: { companyId: true } } } });
    companyId = d?.contact.companyId ?? null;
  }

  const task = await prisma.task.create({
    data: {
      ownerId, title,
      memo: b?.memo?.trim() || null,
      dueAt: b?.dueAt ? new Date(b.dueAt) : null,
      companyId, contactId: b?.contactId ? Number(b.contactId) : null, dealId: b?.dealId ? Number(b.dealId) : null,
    },
  });
  return NextResponse.json({ task });
}
