/** 회사명 정규화·매칭 — 표기 변형(㈜·(주)·공백·영한) 흡수. FK 백필/임포트 공용. */

/** 정규화 키: 법인 접두/괄호/공백/기호 제거 + 소문자. */
export function normCompany(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/\(?주\)?|㈜|주식회사|\(유\)|유한회사|\(재\)|Inc\.?|Co\.?,?\s*Ltd\.?|Corp\.?|Ltd\.?/gi, '')
    .replace(/[\s·\-_.,()]/g, '')
    .toLowerCase()
    .trim();
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
