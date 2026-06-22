/**
 * 현재 로그인 유저의 DB id (CRM 데이터 소유 ownerId).
 *
 * ⚠️ DEMO(임시): 로그인 OFF — 데모 계정(admin) 소유로 고정 처리.
 *    정식 인증(Phase 5) 시 getServerSession 으로 세션 유저 id 를 쓰도록 교체.
 */
import { prisma } from './prisma';

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'admin@chemon.co.kr';
let demoIdCache: number | null = null;

/** 현재 유저 id. DEMO 모드에선 데모 계정(없으면 생성) id 반환. */
export async function currentUserId(): Promise<number> {
  if (demoIdCache != null) return demoIdCache;
  const u = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: '데모', role: 'admin', passwordHash: 'demo' },
  });
  demoIdCache = u.id;
  return u.id;
}

/**
 * 조회 가능한 ownerId 목록 (role 기반 — 요구 #2).
 * DEMO 단계: 본인만. 정식 전환 시 role(MEMBER/TEAM_LEAD/CENTER_LEAD/ADMIN)에 따라
 * 팀/센터/전체로 확장한다. (지금은 항상 [본인])
 */
export async function visibleOwnerIds(): Promise<number[]> {
  return [await currentUserId()];
}
