import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';
import { currentUserId } from '@/lib/current-user';

/** 잠재 고객 → 고객사(Company) 전환. 기존 동일명 고객사 있으면 연결만. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id 오류' }, { status: 400 });

  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: '잠재 고객 없음' }, { status: 404 });
  if (p.companyId) return NextResponse.json({ ok: true, companyId: p.companyId, already: true });

  const ownerId = p.ownerId ?? (await currentUserId());
  const memo = [p.pipeline && `파이프라인: ${p.pipeline}`, p.platform && `플랫폼: ${p.platform}`, p.stage && `개발단계: ${p.stage}`, p.indTarget && `IND: ${p.indTarget}`, p.croOutlook && `CRO 전망: ${p.croOutlook}`, p.note]
    .filter(Boolean).join(' · ') || null;

  let company = await prisma.company.findFirst({ where: { name: p.name }, select: { id: true } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: p.name, ownerId, industry: p.platform ?? undefined, memo: memo ?? undefined, isNewClient: true },
      select: { id: true },
    });
  }
  await prisma.prospect.update({ where: { id }, data: { companyId: company.id } });
  return NextResponse.json({ ok: true, companyId: company.id });
}
