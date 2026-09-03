/**
 * GET  /api/crm/tasks?companyId=&dealId=&done=  — 내 할 일 목록 (미완료 우선, 기한 오름차순)
 * POST /api/crm/tasks                            — 할 일 생성 { title, memo?, dueAt?, companyId?, contactId?, dealId? }
 *
 * 할 일(Task) = 일정(약속)과 구분되는 액션 아이템 — 완료 체크가 본질, 기한은 선택.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { taskCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _GET(req: Request) {
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

async function _POST(req: Request) {
  const ownerId = await currentUserId();
  const parsed = await parseBody(req, taskCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;
  const linkErr = await checkLinkOwnership(b);
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });

  // 의뢰자/안건이 오면 회사도 자동 연결 (기업별 to-do 집계 근거)
  let companyId = b.companyId;
  if (!companyId && b.contactId) {
    const c = await prisma.contact.findUnique({ where: { id: b.contactId }, select: { companyId: true } });
    companyId = c?.companyId ?? null;
  }
  if (!companyId && b.dealId) {
    const d = await prisma.deal.findUnique({ where: { id: b.dealId }, select: { contact: { select: { companyId: true } } } });
    companyId = d?.contact.companyId ?? null;
  }

  const task = await prisma.task.create({
    data: {
      ownerId, title: b.title,
      memo: b.memo,
      dueAt: b.dueAt,
      companyId, contactId: b.contactId, dealId: b.dealId,
    },
  });
  return NextResponse.json({ task });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
