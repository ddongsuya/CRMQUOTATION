/**
 * 시험항목 카탈로그 편집 폼 필드 사양 (클라이언트 안전 — fs/exceljs 비의존).
 *
 * 업데이트 시에는 원본 레코드에 이 폼 값만 덮어쓴다(merge) → sourceFile 등
 * 폼에 없는 provenance 필드가 보존된다. 생성 시에는 폼 값만으로 레코드를 만든다.
 */
export type FieldType = 'text' | 'textarea' | 'number' | 'array' | 'json' | 'bool' | 'select';
export type FieldSpec = {
  field: string; label: string; type: FieldType;
  required?: boolean; readonlyOnEdit?: boolean; options?: string[]; group: string;
};

export const FIELDS: FieldSpec[] = [
  // 기본
  { field: 'key', label: 'key (식별자 · 수정 시 고정)', type: 'text', required: true, readonlyOnEdit: true, group: '기본' },
  { field: 'testName', label: '시험명', type: 'text', required: true, group: '기본' },
  { field: 'masterId', label: 'masterId', type: 'text', group: '기본' },
  { field: 'category', label: '분류(category)', type: 'text', group: '기본' },
  { field: 'status', label: '상태(status)', type: 'text', group: '기본' },
  { field: 'modalityPool', label: '모달리티 (줄바꿈 구분)', type: 'array', group: '기본' },
  // 경로·기간
  { field: 'adminRoute', label: '투여경로', type: 'text', group: '경로·기간' },
  { field: 'routeGroup', label: '경로그룹', type: 'select', options: ['A', 'B', 'SPECIAL', 'NONE'], group: '경로·기간' },
  { field: 'adminDuration', label: '투여기간(표기)', type: 'text', group: '경로·기간' },
  { field: 'studyWeeks', label: '시험주수(studyWeeks)', type: 'number', group: '경로·기간' },
  // 가격
  { field: 'priceMfds', label: '가격 · MFDS', type: 'number', group: '가격' },
  { field: 'priceOecd', label: '가격 · OECD', type: 'number', group: '가격' },
  { field: 'priceTiers', label: '부형제 종수별 가격 (JSON, 예: {"2":20000000,"3":30000000,"4":40000000})', type: 'json', group: '가격' },
  // 함량분석·연결 (엔진)
  { field: 'hamryangRule', label: '함량분석 룰', type: 'text', group: '엔진(고급)' },
  { field: 'excipientBranch', label: '부형제 분기', type: 'text', group: '엔진(고급)' },
  { field: 'linkRelation', label: '연결관계(DRF/TK/RECOVERY 등)', type: 'text', group: '엔진(고급)' },
  { field: 'parentTest', label: '상위 본시험(parentTest)', type: 'text', group: '엔진(고급)' },
  { field: 'isPrerequisite', label: '선행시험 여부', type: 'bool', group: '엔진(고급)' },
  { field: 'optionality', label: '선택성(optionality)', type: 'text', group: '엔진(고급)' },
  // 견적 문구 (PDF 상세)
  { field: 'quoteText', label: '견적 원문', type: 'textarea', group: '견적 문구' },
  { field: 'detail', label: '상세 설명', type: 'textarea', group: '견적 문구' },
  { field: 'guideline', label: '가이드라인 핵심', type: 'textarea', group: '견적 문구' },
  { field: 'notice', label: '주의사항·협의', type: 'textarea', group: '견적 문구' },
];

export const GROUPS = ['기본', '경로·기간', '가격', '엔진(고급)', '견적 문구'];

type Rec = Record<string, unknown>;

/** 폼 값(문자열 맵) → 부분 레코드 (해당 필드만). 업데이트 시 원본에 merge 한다. */
export function formToPartial(form: Record<string, string>): Rec {
  const rec: Rec = {};
  for (const f of FIELDS) {
    const raw = form[f.field] ?? '';
    if (f.type === 'number') {
      const s = raw.replace(/[,\s]/g, '');
      rec[f.field] = s === '' ? null : (Number.isFinite(Number(s)) ? Number(s) : null);
    } else if (f.type === 'bool') {
      rec[f.field] = /^(y|true|1|예|o)$/i.test(raw.trim());
    } else if (f.type === 'array') {
      rec[f.field] = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    } else if (f.type === 'json') {
      const s = raw.trim();
      if (!s) rec[f.field] = null;
      else { try { rec[f.field] = JSON.parse(s); } catch { rec[f.field] = s; /* 검증에서 잡힘 */ } }
    } else {
      const s = raw;
      rec[f.field] = s === '' ? (f.required ? '' : null) : s;
    }
  }
  return rec;
}

/** 레코드 → 폼 값(문자열 맵) */
export function recordToForm(rec: Rec | null): Record<string, string> {
  const form: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = rec?.[f.field];
    if (v == null) { form[f.field] = ''; continue; }
    if (f.type === 'array') form[f.field] = Array.isArray(v) ? v.join('\n') : String(v);
    else if (f.type === 'json') form[f.field] = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
    else if (f.type === 'bool') form[f.field] = v === true ? 'Y' : 'N';
    else form[f.field] = String(v);
  }
  return form;
}
