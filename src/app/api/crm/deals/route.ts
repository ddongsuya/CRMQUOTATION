/**
 * POST /api/crm/deals  — 안건 생성 (의뢰자 지정)
 * body: { contactId, title, modality?, indication?, clinicalDesign?, submissionTarget?, reportLanguage? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const owners = await visibleOwnerIds();
  const ownerId = await currentUserId();
  const body = await req.json().catch(() => null) as {
    contactId?: number; title?: string; modality?: string; indication?: string;
    clinicalDesign?: string; submissionTarget?: string; reportLanguage?: string;
  } | null;
  const contactId = Number(body?.contactId);
  const title = String(body?.title ?? '').trim();
  if (!contactId || !title) return NextResponse.json({ error: 'contactId·title 이 필요합니다.' }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { company: true } });
  if (!contact || !owners.includes(contact.company.ownerId)) return NextResponse.json({ error: '의뢰자를 찾을 수 없습니다.' }, { status: 404 });

  const reportLanguage = body?.reportLanguage === 'EN' ? 'EN' : 'KO';
  const deal = await prisma.deal.create({
    data: {
      ownerId,
      contactId,
      title,
      modality: body?.modality?.trim() || null,
      indication: body?.indication?.trim() || null,
      clinicalDesign: body?.clinicalDesign?.trim() || null,
      submissionTarget: body?.submissionTarget?.trim() || null,
      reportLanguage,
    },
  });
  return NextResponse.json({ deal });
}
