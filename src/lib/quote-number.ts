import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * 견적번호 체계 (회사 실무 규칙):
 *   YY-MM-{사용자코드}-{발행번호4자리}         예) 26-07-DL-0122
 *   변경견적서: 원본 번호 뒤에 -{차수}          예) 26-07-DL-0122-1, -2 …
 *
 * · 발행번호는 사용자코드별 통산 일련번호 (월 리셋 없음 — 0122 다음은 0123).
 * · 발행된(DRAFT 아닌) 견적을 수정하면 덮어쓰지 않고 변경견적서를 새로 만들고
 *   원본에 supersededAt 을 찍는다. supersededAt == null 이 "현재 진행 중" 견적.
 * · 구형 번호(CK-YYYYMMDD-NNN)는 그대로 병존 — 변경 시 구형 번호를 base 로 -1 부여.
 */

const NUM_RE = /^(\d{2})-(\d{2})-([A-Za-z0-9]+)-(\d{4})(?:-(\d+))?$/;

/** 사용자 견적 코드 — User.quoteInitials, 없으면 'CK'. */
export async function userInitials(userId: number | null | undefined): Promise<string> {
  if (!userId) return 'CK';
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { quoteInitials: true } });
  return (u?.quoteInitials ?? '').trim() || 'CK';
}

/** 번호에서 변경차수 접미사를 뗀 base. 신형 패턴이 아니면 번호 전체가 base (구형 CK-…). */
export function revisionBase(quoteNumber: string): string {
  const m = NUM_RE.exec(quoteNumber);
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : quoteNumber;
}

/** 견적 저장류 인터랙티브 트랜잭션 옵션 — Neon 콜드스타트 지연 + 다건 쓰기로 기본 5초(P2028)를 넘길 수 있어 30초. */
export const QUOTE_TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;

/** 번호 접두사는 한국시간(KST) 기준 — 서버가 UTC(Vercel)여도 0~9시 저장분이 전달 번호로 찍히지 않게. */
function kstYearMonth(now: Date): { yy: string; mm: string } {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return { yy: String(kst.getUTCFullYear() % 100).padStart(2, '0'), mm: String(kst.getUTCMonth() + 1).padStart(2, '0') };
}

/** 다음 신규 견적번호 — 해당 사용자코드의 최대 발행번호 + 1. */
export async function nextQuoteNumber(userId: number | null | undefined, now = new Date()): Promise<string> {
  const initials = await userInitials(userId);
  const { yy, mm } = kstYearMonth(now);
  const rows = await prisma.quote.findMany({
    where: { quoteNumber: { contains: `-${initials}-` } },
    select: { quoteNumber: true },
  });
  let maxSeq = 0;
  for (const r of rows) {
    const m = NUM_RE.exec(r.quoteNumber);
    if (m && m[3] === initials) maxSeq = Math.max(maxSeq, parseInt(m[4], 10));
  }
  return `${yy}-${mm}-${initials}-${String(maxSeq + 1).padStart(4, '0')}`;
}

/** 변경견적서 번호 — base 의 기존 최대 차수 + 1 (26-07-DL-0122 → 26-07-DL-0122-1). */
export async function nextRevisionNumber(baseNumber: string): Promise<string> {
  const base = revisionBase(baseNumber);
  const rows = await prisma.quote.findMany({
    where: { quoteNumber: { startsWith: `${base}-` } },
    select: { quoteNumber: true },
  });
  let maxRev = 0;
  const revRe = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  for (const r of rows) {
    const m = revRe.exec(r.quoteNumber);
    if (m) maxRev = Math.max(maxRev, parseInt(m[1], 10));
  }
  return `${base}-${maxRev + 1}`;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/**
 * 변경견적서 생성 — 차수 번호를 발급하고, 동시 저장으로 같은 -N 이 겹치면(P2002) 다음 차수로 재시도한다.
 * (신규 발번의 createQuoteWithNumber 와 같은 의미론 — 두 탭에서 동시에 수정 저장해도 한쪽이 500 으로 죽지 않게.)
 */
export async function createRevisionWithNumber<T>(
  baseNumber: string,
  create: (revisionNumber: string) => Promise<T>,
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const revNumber = await nextRevisionNumber(baseNumber);
    try {
      return await create(revNumber);
    } catch (e) {
      if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS - 1) continue;
      throw e;
    }
  }
  throw new Error('변경견적 번호 생성 재시도 초과');
}

/**
 * 견적 생성 시 번호를 발급하고, 동시 저장으로 번호가 겹치면(P2002) 다음 번호로 재시도한다.
 * @param create quoteNumber를 받아 prisma.quote.create(...) 를 수행하는 함수
 * @param userId 발행자 — 사용자코드(YY-MM-{코드}-NNNN) 결정
 */
export async function createQuoteWithNumber<T>(
  create: (quoteNumber: string) => Promise<T>,
  userId?: number | null,
  now = new Date(),
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const quoteNumber = await nextQuoteNumber(userId, now);
    try {
      return await create(quoteNumber);
    } catch (e) {
      if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS - 1) continue;
      throw e;
    }
  }
  throw new Error('견적번호 생성 재시도 초과');
}
