import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** 오늘 날짜 접두사 CK-YYYYMMDD- */
function todayPrefix(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `CK-${yyyy}${mm}${dd}-`;
}

/**
 * 오늘의 다음 견적번호: CK-YYYYMMDD-NNN (NNN = 일련번호, 매일 리셋).
 *
 * 오늘 접두사를 가진 견적 중 **가장 큰 순번 + 1**로 계산한다.
 * (예전엔 개수 count+1 이라, 중간 견적을 삭제하면 이미 쓴 번호를 재발급해 unique 충돌이 났다.)
 * 순번은 3자리 zero-pad 이므로 사전식 내림차순 = 숫자 내림차순.
 */
export async function nextQuoteNumber(now = new Date()): Promise<string> {
  const prefix = todayPrefix(now);
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  });
  const lastSeq = last ? parseInt(last.quoteNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return prefix + String(next).padStart(3, '0');
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/**
 * 견적 생성 시 번호를 발급하고, 동시 저장으로 번호가 겹치면(P2002) 다음 번호로 재시도한다.
 * 두 사용자가 같은 초에 저장해도 한 명이 500으로 실패하지 않게 한다.
 *
 * @param create quoteNumber를 받아 prisma.quote.create(...) 를 수행하는 함수
 */
export async function createQuoteWithNumber<T>(
  create: (quoteNumber: string) => Promise<T>,
  now = new Date(),
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const quoteNumber = await nextQuoteNumber(now);
    try {
      return await create(quoteNumber);
    } catch (e) {
      if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS - 1) continue;
      throw e;
    }
  }
  throw new Error('견적번호 생성 재시도 초과');
}
