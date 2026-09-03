/**
 * POST /api/crm/deals  — 안건 생성 (의뢰자 지정)
 * body: { contactId, title, modality?, indication?, clinicalDesign?, submissionTarget?, reportLanguage? }
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, visibleOwnerIds } from '@/lib/current-user';

import { withErrorHandling } from '@/lib/api-handler';
import { parseBody } from '@/lib/parse-body';
import { dealCreateSchema } from '@/lib/schemas/crm';
export const dynamic = 'force-dynamic';

async function _POST(req: Request) {
  const owners = await visibleOwnerIds();
  const ownerId = await currentUserId();
  const parsed = await parseBody(req, dealCreateSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const contact = await prisma.contact.findUnique({ where: { id: b.contactId }, include: { company: true } });
  if (!contact || !owners.includes(contact.company.ownerId)) return NextResponse.json({ error: '의뢰자를 찾을 수 없습니다.' }, { status: 404 });

  const deal = await prisma.deal.create({
    data: {
      ownerId,
      contactId: b.contactId,
      title: b.title,
      modality: b.modality,
      indication: b.indication,
      clinicalDesign: b.clinicalDesign,
      submissionTarget: b.submissionTarget,
      reportLanguage: b.reportLanguage,
    },
  });
  return NextResponse.json({ deal });
}

export const POST = withErrorHandling(_POST);
