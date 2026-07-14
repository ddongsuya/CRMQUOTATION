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

  // 계약 체결(ACCEPTED) 임포트 견적 = 진행 시험(Deal 없이 companyId 직결). 프로젝트로 합류.
  const wonQuotes = await prisma.quote.findMany({
    where: {
      userId: { in: owners }, status: 'ACCEPTED', dealId: null, companyId: { not: null },
      ...(companyId ? { companyId: Number(companyId) } : {}),
    },
    select: {
      id: true, quoteNumber: true, projectName: true, modality: true, grandTotal: true,
      sentAt: true, issuedAt: true, createdAt: true, studyType: true, planJson: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: 'desc' },
  });
  const DAY = 86400_000;
  for (const q of wonQuotes) {
    // 효력 견적은 설계된 실제 시험기간(planJson.totalWeeks)이 있으므로 간트 막대를 그릴 수 있는
    // 시험 행을 합성한다. 독성 견적은 아직 기간 정보가 없어 기존대로 빈 배열.
    type StudyRow = {
      id: number; itemName: string | null; studyNumber: string | null; director: string | null;
      requestSentAt: Date | null; intakeCompletedAt: Date | null;
      reportDraftDueAt: Date | null; reportDraftIssuedAt: Date | null; createdAt: Date;
    };
    const studies: StudyRow[] = [];
    if (q.studyType === 'efficacy') {
      try {
        const plan = JSON.parse(q.planJson ?? '{}') as { totalWeeks?: number };
        const weeks = Number(plan.totalWeeks) || 0;
        if (weeks > 0) {
          const start = q.sentAt ?? q.issuedAt ?? q.createdAt;
          studies.push({
            id: -q.id, itemName: q.projectName, studyNumber: q.quoteNumber, director: '—',
            requestSentAt: start, intakeCompletedAt: null,
            reportDraftDueAt: new Date(new Date(start).getTime() + weeks * 7 * DAY),
            reportDraftIssuedAt: null, createdAt: q.createdAt,
          });
        }
      } catch { /* planJson 파싱 실패 시 막대 없이 표기 */ }
    }
    projects.push({
      id: -q.id, title: q.projectName, modality: q.modality, stage: 'STUDY', status: 'WON',
      companyId: q.company!.id, companyName: q.company!.name, contactName: '—',
      contractStatus: 'SIGNED', contractNumber: null, signedAt: q.sentAt,
      quoteId: q.id, quoteNumber: q.quoteNumber, amount: q.grandTotal,
      studyCount: studies.length, studies,
    });
  }
  return NextResponse.json({ projects });
}
