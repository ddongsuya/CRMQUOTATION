/**
 * PATCH /api/crm/contracts/[id]  — 계약 수정 (상태·날짜·계약번호 + 지급회차 교체)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

type PT = { seq?: number; kind?: string; ratio?: number | null; amount?: number | null; condition?: string; studyId?: number | null; dueAt?: string | null; paidAt?: string | null };

async function owned(id: number) {
  const owners = await visibleOwnerIds();
  const c = await prisma.contract.findUnique({ where: { id }, include: { deal: true } });
  if (!c || !owners.includes(c.deal.ownerId)) return null;
  return c;
}

const date = (v: unknown) => (v ? new Date(String(v)) : null);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!(await owned(id))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if ('status' in body) data.status = String(body.status);
  if ('contractNumber' in body) data.contractNumber = String(body.contractNumber ?? '').trim() || null;
  for (const k of ['costEstimateSentAt', 'draftSentAt', 'approvedAt', 'signedAt'] as const) {
    if (k in body) data[k] = date(body[k]);
  }

  // 지급회차 교체 (전체 replace)
  if (Array.isArray(body.paymentTerms)) {
    const terms = (body.paymentTerms as PT[]).map((t, i) => ({
      seq: Number(t.seq ?? i + 1),
      kind: ['ADVANCE', 'INTERIM', 'BALANCE'].includes(String(t.kind)) ? String(t.kind) : 'INTERIM',
      ratio: t.ratio == null ? null : Number(t.ratio),
      amount: t.amount == null ? null : Number(t.amount),
      condition: t.condition ? String(t.condition).trim() : null,
      studyId: t.studyId == null ? null : Number(t.studyId),
      dueAt: date(t.dueAt),
      paidAt: date(t.paidAt),
    }));
    data.paymentTerms = { deleteMany: {}, create: terms };
  }

  const contract = await prisma.contract.update({
    where: { id },
    data,
    include: { paymentTerms: { orderBy: { seq: 'asc' } } },
  });
  return NextResponse.json({ contract });
}
