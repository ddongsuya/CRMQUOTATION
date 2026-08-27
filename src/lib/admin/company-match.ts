/** 회사명 정규화·매칭 — 표기 변형(㈜·(주)·공백·영한) 흡수. FK 백필/임포트 공용. */

/**
 * 정규화 키: 법인 표기(㈜·주식회사·Co.,Ltd 등)·괄호·공백·기호 제거 + 소문자.
 *
 * ⚠️ 낱글자 '주/유/재'는 반드시 괄호로 감싸진 경우((주)·㈜)에만 제거한다.
 * 예전 규칙은 `\(?주\)?` 로 **낱글자 주를 어디서든** 지워서
 *   · 주성엔지니어링 → 성엔지니어링 (서로 다른 회사가 병합)
 *   · 주식회사 대웅제약 → 식회사대웅제약 (㈜대웅제약과 매칭 실패 → 중복 생성)
 * 처럼 조용히 데이터를 오염시켰다. 영문 접미사도 단어 경계(\b)로만 제거해
 * Lincoln 의 'inc' 같은 부분 매칭을 막는다. (테스트: company-match.test.js)
 */
export function normCompany(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).toLowerCase();
  s = s.replace(/[(（]\s*(주|유|재|사|株)\s*[)）]/g, '');   // (주) (유) (재) (사) （주）
  s = s.replace(/㈜|㈔|株式会社/g, '');
  s = s.replace(/주식회사|유한책임회사|유한회사|합자회사|합명회사|재단법인|사단법인|의료법인|농업회사법인/g, '');
  s = s.replace(/\bco\.?,?\s*ltd\.?\b/g, '');            // Co., Ltd 조합
  s = s.replace(/\b(inc|incorporated|ltd|limited|co|corp|corporation|company|llc|plc|gmbh|ag|bv|pte)\b\.?/g, '');
  s = s.replace(/[\s·・\-_.,&()（）]/g, '');
  return s.trim();
}

export type CompanyLite = { id: number; name: string; aliases: string | null };

/** 정규화 키 → companyId 인덱스 (이름 + 별칭 모두 등록). */
export function buildCompanyIndex(companies: CompanyLite[]): Map<string, number> {
  const idx = new Map<string, number>();
  for (const c of companies) {
    const keys = [c.name, ...(c.aliases ? c.aliases.split(',') : [])];
    for (const k of keys) {
      const n = normCompany(k);
      if (n && !idx.has(n)) idx.set(n, c.id);
    }
  }
  return idx;
}

/** 이름 → companyId (정규화 매칭). 없으면 null. */
export function matchCompanyId(name: string | null | undefined, index: Map<string, number>): number | null {
  const n = normCompany(name);
  return n ? index.get(n) ?? null : null;
}

/** company.findMany/create + contact.find/create/update 를 갖춘 최소 Prisma 클라이언트(트랜잭션 tx 포함). */
type CompanyTx = {
  company: {
    findMany(args: { select: { id: true; name: true; aliases: true } }): Promise<CompanyLite[]>;
    create(args: { data: { name: string; ownerId: number }; select: { id: true } }): Promise<{ id: number }>;
  };
  contact: {
    findFirst(args: { where: { companyId: number; name: string }; select: { id: true } }): Promise<{ id: number } | null>;
    create(args: { data: { companyId: number; name: string; email?: string; phone?: string } }): Promise<unknown>;
    update(args: { where: { id: number }; data: { email?: string; phone?: string } }): Promise<unknown>;
  };
};

/**
 * 고객사 find-or-create(정규화 매칭) + 의뢰자 Contact upsert → { companyId, contactId } 반환.
 * 두 저장 라우트(quote-v2·quote-efficacy)가 공유. 트랜잭션 tx 를 넘겨 원자성 보장.
 * contactId 는 견적의 담당자 연결(Quote.contactId)에 사용 — 고객 상세에서 담당자 기반 집계 근거.
 */
export async function findOrCreateCompanyWithContact(
  tx: CompanyTx,
  { companyName, ownerId, contactName, email, phone }: {
    companyName: string; ownerId: number; contactName?: string; email?: string; phone?: string;
  },
): Promise<{ companyId: number; contactId: number | null }> {
  const companies = await tx.company.findMany({ select: { id: true, name: true, aliases: true } });
  let companyId = matchCompanyId(companyName, buildCompanyIndex(companies));
  if (companyId == null) {
    const co = await tx.company.create({ data: { name: companyName, ownerId }, select: { id: true } });
    companyId = co.id;
  }
  const cn = (contactName ?? '').trim();
  let contactId: number | null = null;
  if (cn) {
    const e = email?.trim() || undefined;
    const p = phone?.trim() || undefined;
    const existing = await tx.contact.findFirst({ where: { companyId, name: cn }, select: { id: true } });
    if (!existing) {
      const created = await tx.contact.create({ data: { companyId, name: cn, email: e, phone: p } });
      contactId = (created as { id: number }).id;
    } else {
      if (e || p) await tx.contact.update({ where: { id: existing.id }, data: { email: e, phone: p } });
      contactId = existing.id;
    }
  }
  return { companyId, contactId };
}
