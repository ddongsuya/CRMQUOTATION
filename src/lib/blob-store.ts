/**
 * 마스터데이터 오버레이 저장소 (서버 전용).
 *
 * 각 데이터셋(test_items / quote_templates / knowledge:* …)을 DataBlob 한 행으로 저장한다.
 * - 읽기: hydrateBlobs() 가 모든 행을 한 번에 읽어 { key: json } 맵으로 돌려준다.
 *   행이 있으면 번들된 JSON seed 보다 우선(overlay), 없으면 로더가 파일로 폴백한다.
 * - 쓰기: writeBlob(key, value) 가 upsert. 서버리스(읽기전용 FS)에서도 편집이 영속된다.
 *
 * 모든 함수는 best-effort — DB 미설정/실패 시 throw 하지 않고 빈 결과/false 를 돌려
 * 파일 기반 동작(로컬·읽기전용 데모)을 그대로 유지한다.
 */
import { prisma } from './prisma';

const DB_ENABLED = !!process.env.DATABASE_URL;

export function blobDbEnabled() { return DB_ENABLED; }

/** 모든 DataBlob 행을 { key: json } 맵으로. DB 없음/실패 → {} */
export async function hydrateBlobs(): Promise<Record<string, unknown>> {
  if (!DB_ENABLED) return {};
  try {
    const rows = await prisma.dataBlob.findMany();
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = r.json;
    return map;
  } catch {
    return {};
  }
}

/** 한 데이터셋 전체를 upsert. 성공 true, DB 없음/실패 false. */
export async function writeBlob(key: string, value: unknown): Promise<boolean> {
  if (!DB_ENABLED) return false;
  try {
    // Prisma Json 컬럼: null 은 DbNull 로, 그 외는 그대로 직렬화.
    const json = value as never;
    await prisma.dataBlob.upsert({
      where: { key },
      create: { key, json },
      update: { json },
    });
    return true;
  } catch {
    return false;
  }
}
