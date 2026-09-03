/**
 * GET  /api/crm/notes           — 내 기록 (최신순). ?contactId= / ?dealId= 필터
 * POST /api/crm/notes           — 기록 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { noteCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _GET(req: Request) {
  const owners = await visibleOwnerIds();
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get('contactId');
  const dealId = searchParams.get('dealId');
  const notes = await prisma.note.findMany({
    where: {
      ownerId: { in: owners },
      ...(contactId ? { contactId: Number(contactId) } : {}),
      ...(dealId ? { dealId: Number(dealId) } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    include: {
      contact: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
      deal: { select: { id: true, title: true } },
    },
    take: 200,
  });
  return NextResponse.json({ notes });
}

async function _POST(req: Request) {
  const ownerId = await currentUserId();
  const parsed = await parseBody(req, noteCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;
  const linkErr = await checkLinkOwnership(b);
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });
  const note = await prisma.note.create({
    data: {
      ownerId, type: b.type, body: b.body,
      title: b.title,
      occurredAt: b.occurredAt,   // 없으면 스키마가 지금 시각으로 채움
      contactId: b.contactId,
      dealId: b.dealId,
    },
  });
  return NextResponse.json({ note });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
