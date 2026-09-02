/**
 * CRM 소유권 가드 — 라우트가 id 로 조회/변경하기 전에 "내(조회 가능 범위) 것"인지 확인한다.
 * 인증(C1)을 켜는 순간 IDOR 이 되지 않도록, DEMO 단계에서도 동일한 검사를 통과시킨다.
 * userId 가 null 인 구형 임포트 견적은 소유자 없음으로 보고 허용한다.
 */
import { prisma } from './prisma';
import { visibleOwnerIds } from './current-user';

/** 경로 파라미터 id → 양의 정수만 허용 (NaN·소수·음수는 400 대상) */
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function ownsDeal(id: number, owners?: number[]): Promise<boolean> {
  const o = owners ?? await visibleOwnerIds();
  const d = await prisma.deal.findUnique({ where: { id }, select: { ownerId: true } });
  return !!d && o.includes(d.ownerId);
}
export async function ownsContact(id: number, owners?: number[]): Promise<boolean> {
  const o = owners ?? await visibleOwnerIds();
  const c = await prisma.contact.findUnique({ where: { id }, select: { company: { select: { ownerId: true } } } });
  return !!c && o.includes(c.company.ownerId);
}
export async function ownsCompany(id: number, owners?: number[]): Promise<boolean> {
  const o = owners ?? await visibleOwnerIds();
  const c = await prisma.company.findUnique({ where: { id }, select: { ownerId: true } });
  return !!c && o.includes(c.ownerId);
}
export async function ownsQuote(id: number, owners?: number[]): Promise<boolean> {
  const o = owners ?? await visibleOwnerIds();
  const q = await prisma.quote.findUnique({ where: { id }, select: { userId: true } });
  return !!q && (q.userId == null || o.includes(q.userId));
}

/**
 * 생성/수정 본문의 연결 대상(dealId·contactId·companyId)이 모두 내 소유인지 검사.
 * 위반 시 사용자에게 보여줄 메시지를, 정상이면 null 을 돌려준다.
 */
export async function checkLinkOwnership(b: { dealId?: unknown; contactId?: unknown; companyId?: unknown }): Promise<string | null> {
  const owners = await visibleOwnerIds();
  if (b.dealId && !(await ownsDeal(Number(b.dealId), owners))) return '연결할 안건을 찾을 수 없습니다.';
  if (b.contactId && !(await ownsContact(Number(b.contactId), owners))) return '연결할 의뢰자를 찾을 수 없습니다.';
  if (b.companyId && !(await ownsCompany(Number(b.companyId), owners))) return '연결할 고객사를 찾을 수 없습니다.';
  return null;
}
