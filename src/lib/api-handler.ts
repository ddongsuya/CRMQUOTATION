/**
 * API 라우트 공통 오류 래퍼.
 *
 *  export const GET = withErrorHandling(async (req, ctx) => { ... });
 *
 *  · 예외를 잡아 console.error + Sentry(설정된 경우)로 보내고, 사용자에게는 한국어 JSON 오류를 돌려준다.
 *  · Prisma 알려진 오류는 상태코드로 매핑: P2025(없음)→404, P2002(중복)→409, P2003(참조 무결성)→409,
 *    P2028(트랜잭션 타임아웃)·DB 연결 실패→503(재시도 안내).
 *  · 라우트가 스스로 처리한 오류(try/catch 후 NextResponse 반환)는 그대로 통과한다.
 */
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';

type Handler<Req extends Request, Ctx> = (req: Req, ctx: Ctx) => Promise<Response> | Response;

export type ApiErrorBody = { error: string; code?: string; retryable?: boolean };

/** 라우트 내부에서 의도적으로 상태코드를 지정해 던질 때 사용. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function mapError(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof ApiError) return { status: err.status, body: { error: err.message, code: err.code } };
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2025': return { status: 404, body: { error: '대상을 찾을 수 없습니다.', code: err.code } };
      case 'P2002': return { status: 409, body: { error: '이미 존재하는 값입니다.', code: err.code } };
      case 'P2003': return { status: 409, body: { error: '다른 데이터가 참조하고 있어 처리할 수 없습니다.', code: err.code } };
      case 'P2028': return { status: 503, body: { error: '처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.', code: err.code, retryable: true } };
      default: break;
    }
  }
  if (err instanceof Prisma.PrismaClientInitializationError || (err instanceof Error && /Can't reach database server/i.test(err.message))) {
    return { status: 503, body: { error: '데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', code: 'DB_UNREACHABLE', retryable: true } };
  }
  if (err instanceof SyntaxError) return { status: 400, body: { error: '요청 본문 형식이 올바르지 않습니다.', code: 'BAD_JSON' } };
  return { status: 500, body: { error: '서버 오류가 발생했습니다. 문제가 계속되면 관리자에게 알려 주세요.', code: 'INTERNAL' } };
}

export function withErrorHandling<Req extends Request = Request, Ctx = unknown>(handler: Handler<Req, Ctx>): (req: Req, ctx: Ctx) => Promise<Response> {
  return async (req: Req, ctx: Ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const { status, body } = mapError(err);
      const route = (() => { try { return new URL(req.url).pathname; } catch { return '?'; } })();
      console.error(`[api] ${req.method} ${route} → ${status}`, err);
      if (status >= 500) {
        Sentry.captureException(err, { tags: { route, method: req.method }, extra: { status } });
      }
      return NextResponse.json(body, { status });
    }
  };
}
