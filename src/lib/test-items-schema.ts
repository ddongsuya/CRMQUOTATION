/**
 * 시험항목·가격 마스터(test_items) 검증 스키마 (zod).
 *
 * 앱 인라인 편집(mutate)·엑셀 가져오기(import) 저장 직전에 이 스키마로 검증한다.
 * 가격·식별키는 엄격하게(잘못된 가격이 견적에 바로 영향), 서술 필드는 passthrough.
 * fs 의존이 없어 서버/클라이언트 양쪽에서 import 가능.
 */
import { z } from 'zod';

const nonNegNum = z.number().finite().nonnegative();
/** 가격: 숫자(≥0) 또는 null/미입력 */
const price = nonNegNum.nullable().optional();
const nstr = z.string().nullable().optional();

export const testItemSchema = z.object({
  key: z.string().trim().min(1, 'key(식별자)는 필수입니다'),
  masterId: z.string().trim().optional().default(''),
  testName: z.string().trim().min(1, 'testName(시험명)은 필수입니다'),
  modalityPool: z.array(z.string()).default([]),
  category: nstr,
  status: nstr,
  adminRoute: nstr,
  routeGroup: z.enum(['A', 'B', 'SPECIAL', 'NONE']).nullable().optional(),
  adminDuration: nstr,
  studyWeeks: z.number().finite().nullable().optional(),
  priceMfds: price,
  priceOecd: price,
  priceTiers: z.record(nonNegNum).nullable().optional(),
  isPrerequisite: z.boolean().optional().default(false),
}).passthrough();

export type TestItemRecord = Record<string, unknown>;

/** 항목 배열 전체 검증 + key 중복 검사 */
export function validateTestItems(
  items: unknown[],
): { ok: true; data: TestItemRecord[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const out: TestItemRecord[] = [];
  const seen = new Set<string>();

  items.forEach((raw, i) => {
    const res = testItemSchema.safeParse(raw);
    if (!res.success) {
      const msg = res.error.issues.map(iss => `${iss.path.join('.') || '(root)'}: ${iss.message}`).join('; ');
      const keyHint = (raw as { key?: string })?.key ? ` (key=${(raw as { key?: string }).key})` : '';
      errors.push(`#${i + 1}${keyHint} — ${msg}`);
      return;
    }
    const rec = res.data as TestItemRecord;
    const key = String(rec.key ?? '').trim().normalize('NFC');
    if (key && seen.has(key)) errors.push(`#${i + 1} — key 중복: "${key}"`);
    seen.add(key);
    out.push(rec);
  });

  return errors.length ? { ok: false, errors } : { ok: true, data: out };
}
