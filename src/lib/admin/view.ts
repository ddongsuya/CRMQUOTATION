/**
 * 관리자 대시보드 — 뷰 모드(데모 role 토글) · 현재 유저.
 *
 * 사용자 결정사항: 데모 노출 = "데모용 role 토글(관리자로 보기)".
 *  · 정식 로그인 전환 시 실제 User.role 로 판별(아래 actualRole).
 *  · 데모 단계: 쿠키 `demoView`(admin|user)로 관리자/일반 화면을 미리보기.
 *    - 실제 계정이 관리자여야 'admin' 뷰 가능(비관리자는 토글해도 개인 범위).
 */
import { cookies } from 'next/headers';
import { prisma } from '../prisma';
import { currentUserId } from '../current-user';
import { isAdminRole } from './roles';

export const DEMO_VIEW_COOKIE = 'demoView';

export type CurrentUser = { id: number; name: string | null; email: string; role: string; centerId: number | null };

/** 현재 유저 전체 레코드(role·centerId 포함). */
export async function getCurrentUser(): Promise<CurrentUser> {
  const id = await currentUserId();
  const u = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, email: true, role: true, centerId: true },
  });
  return u;
}

export type ViewMode = {
  actualRole: string;        // 실제 role
  actualIsAdmin: boolean;    // 실제로 관리자 계정인가(토글 가능 여부)
  isAdminView: boolean;      // 지금 관리자 화면으로 보고 있는가(집계/전사)
  centerId: number | null;   // 본인 소속 센터(개인/기본 스코프용)
};

/** 현재 뷰 모드 계산(쿠키 우선, 없으면 실제 role). */
export async function getViewMode(): Promise<ViewMode> {
  const u = await getCurrentUser();
  const actualIsAdmin = isAdminRole(u.role);
  const cookie = cookies().get(DEMO_VIEW_COOKIE)?.value;
  // 비관리자는 절대 admin 뷰 불가. 관리자는 쿠키로 admin/user 미리보기.
  const isAdminView = actualIsAdmin && cookie !== 'user';
  return { actualRole: u.role, actualIsAdmin, isAdminView, centerId: u.centerId };
}
