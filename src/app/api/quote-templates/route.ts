/**
 * GET  /api/quote-templates            — 전체 템플릿 + 편집권한
 * GET  /api/quote-templates?modality=X — 해당 모달리티 템플릿만
 * POST /api/quote-templates            — 전체 저장 (관리자 전용)
 */
import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { loadQuoteTemplates, templatesForModality, writeQuoteTemplates, type QuoteTemplate } from '@/lib/quote-templates';
import { getItemByKey } from '@/lib/data';
import { ensureHydrated } from '@/lib/hydrate';

export async function GET(req: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(req.url);
  const modality = searchParams.get('modality');
  if (modality) return NextResponse.json({ templates: templatesForModality(modality) });
  const admin = await getAdmin();
  return NextResponse.json({ templates: loadQuoteTemplates(), isAdmin: !!admin });
}

export async function POST(req: Request) {
  await ensureHydrated();
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: '관리자만 편집할 수 있습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null) as { templates?: QuoteTemplate[] } | null;
  const templates = body?.templates;
  if (!Array.isArray(templates)) return NextResponse.json({ error: 'templates 가 올바르지 않습니다.' }, { status: 400 });

  const errors: string[] = [];
  const seenId = new Set<string>();
  const clean: QuoteTemplate[] = [];
  templates.forEach((t, i) => {
    const name = String(t.name ?? '').trim();
    const modality = String(t.modality ?? '').trim();
    if (!name) { errors.push(`#${i + 1} 템플릿 이름이 비어있습니다.`); return; }
    if (!modality) { errors.push(`'${name}' 의 모달리티가 비어있습니다.`); return; }
    let id = String(t.id ?? '').trim();
    if (!id || seenId.has(id)) id = `tpl-${Date.now()}-${i}`;
    seenId.add(id);
    const tests = (Array.isArray(t.tests) ? t.tests : [])
      .map(x => ({ key: String(x.key ?? '').trim(), quantity: Math.max(1, Math.floor(Number(x.quantity) || 1)) }))
      .filter(x => x.key && getItemByKey(x.key));   // 존재하는 항목만
    clean.push({ id, name, modality, scenario: String(t.scenario ?? '').trim(), tests });
  });

  if (errors.length) return NextResponse.json({ error: '검증 실패', details: errors }, { status: 422 });

  await writeQuoteTemplates(clean);
  return NextResponse.json({ ok: true, templates: clean });
}
