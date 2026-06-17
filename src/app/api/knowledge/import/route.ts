/**
 * POST /api/knowledge/import — 수정한 엑셀을 업로드해 지식·근거 데이터로 되돌리기 (관리자 전용)
 *
 * multipart/form-data: file=<xlsx>, apply="1"?(없으면 미리보기만)
 *   - 미리보기(기본): 데이터셋별 추가/변경/삭제 건수 + 검증 오류를 반환, 디스크 미변경
 *   - apply=1       : 검증 통과 시 3개 JSON 전체를 덮어쓰고 캐시 무효화
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadKnowledge, writeKnowledgeDataset, type KnowledgeDataset } from '@/lib/knowledge';
import { validateDataset, ID_FIELD, type KnowledgeRecord } from '@/lib/knowledge-schema';
import { parseKnowledgeWorkbook } from '@/lib/knowledge-xlsx';
import { ensureHydrated } from '@/lib/hydrate';

const DATASETS: KnowledgeDataset[] = ['guidelines', 'modalities', 'designRules'];

function currentBundle() {
  const k = loadKnowledge();
  return {
    guidelines: k.guidelines as unknown as KnowledgeRecord[],
    modalities: k.modalities as unknown as KnowledgeRecord[],
    designRules: k.designRules as unknown as KnowledgeRecord[],
  };
}

function diff(dataset: KnowledgeDataset, current: KnowledgeRecord[], next: KnowledgeRecord[]) {
  const idF = ID_FIELD[dataset];
  const nfc = (s: unknown) => String(s ?? '').trim().normalize('NFC');
  const curMap = new Map(current.map(r => [nfc(r[idF]), r]));
  const nextMap = new Map(next.map(r => [nfc(r[idF]), r]));
  let added = 0, changed = 0, removed = 0;
  for (const [id, r] of nextMap) {
    if (!curMap.has(id)) added++;
    else if (JSON.stringify(curMap.get(id)) !== JSON.stringify(r)) changed++;
  }
  for (const id of curMap.keys()) if (!nextMap.has(id)) removed++;
  return { added, changed, removed, total: next.length };
}

export async function POST(req: Request) {
  await ensureHydrated();
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 가져올 수 있습니다.' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: '파일 업로드 형식이 아닙니다.' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'file 이 없습니다.' }, { status: 400 });
  const apply = String(form.get('apply') ?? '') === '1';

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = await parseKnowledgeWorkbook(buf);
  } catch (e) {
    return NextResponse.json({ error: `엑셀 파싱 실패: ${e instanceof Error ? e.message : '알 수 없음'}` }, { status: 400 });
  }

  // 검증 (전 데이터셋)
  const validated: Record<KnowledgeDataset, KnowledgeRecord[]> = { guidelines: [], modalities: [], designRules: [] };
  const errorsByDataset: Record<string, string[]> = {};
  for (const ds of DATASETS) {
    const res = validateDataset(ds, parsed[ds]);
    if (res.ok) validated[ds] = res.data;
    else errorsByDataset[ds] = res.errors;
  }
  const hasErrors = Object.keys(errorsByDataset).length > 0;

  const cur = currentBundle();
  const summary = DATASETS.map(ds => ({
    dataset: ds,
    sheet: ds,
    ...diff(ds, cur[ds], (hasErrors ? parsed[ds] : validated[ds]) as KnowledgeRecord[]),
    errors: errorsByDataset[ds] ?? [],
  }));

  if (!apply) {
    return NextResponse.json({ ok: !hasErrors, mode: 'preview', summary });
  }

  if (hasErrors) {
    return NextResponse.json({ ok: false, mode: 'apply', error: '검증 실패로 적용하지 않았습니다.', summary }, { status: 422 });
  }

  for (const ds of DATASETS) await writeKnowledgeDataset(ds, validated[ds]);
  return NextResponse.json({ ok: true, mode: 'apply', summary });
}
