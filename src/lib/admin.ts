/**
 * 관리자 게이팅 헬퍼 (서버 전용) — 지식 데이터(test-items·knowledge·템플릿) 편집/가져오기 라우트용.
 * 실제 계정 role(ADMIN·CENTER_LEAD·TEAM_LEAD·레거시 admin)이어야 통과한다. 데모 계정(임정모)은 admin.
 * 인증(C1) 전환 시 getCurrentUser 내부(currentUserId)만 세션 기반으로 바뀐다.
 */
import { getCurrentUser } from './admin/view';
import { isAdminRole } from './admin/roles';

export type SessionUser = { id?: string; email?: string | null; name?: string | null; role?: string };

/** 현재 유저가 관리자면 user 를 반환, 아니면 null. */
export async function getAdmin(): Promise<SessionUser | null> {
  const u = await getCurrentUser();
  if (!isAdminRole(u.role)) return null;
  return { id: String(u.id), email: u.email, name: u.name, role: u.role };
}
