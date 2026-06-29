/**
 * 견적 엔진 v2 — 시험항목 상세(인쇄 부록용).
 *  POST { ids } → 446 마스터 구조화 필드(동물종·군구성·투여기간) + _guidelines.json 조인(시험목적·시험설계 checklist) + 주의사항.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getItem } from '@/lib/quote-engine/master';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GL_CACHE: Record<string, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function guidelineMap(): Record<string, any> {
  if (GL_CACHE) return GL_CACHE;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', '_guidelines.json'), 'utf8'));
    const arr = Array.isArray(raw.guidelines) ? raw.guidelines : Object.values(raw.guidelines ?? {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of arr as any[]) if (g?.code) m[g.code] = g;
    GL_CACHE = m;
  } catch { GL_CACHE = {}; }
  return GL_CACHE;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = body?.ids ?? [];
  const GL = guidelineMap();
  const details = ids.map(id => {
    const it = getItem(id);
    if (!it) return null;
    const codes = (it.guidelineCode ?? '').split(/[,;]/).map(c => c.trim()).filter(Boolean);
    const gl = codes.map(c => GL[c]).find(Boolean);
    // checklist(시험설계) → {label,value} 배열. null/빈값 제외.
    const checklist = gl?.checklist && typeof gl.checklist === 'object'
      ? Object.entries(gl.checklist).filter(([, v]) => v != null && String(v).trim() !== '' && String(v) !== 'null')
        .map(([label, v]) => ({ label: String(label).replace(/_/g, ' '), value: String(v) }))
      : [];
    const guideline = [it.guidelineCode, it.guidelineSummary].filter(Boolean).join(' — ') || null;
    return {
      key: it.id, testName: it.testName ?? undefined, category: it.category ?? null,
      studyWeeks: it.studyWeeks ?? null,
      species: it.species ?? null, groupComposition: it.groupComposition ?? null, dosingPeriod: it.dosingPeriod ?? null,
      purpose: gl?.purpose ?? null, checklist,
      detail: it.detail ?? null, notice: it.notice ?? null, guideline,
    };
  }).filter(Boolean);
  return NextResponse.json({ details });
}
