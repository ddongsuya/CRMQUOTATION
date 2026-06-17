/**
 * GET  /api/modality-templates  — 모달리티 템플릿 구성 + 편집권한 + 선택 가능한 key 목록
 * POST /api/modality-templates  — 전체 구성 저장 (관리자 전용)
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadModalityTemplates, writeModalityTemplates, type TemplateCategory } from '@/lib/modality-templates';
import { allModalityKeys } from '@/lib/modality-config';

export async function GET() {
  const admin = await getAdmin();
  return NextResponse.json({
    categories: loadModalityTemplates(),
    availableKeys: allModalityKeys(),
    isAdmin: !!admin,
  });
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 편집할 수 있습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null) as { categories?: TemplateCategory[] } | null;
  const categories = body?.categories;
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: 'categories 가 올바르지 않습니다.' }, { status: 400 });
  }

  // 검증: 분류 id/label, 모달리티 key 유효성·중복
  const valid = new Set(allModalityKeys());
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  const clean: TemplateCategory[] = [];
  categories.forEach((c, ci) => {
    const id = String(c.id ?? '').trim();
    const label = String(c.label ?? '').trim();
    if (!label) { errors.push(`#${ci + 1} 분류 이름이 비어있습니다.`); return; }
    const mods = Array.isArray(c.modalities) ? c.modalities : [];
    const cleanMods = [];
    for (const m of mods) {
      const key = String(m.key ?? '').trim();
      if (!key) continue;
      if (!valid.has(key)) { errors.push(`'${label}' 의 모달리티 key "${key}" 가 유효하지 않습니다.`); continue; }
      if (seenKeys.has(key)) { errors.push(`모달리티 key "${key}" 가 중복되었습니다.`); continue; }
      seenKeys.add(key);
      cleanMods.push({ key, label: String(m.label ?? key).trim() || key, desc: String(m.desc ?? '').trim(), source: String(m.source ?? '').trim() });
    }
    clean.push({ id: id || `cat-${ci + 1}`, label, modalities: cleanMods });
  });

  if (errors.length) return NextResponse.json({ error: '검증 실패', details: errors }, { status: 422 });

  writeModalityTemplates(clean);
  return NextResponse.json({ ok: true, categories: clean });
}
