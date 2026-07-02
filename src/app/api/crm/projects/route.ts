/**
 * GET /api/crm/projects — 진행 프로젝트(=Deal) 목록 + 회사·의뢰자·계약·견적·시험(날짜).
 * 시험 일정(프로젝트 스코프 간트)·고객 상세 "시험 일정 보기"에서 사용. 신규 엔티티 없음(Deal 재사용).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const owners = await visibleOwnerIds();
  const companyId = new URL(req.url).searchParams.get('companyId');
  const rows = await prisma.deal.findMany({
    where: {
      ownerId: { in: owners },
      ...(companyId ? { contact: { companyId: Number(companyId) } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      contact: { select: { name: true, company: { select: { id: true, name: true } } } },
      contract: { select: { status: true, signedAt: true, contractNumber: true } },
      quotes: { select: { id: true, quoteNumber: true, grandTotal: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      studies: { orderBy: { createdAt: 'asc' } },
    },
  });

  const projects = rows.map(d => {
    // 대표 견적 = 수주(ACCEPTED) 우선, 없으면 금액 최대
    const won = d.quotes.find(q => q.status === 'ACCEPTED');
    const top = won ?? [...d.quotes].sort((a, b) => (b.grandTotal ?? 0) - (a.grandTotal ?? 0))[0];
    return {
      id: d.id, title: d.title, modality: d.modality, stage: d.stage, status: d.status,
      companyId: d.contact.company.id, companyName: d.contact.company.name, contactName: d.contact.name,
      contractStatus: d.contract?.status ?? null, contractNumber: d.contract?.contractNumber ?? null, signedAt: d.contract?.signedAt ?? null,
      quoteId: top?.id ?? null, quoteNumber: top?.quoteNumber ?? null, amount: top?.grandTotal ?? null,
      studyCount: d.studies.length,
      studies: d.studies.map(s => ({
        id: s.id, itemName: s.itemName, studyNumber: s.studyNumber, director: s.director,
        requestSentAt: s.requestSentAt, intakeCompletedAt: s.intakeCompletedAt,
        reportDraftDueAt: s.reportDraftDueAt, reportDraftIssuedAt: s.reportDraftIssuedAt,
        createdAt: s.createdAt,
      })),
    };
  });
  return NextResponse.json({ projects });
}
