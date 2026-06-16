/**
 * 지식·근거 편집 폼의 필드 사양 (클라이언트 안전 — fs/exceljs 비의존).
 * /guidelines 편집 모달이 이 사양으로 입력 폼을 렌더링한다.
 */
import type { KnowledgeDataset } from './knowledge';

export type FieldType = 'text' | 'textarea' | 'array' | 'json';
export type FieldSpec = { field: string; label: string; type: FieldType; required?: boolean };

export const FIELDS: Record<KnowledgeDataset, FieldSpec[]> = {
  guidelines: [
    { field: 'code', label: '코드', type: 'text', required: true },
    { field: 'title_ko', label: '제목(한글)', type: 'text', required: true },
    { field: 'title_en', label: '제목(영문)', type: 'text' },
    { field: 'category', label: '분류', type: 'text', required: true },
    { field: 'version', label: '버전', type: 'text' },
    { field: 'official_url', label: '공식 원문 URL', type: 'text' },
    { field: 'confidence', label: '신뢰도(예: 원문확인)', type: 'text' },
    { field: 'purpose', label: '목적', type: 'textarea' },
    { field: '함량분석_관련', label: '함량분석 관련', type: 'textarea' },
    { field: 'related_tests', label: '관련 시험 (줄바꿈 구분)', type: 'array' },
    { field: 'checklist', label: '체크리스트 (JSON, 고급)', type: 'json' },
  ],
  designRules: [
    { field: '시험', label: '시험명', type: 'text', required: true },
    { field: '별표', label: '별표', type: 'text' },
    { field: '시험동물', label: '시험동물 (종·마리수)', type: 'textarea' },
    { field: '투여경로', label: '투여경로', type: 'textarea' },
    { field: '투여기간_관찰', label: '투여기간·관찰', type: 'textarea' },
    { field: '용량단계', label: '용량단계', type: 'textarea' },
    { field: '선후행_조건부', label: '선후행·조건부 규칙', type: 'textarea' },
    { field: 'TK', label: '독성동태(TK)', type: 'textarea' },
  ],
  modalities: [
    { field: '상위분류', label: '상위분류', type: 'text', required: true },
    { field: '모달리티', label: '모달리티', type: 'text', required: true },
    { field: '하위분류', label: '하위분류', type: 'text' },
    { field: '규제근거', label: '규제근거 (줄바꿈 구분)', type: 'array' },
    { field: '필수시험구성', label: '필수 시험구성', type: 'textarea' },
    { field: '출처', label: '출처', type: 'text' },
    { field: '상태', label: '상태(필요/부분/확보)', type: 'text' },
  ],
};

export const DATASET_LABEL: Record<KnowledgeDataset, string> = {
  guidelines: '가이드라인',
  designRules: '시험설계 규칙',
  modalities: '모달리티',
};

/** 폼 값(문자열 맵) → 저장용 레코드 (array/json 역직렬화) */
export function formToRecord(dataset: KnowledgeDataset, form: Record<string, string>): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of FIELDS[dataset]) {
    const raw = form[f.field] ?? '';
    if (f.type === 'array') {
      const arr = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      rec[f.field] = arr;
    } else if (f.type === 'json') {
      const s = raw.trim();
      if (s) { try { rec[f.field] = JSON.parse(s); } catch { /* 무시 — 검증에서 잡힘 */ rec[f.field] = s; } }
    } else {
      rec[f.field] = raw;
    }
  }
  return rec;
}

/** 저장된 레코드 → 폼 값(문자열 맵) (array→줄바꿈, json→stringify) */
export function recordToForm(dataset: KnowledgeDataset, rec: Record<string, unknown> | null): Record<string, string> {
  const form: Record<string, string> = {};
  for (const f of FIELDS[dataset]) {
    const v = rec?.[f.field];
    if (v == null) { form[f.field] = ''; continue; }
    if (f.type === 'array') form[f.field] = Array.isArray(v) ? v.join('\n') : String(v);
    else if (f.type === 'json') form[f.field] = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
    else form[f.field] = String(v);
  }
  return form;
}
