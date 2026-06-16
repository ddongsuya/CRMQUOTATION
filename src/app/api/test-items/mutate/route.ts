/**
 * POST /api/test-items/mutate — 시험항목·가격 1건 편집 (관리자 전용)
 *
 * body: { op, key?, record? }
 *   op     : 'update' | 'create' | 'delete'
 *   key    : update/delete 대상의 key
 *   record : update/create 시 새 레코드 전체
 *
 * 저장 전 zod 로 전체 배열을 재검증 → 잘못된 가격/중복 key 차단. 성공 시 캐시 무효화.
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadData, writeTestItems, type TestItem } from '@/lib/data';
import { validateTestItems, type TestItemRecord } from '@/lib/test-items-schema';

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 편집할 수 있습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    op?: 'update' | 'create' | 'delete'; key?: string; record?: TestItemRecord;
  } | null;
  if (!body || !body.op) return NextResponse.json({ error: 'op 가 필요합니다.' }, { status: 400 });

  const nfc = (s: unknown) => String(s ?? '').trim().normalize('NFC');
  const items = (loadData().testItems as unknown as TestItemRecord[]).map(x => ({ ...x }));
  let next: TestItemRecord[];

  if (body.op === 'delete') {
    const target = nfc(body.key);
    next = items.filter(x => nfc(x.key) !== target);
    if (next.length === items.length) {
      return NextResponse.json({ error: `삭제 대상을 찾지 못했습니다: key="${body.key}"` }, { status: 404 });
    }
  } else if (body.op === 'update') {
    if (!body.record) return NextResponse.json({ error: 'record 가 필요합니다.' }, { status: 400 });
    const target = nfc(body.key);
    const idx = items.findIndex(x => nfc(x.key) === target);
    if (idx < 0) return NextResponse.json({ error: `수정 대상을 찾지 못했습니다: key="${body.key}"` }, { status: 404 });
    next = items.slice();
    next[idx] = body.record;
  } else if (body.op === 'create') {
    if (!body.record) return NextResponse.json({ error: 'record 가 필요합니다.' }, { status: 400 });
    next = [...items, body.record];
  } else {
    return NextResponse.json({ error: 'op 값이 올바르지 않습니다.' }, { status: 400 });
  }

  const valid = validateTestItems(next);
  if (!valid.ok) return NextResponse.json({ error: '검증 실패', details: valid.errors }, { status: 422 });

  writeTestItems(valid.data as unknown as TestItem[]);
  return NextResponse.json({ ok: true, count: valid.data.length });
}
