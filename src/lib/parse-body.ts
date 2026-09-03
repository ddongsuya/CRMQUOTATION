/**
 * 요청 본문 → zod 스키마 검증 헬퍼.
 *
 *  const parsed = await parseBody(req, companyCreateSchema);
 *  if (!parsed.ok) return parsed.res;      // 400 { error, code: 'VALIDATION', issues }
 *  const b = parsed.data;                  // 스키마 출력 타입
 *
 *  · JSON 파싱 실패·객체가 아닌 본문은 {} 로 취급 — 기존 라우트의 `req.json().catch(() => null|{})` 관용을 유지해
 *    "필수값 누락" 메시지가 그대로 나오게 한다 (PATCH 는 빈 수정 = 예전과 같이 no-op).
 *  · error 는 첫 번째 이슈의 한국어 메시지, issues 는 전체 목록(path 는 'a.b.0' 형식).
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export type ValidationIssue = { path: string; message: string };
export type ParsedBody<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

export async function parseBody<T>(req: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<ParsedBody<T>> {
  const raw: unknown = await req.json().catch(() => null);
  const input = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const issues: ValidationIssue[] = r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
  return {
    ok: false,
    res: NextResponse.json(
      { error: issues[0]?.message ?? '입력값이 올바르지 않습니다.', code: 'VALIDATION', issues },
      { status: 400 },
    ),
  };
}
