/**
 * Backfill — 견적의 고객사 FK(companyId) 연결.
 *
 * 배경: quote-v2 저장 라우트가 예전엔 customerCompany(문자열)만 저장하고
 *   Company(고객관리)를 만들지 않아, 신규 고객사로 만든 견적이 고객관리에
 *   나타나지 않았다. 저장 라우트는 수정됐지만, 그 전에 만들어진 견적들은
 *   companyId=null 로 남아 있으므로 이 스크립트로 소급 연결한다.
 *
 * 동작: companyId 가 없고 customerCompany 문자열이 있는 모든 견적에 대해
 *   정규화 매칭으로 기존 Company 를 찾고, 없으면 생성(소유=견적 담당자)한 뒤
 *   companyId 를 채운다.
 *
 * 멱등(idempotent): 이미 연결된 견적은 건너뛴다.
 * Run: `node scripts/backfill-quote-company.js`
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// src/lib/admin/company-match.ts 의 normCompany 와 동일 로직(인라인).
function normCompany(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\(?주\)?|㈜|주식회사|\(유\)|유한회사|\(재\)|Inc\.?|Co\.?,?\s*Ltd\.?|Corp\.?|Ltd\.?/gi, '')
    .replace(/[\s·\-_.,()]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, aliases: true } });
  const index = new Map();
  for (const c of companies) {
    const keys = [c.name, ...(c.aliases ? c.aliases.split(',') : [])];
    for (const k of keys) {
      const n = normCompany(k);
      if (n && !index.has(n)) index.set(n, c.id);
    }
  }

  const orphans = await prisma.quote.findMany({
    where: { companyId: null, NOT: { customerCompany: null } },
    select: { id: true, customerCompany: true, customerName: true, customerEmail: true, userId: true },
  });

  let linked = 0, created = 0, contacts = 0, skipped = 0;
  for (const q of orphans) {
    const name = (q.customerCompany ?? '').trim();
    if (!name) { skipped++; continue; }
    const key = normCompany(name);
    let companyId = index.get(key) ?? null;
    if (companyId == null) {
      const co = await prisma.company.create({ data: { name, ownerId: q.userId }, select: { id: true } });
      companyId = co.id;
      index.set(key, companyId);
      created++;
    }
    await prisma.quote.update({ where: { id: q.id }, data: { companyId } });
    linked++;

    const contactName = (q.customerName ?? '').trim();
    if (contactName) {
      const email = (q.customerEmail ?? '').trim() || undefined;
      const existing = await prisma.contact.findFirst({ where: { companyId, name: contactName }, select: { id: true } });
      if (!existing) { await prisma.contact.create({ data: { companyId, name: contactName, email } }); contacts++; }
    }
  }

  console.log(JSON.stringify({ orphans: orphans.length, linked, companiesCreated: created, contactsCreated: contacts, skipped }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
