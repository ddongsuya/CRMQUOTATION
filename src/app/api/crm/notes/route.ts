/**
 * GET  /api/crm/notes           — 내 기록 (최신순). ?contactId= / ?dealId= 필터
 * POST /api/crm/notes           — 기록 생성
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';
import { checkLinkOwnership } from '@/lib/crm-guards';

import { withErrorHandling } from '@/lib/api-handler';
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
  const b = await req.json().catch(() => null) as { type?: string; title?: string; body?: string; occurredAt?: string; contactId?: number; dealId?: number } | null;
  const body = String(b?.body ?? '').trim();
  if (!body) return NextResponse.json({ error: '내용을 입력하세요.' }, { status: 400 });
  const type = ['MEETING', 'CALL', 'MEMO'].includes(String(b?.type)) ? String(b!.type) : 'MEMO';
  const linkErr = await checkLinkOwnership(b ?? {});
  if (linkErr) return NextResponse.json({ error: linkErr }, { status: 404 });
  const note = await prisma.note.create({
    data: {
      ownerId, type, body,
      title: b?.title?.trim() || null,
      occurredAt: b?.occurredAt ? new Date(b.occurredAt) : new Date(),
      contactId: b?.contactId ? Number(b.contactId) : null,
      dealId: b?.dealId ? Number(b.dealId) : null,
    },
  });
  return NextResponse.json({ note });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
