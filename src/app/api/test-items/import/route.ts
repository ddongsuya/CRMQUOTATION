/**
 * POST /api/test-items/import — 수정한 엑셀을 업로드해 시험항목·가격 마스터로 되돌리기 (관리자 전용)
 *
 * multipart/form-data: file=<xlsx>, apply="1"?(없으면 미리보기만)
 *   - 미리보기(기본): 추가/변경/삭제 건수 + 검증 오류 반환, 디스크 미변경
 *   - apply=1       : 검증 통과 시 전체 교체 후 캐시 무효화
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadData, writeTestItems, type TestItem } from '@/lib/data';
import { validateTestItems, type TestItemRecord } from '@/lib/test-items-schema';
import { parseTestItemsWorkbook } from '@/lib/test-items-xlsx';

const nfc = (s: unknown) => String(s ?? '').trim().normalize('NFC');

/** 빈값(null/''/[]/{}) 제거 + 키 정렬(중첩 포함) → 순서·부재·빈값에 둔감한 비교 문자열.
 *  파서가 항상 전체 컬럼을 채우는 반면 원본 레코드는 필드 일부가 없을 수 있으므로 필요. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}
function canon(rec: TestItemRecord): string {
  const clean: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(rec)) {
    if (val == null) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as object).length === 0) continue;
    clean[k] = val;
  }
  return stable(clean);
}

function diff(current: TestItemRecord[], next: TestItemRecord[]) {
  const curMap = new Map(current.map(r => [nfc(r.key), r]));
  const nextMap = new Map(next.map(r => [nfc(r.key), r]));
  let added = 0, changed = 0, removed = 0;
  const changedKeys: string[] = [];
  for (const [id, r] of nextMap) {
    const orig = curMap.get(id);
    if (!orig) { added++; if (changedKeys.length < 20) changedKeys.push(id); }
    else if (canon(orig) !== canon(r)) { changed++; if (changedKeys.length < 20) changedKeys.push(id); }
  }
  for (const id of curMap.keys()) if (!nextMap.has(id)) removed++;
  return { added, changed, removed, total: next.length, changedKeys };
}

/** 적용 시 변경되지 않은 행은 원본 객체를 그대로 유지(필드 순서·형태 보존) → git 잡음 최소화. */
function mergePreserving(current: TestItemRecord[], next: TestItemRecord[]): TestItemRecord[] {
  const curMap = new Map(current.map(r => [nfc(r.key), r]));
  return next.map(r => {
    const orig = curMap.get(nfc(r.key));
    return orig && canon(orig) === canon(r) ? orig : r;
  });
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 가져올 수 있습니다.' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: '파일 업로드 형식이 아닙니다.' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file 이 없습니다.' }, { status: 400 });
  const apply = String(form.get('apply') ?? '') === '1';

  let parsed: TestItemRecord[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = await parseTestItemsWorkbook(buf);
  } catch (e) {
    return NextResponse.json({ error: `엑셀 파싱 실패: ${e instanceof Error ? e.message : '알 수 없음'}` }, { status: 400 });
  }

  const validated = validateTestItems(parsed);
  const cur = loadData().testItems as unknown as TestItemRecord[];
  const summary = diff(cur, validated.ok ? validated.data : parsed);
  const errors = validated.ok ? [] : validated.errors;

  if (!apply) {
    return NextResponse.json({ ok: validated.ok, mode: 'preview', summary, errors });
  }
  if (!validated.ok) {
    return NextResponse.json({ ok: false, mode: 'apply', error: '검증 실패로 적용하지 않았습니다.', summary, errors }, { status: 422 });
  }

  const merged = mergePreserving(cur, validated.data);
  writeTestItems(merged as unknown as TestItem[]);
  return NextResponse.json({ ok: true, mode: 'apply', summary });
}
