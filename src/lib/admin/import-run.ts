/**
 * 엑셀 임포트 공용 실행기 — 미리보기(dryRun) + 실제 반영.
 *
 * 미리보기는 실제 임포트 로직을 **트랜잭션 안에서 그대로 실행한 뒤 롤백**한다.
 * 별도 예측 로직을 두면 실제 결과와 어긋나므로, 같은 코드로 계산하고 쓰기만 취소한다.
 * (신규/갱신 판정은 DB 조회가 필요하고, errors[] 도 실제 시도에서만 나온다.)
 */
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

export type ImportCounts = { created: number; updated: number; skipped: number; errors: string[] };

/** 임포터 시그니처 — 세 임포터(견적·일일보고·잠재고객)가 공통으로 따른다. */
export type Importer<Row> = (client: PrismaClient, rows: Row[], importerUserId: number) => Promise<ImportCounts>;

/** 미리보기 롤백용 — 트랜잭션을 되돌리되 결과는 밖으로 전달. */
class DryRunRollback extends Error {
  constructor(public result: ImportCounts) { super('dry-run rollback'); }
}

/**
 * dryRun=true 면 쓰지 않고 결과만 계산(트랜잭션 롤백), false 면 실제 반영.
 * 트랜잭션 타임아웃은 대량 행을 감안해 넉넉히 준다.
 */
export async function runImport<Row>(
  importer: Importer<Row>,
  rows: Row[],
  importerUserId: number,
  dryRun: boolean,
): Promise<ImportCounts> {
  if (!dryRun) return importer(prisma, rows, importerUserId);

  try {
    await prisma.$transaction(async (tx) => {
      const r = await importer(tx as unknown as PrismaClient, rows, importerUserId);
      throw new DryRunRollback(r);       // 커밋하지 않고 롤백
    }, { timeout: 120_000, maxWait: 20_000 });
  } catch (e) {
    if (e instanceof DryRunRollback) return e.result;
    if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Error) {
      return { created: 0, updated: 0, skipped: rows.length, errors: [`미리보기 실패: ${e.message}`] };
    }
    throw e;
  }
  // 도달 불가(위에서 반드시 throw)
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

/** 업로드 파일 크기 상한(바이트). 초과 시 400 — 서버리스 메모리 보호. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;   // 10MB

/** 요청 URL 의 ?dryRun=1 여부. */
export const isDryRun = (req: Request): boolean =>
  new URL(req.url).searchParams.get('dryRun') === '1';
