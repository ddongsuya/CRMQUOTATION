/**
 * 견적 엔진 v2 — 시험항목 상세(인쇄 부록용).
 *  POST { ids } → 446 마스터 구조화 필드(동물종·군구성·투여기간) + _guidelines.json 조인(시험목적·시험설계 checklist) + 주의사항.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getItem, loadRules } from '@/lib/quote-engine/master';
import { computeDrfTk, drfWeeksFor, assertDrfTkParams, isDrfTkLineId, drfTkLineId, type DrfTkPlan } from '@/lib/quote-engine/drf-tk';

import { withErrorHandling } from '@/lib/api-handler';
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

async function _POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: string[]; plan?: { durations?: string[]; species?: { rodent: boolean; nonRodent: boolean }; addons?: Record<string, boolean>; drfTk?: DrfTkPlan } } | null;
  const ids = body?.ids ?? [];
  // DRF 약식 TK(_drftk_*) 는 마스터 항목이 아니라 산출 라인 — 저장된 plan 으로 상세를 재구성한다.
  const drfExtra: Array<Record<string, unknown>> = [];
  const pl = body?.plan;
  if (pl?.drfTk?.enabled && pl.addons?.drf && ids.some(isDrfTkLineId)) {
    try {
      const rule = ((loadRules()['pricing_formulas'] as Array<Record<string, unknown>>) ?? []).find(r => r.id === 'PF-004');
      const params = assertDrfTkParams(rule?.parameters);
      for (const w of drfWeeksFor(pl.durations ?? [])) for (const sp of (['rodent', 'nonRodent'] as const)) {
        if (!(sp === 'rodent' ? pl.species?.rodent : pl.species?.nonRodent)) continue;
        const key = drfTkLineId(sp, w); if (!ids.includes(key)) continue;
        const r = computeDrfTk(sp, w, pl.drfTk, params);
        drfExtra.push({ key, category: 'TK(독성동태)', species: sp === 'rodent' ? '설치류' : '비설치류', groupComposition: r.groupComposition, dosingPeriod: `${w}주 (DRF)`, studyWeeks: w, detail: r.detail, notice: r.notice, guidelineCodes: ['ICH S3A'] });
      }
    } catch (e) { console.error('[details] drf-tk', e); }
  }
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
  details.push(...(drfExtra as typeof details));
  return NextResponse.json({ details });
}

export const POST = withErrorHandling(_POST);
