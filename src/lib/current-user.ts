/**
 * 현재 로그인 유저의 DB id (CRM 데이터 소유 ownerId).
 *
 * 세션(next-auth JWT)의 uid 를 쓴다. 세션이 없으면 401(ApiError)을 던진다 —
 * 예전엔 세션이 없어도 데모 계정(admin)으로 처리해서, 미들웨어가 꺼진 순간 전 API 가 관리자 권한으로 열렸다.
 * 미들웨어가 1차로 막고, 여기서 2차로 막는다(미들웨어 우회 취약점 CVE-2025-29927 류 대비).
 *
 * 로컬 개발에서 AUTH_DISABLED=1 이면 예전처럼 데모 계정으로 동작한다(운영에선 auth-mode 가 무시).
 */
import { getServerSession } from 'next-auth';
import { prisma } from './prisma';
import { authOptions } from './auth';
import { authDisabled } from './auth-mode';
import { ApiError } from './api-handler';

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'gathering@csco.co.kr';
let demoIdCache: number | null = null;

async function demoUserId(): Promise<number> {
  if (demoIdCache != null) return demoIdCache;
  const u = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: '데모', role: 'admin', passwordHash: 'demo' },
  });
  demoIdCache = u.id;
  return u.id;
}

/** 세션 유저 id. 로그인 안 했으면 null (로그인 화면처럼 비로그인도 렌더해야 하는 곳용). */
export async function currentUserIdOrNull(): Promise<number | null> {
  if (authDisabled()) return demoUserId();
  const session = await getServerSession(authOptions);
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** 현재 유저 id. 로그인 안 했으면 401. */
export async function currentUserId(): Promise<number> {
  const id = await currentUserIdOrNull();
  if (id == null) throw new ApiError(401, '로그인이 필요합니다.', 'UNAUTHENTICATED');
  return id;
}

/**
 * 조회 가능한 ownerId 목록 (role 기반 — 요구 #2).
 * 현재: 본인만. role(MEMBER/TEAM_LEAD/CENTER_LEAD/ADMIN)에 따른 팀/센터/전체 확장은 별도 작업.
 */
export async function visibleOwnerIds(): Promise<number[]> {
  return [await currentUserId()];
}
