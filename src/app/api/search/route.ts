/**
 * GET /api/search?q=  — 전역 검색(Ctrl+K). 고객사·의뢰자·견적·안건·기록·할 일을 내 범위(visibleOwnerIds)에서 통합 검색.
 * 응답 항목마다 href 를 포함해 클라이언트가 바로 이동한다.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { visibleOwnerIds } from '@/lib/current-user';
import { withErrorHandling } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export type SearchHit = {
  kind: 'company' | 'contact' | 'quote' | 'deal' | 'note' | 'task';
  id: number;
  title: string;
  sub: string;
  href: string;
  status?: string | null;
};

async function _GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 1) return NextResponse.json({ hits: [] as SearchHit[] });
  const owners = await visibleOwnerIds();
  const ci = { contains: q, mode: 'insensitive' as const };
  const TAKE = 5;

  const [companies, contacts, quotes, deals, notes, tasks] = await Promise.all([
    prisma.company.findMany({
      where: { ownerId: { in: owners }, OR: [{ name: ci }, { aliases: ci }, { industry: ci }] },
      select: { id: true, name: true, industry: true }, take: TAKE, orderBy: { updatedAt: 'desc' },
    }),
    prisma.contact.findMany({
      where: { company: { ownerId: { in: owners } }, OR: [{ name: ci }, { email: ci }, { phone: ci }, { position: ci }] },
      select: { id: true, name: true, position: true, companyId: true, company: { select: { name: true } } }, take: TAKE, orderBy: { updatedAt: 'desc' },
    }),
    prisma.quote.findMany({
      where: { AND: [{ OR: [{ userId: { in: owners } }, { userId: null }] }, { supersededAt: null }, { OR: [{ quoteNumber: ci }, { projectName: ci }, { customerCompany: ci }, { substanceName: ci }] }] },
      select: { id: true, quoteNumber: true, projectName: true, customerCompany: true, status: true }, take: TAKE, orderBy: { updatedAt: 'desc' },
    }),
    prisma.deal.findMany({
      where: { ownerId: { in: owners }, OR: [{ title: ci }, { modality: ci }, { indication: ci }] },
      select: { id: true, title: true, stage: true, status: true, contact: { select: { name: true, company: { select: { name: true } } } } }, take: TAKE, orderBy: { updatedAt: 'desc' },
    }),
    prisma.note.findMany({
      where: { ownerId: { in: owners }, OR: [{ body: ci }, { title: ci }] },
      select: { id: true, title: true, body: true, occurredAt: true, contact: { select: { companyId: true, company: { select: { name: true } } } }, deal: { select: { id: true, title: true } } }, take: TAKE, orderBy: { occurredAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { ownerId: { in: owners }, OR: [{ title: ci }, { memo: ci }] },
      select: { id: true, title: true, done: true, dueAt: true, companyId: true, company: { select: { name: true } } }, take: TAKE, orderBy: [{ done: 'asc' }, { updatedAt: 'desc' }],
    }),
  ]);

  const snip = (text: string) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, 70);
    return (i > 20 ? '…' : '') + text.slice(Math.max(0, i - 20), i + 60).replace(/\s+/g, ' ').trim();
  };

  const hits: SearchHit[] = [
    ...companies.map((c): SearchHit => ({ kind: 'company', id: c.id, title: c.name, sub: c.industry ?? '고객사', href: `/customers/${c.id}` })),
    ...contacts.map((c): SearchHit => ({ kind: 'contact', id: c.id, title: c.name, sub: `${c.company.name}${c.position ? ` · ${c.position}` : ''}`, href: `/customers/${c.companyId}?tab=contacts` })),
    ...quotes.map((x): SearchHit => ({ kind: 'quote', id: x.id, title: `${x.quoteNumber} · ${x.customerCompany ?? ''}`, sub: x.projectName, href: `/quote/print?id=${x.id}`, status: x.status })),
    ...deals.map((d): SearchHit => ({ kind: 'deal', id: d.id, title: d.title, sub: `${d.contact.company.name} · ${d.contact.name}`, href: `/deals/${d.id}`, status: d.stage })),
    ...notes.map((n): SearchHit => ({
      kind: 'note', id: n.id, title: n.title || snip(n.body), sub: `${n.contact?.company?.name ?? n.deal?.title ?? '기록'} · ${n.occurredAt.toISOString().slice(0, 10)}`,
      href: n.deal ? `/deals/${n.deal.id}` : n.contact ? `/customers/${n.contact.companyId}?tab=notes` : '/notes',
    })),
    ...tasks.map((t): SearchHit => ({ kind: 'task', id: t.id, title: t.title, sub: `${t.company?.name ?? '할 일'}${t.dueAt ? ` · ${t.dueAt.toISOString().slice(0, 10)}` : ''}${t.done ? ' · 완료' : ''}`, href: t.companyId ? `/customers/${t.companyId}?tab=tasks` : '/notes' })),
  ];
  return NextResponse.json({ hits });
}

export const GET = withErrorHandling(_GET);
