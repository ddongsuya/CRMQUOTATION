/**
 * POST /api/knowledge/mutate  — 지식·근거 데이터 1건 편집 (관리자 전용)
 *
 * body: { dataset, op, id?, record? }
 *   dataset : 'guidelines' | 'modalities' | 'designRules'
 *   op      : 'update' | 'create' | 'delete'
 *   id      : update/delete 대상의 식별키 값 (guidelines=code, modalities=모달리티, designRules=시험)
 *   record  : update/create 시 새 레코드 전체
 *
 * 저장 전 zod 로 전체 데이터셋을 재검증 → 깨진 데이터 차단. 성공 시 캐시 무효화.
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadKnowledge, writeKnowledgeDataset, type KnowledgeDataset } from '@/lib/knowledge';
import { validateDataset, ID_FIELD, type KnowledgeRecord } from '@/lib/knowledge-schema';

const DATASETS: KnowledgeDataset[] = ['guidelines', 'modalities', 'designRules'];

function currentItems(dataset: KnowledgeDataset): KnowledgeRecord[] {
  const k = loadKnowledge();
  return (dataset === 'guidelines' ? k.guidelines
        : dataset === 'modalities' ? k.modalities
        : k.designRules) as unknown as KnowledgeRecord[];
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 편집할 수 있습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    dataset?: KnowledgeDataset; op?: 'update' | 'create' | 'delete';
    id?: string; record?: KnowledgeRecord;
  } | null;
  if (!body || !body.dataset || !DATASETS.includes(body.dataset)) {
    return NextResponse.json({ error: 'dataset 값이 올바르지 않습니다.' }, { status: 400 });
  }
  const { dataset, op } = body;
  const idField = ID_FIELD[dataset];
  const nfc = (s: unknown) => String(s ?? '').trim().normalize('NFC');

  const items = currentItems(dataset).map(x => ({ ...x }));
  let next: KnowledgeRecord[];

  if (op === 'delete') {
    const target = nfc(body.id);
    next = items.filter(x => nfc(x[idField]) !== target);
    if (next.length === items.length) {
      return NextResponse.json({ error: `삭제 대상을 찾지 못했습니다: ${idField}="${body.id}"` }, { status: 404 });
    }
  } else if (op === 'update') {
    if (!body.record) return NextResponse.json({ error: 'record 가 필요합니다.' }, { status: 400 });
    const target = nfc(body.id);
    const idx = items.findIndex(x => nfc(x[idField]) === target);
    if (idx < 0) return NextResponse.json({ error: `수정 대상을 찾지 못했습니다: ${idField}="${body.id}"` }, { status: 404 });
    next = items.slice();
    next[idx] = body.record;
  } else if (op === 'create') {
    if (!body.record) return NextResponse.json({ error: 'record 가 필요합니다.' }, { status: 400 });
    next = [...items, body.record];
  } else {
    return NextResponse.json({ error: 'op 값이 올바르지 않습니다.' }, { status: 400 });
  }

  const valid = validateDataset(dataset, next);
  if (!valid.ok) {
    return NextResponse.json({ error: '검증 실패', details: valid.errors }, { status: 422 });
  }

  writeKnowledgeDataset(dataset, valid.data);
  return NextResponse.json({ ok: true, dataset, count: valid.data.length, items: valid.data });
}
