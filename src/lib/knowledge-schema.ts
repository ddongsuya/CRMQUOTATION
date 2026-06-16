/**
 * 지식·근거 데이터 검증 스키마 (zod).
 *
 * 앱 인라인 편집(API mutate)과 엑셀 가져오기(import) 모두 저장 직전에 이 스키마로
 * 검증한다 → 깨진 데이터가 단일 진실원천(data/*.json)에 들어가는 것을 막는다.
 *
 * fs 의존이 없어 서버/클라이언트 양쪽에서 import 가능.
 */
import { z } from 'zod';
import type { KnowledgeDataset } from './knowledge';

const str = z.string().trim();
const optStr = z.string().trim().optional().or(z.literal(''));

/** 가이드라인 사전 1건 */
export const guidelineSchema = z.object({
  code: str.min(1, 'code(코드)는 필수입니다'),
  title_ko: str.min(1, 'title_ko(한글 제목)는 필수입니다'),
  title_en: optStr,
  category: str.min(1, 'category(분류)는 필수입니다'),
  version: optStr,
  official_url: optStr,
  confidence: optStr,
  purpose: optStr,
  // checklist: 자유형 객체(요구사항 키-값). 중첩 허용.
  checklist: z.record(z.any()).optional(),
  '함량분석_관련': optStr,
  related_tests: z.array(z.string()).optional(),
}).passthrough();

/** 모달리티별 가이드라인 1건 */
export const modalitySchema = z.object({
  '상위분류': str.min(1, '상위분류는 필수입니다'),
  '모달리티': str.min(1, '모달리티는 필수입니다'),
  '하위분류': optStr,
  '규제근거': z.array(z.string()).default([]),
  '필수시험구성': optStr,
  '출처': optStr,
  '상태': optStr,
}).passthrough();

/** MFDS 시험설계 규칙 1건 */
export const designRuleSchema = z.object({
  '시험': str.min(1, '시험명은 필수입니다'),
  '별표': optStr,
  '시험동물': optStr,
  '투여경로': optStr,
  '투여기간_관찰': optStr,
  '용량단계': optStr,
  '선후행_조건부': optStr,
  'TK': optStr,
}).passthrough();

export const SCHEMA_BY_DATASET = {
  guidelines: guidelineSchema,
  modalities: modalitySchema,
  designRules: designRuleSchema,
} as const;

/** 데이터셋 내에서 한 레코드를 식별하는 키 필드 (중복 검사·update 매칭용) */
export const ID_FIELD: Record<KnowledgeDataset, string> = {
  guidelines: 'code',
  modalities: '모달리티',
  designRules: '시험',
};

export type KnowledgeRecord = Record<string, unknown>;

/** 한 데이터셋의 배열 전체를 검증하고, 식별키 중복을 잡는다. */
export function validateDataset(
  dataset: KnowledgeDataset,
  items: unknown[],
): { ok: true; data: KnowledgeRecord[] } | { ok: false; errors: string[] } {
  const schema = SCHEMA_BY_DATASET[dataset];
  const idField = ID_FIELD[dataset];
  const errors: string[] = [];
  const out: KnowledgeRecord[] = [];
  const seen = new Set<string>();

  items.forEach((raw, i) => {
    const res = schema.safeParse(raw);
    if (!res.success) {
      const msg = res.error.issues.map(iss => `${iss.path.join('.')||'(root)'}: ${iss.message}`).join('; ');
      errors.push(`#${i + 1} — ${msg}`);
      return;
    }
    const rec = res.data as KnowledgeRecord;
    const id = String(rec[idField] ?? '').trim().normalize('NFC');
    if (id && seen.has(id)) errors.push(`#${i + 1} — 식별키 중복: ${idField}="${id}"`);
    seen.add(id);
    out.push(rec);
  });

  return errors.length ? { ok: false, errors } : { ok: true, data: out };
}
