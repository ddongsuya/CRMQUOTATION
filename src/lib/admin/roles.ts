/**
 * 관리자 대시보드 — 직책/권한 판별.
 * User.role 값(실 스키마): user · admin(레거시 데모) · MEMBER · TEAM_LEAD · CENTER_LEAD · ADMIN
 * README §0: 대표이사·사업부대표·이사·본부장·센터장·팀장 = 관리자(롤업·전사 조회).
 *  → 매핑: ADMIN(본부장 이상)·CENTER_LEAD(센터장)·TEAM_LEAD(팀장) + 레거시 'admin' = 관리자.
 *          MEMBER·user = 일반(개인 범위 고정).
 */
export const ADMIN_ROLES = new Set(['ADMIN', 'CENTER_LEAD', 'TEAM_LEAD', 'admin']);

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

/** 직책 한글 라벨 (구성원 관리·요약 표시용). */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'ADMIN': return '본부장';
    case 'CENTER_LEAD': return '센터장';
    case 'TEAM_LEAD': return '팀장';
    case 'MEMBER': return '구성원';
    case 'admin': return '관리자';
    default: return '구성원';
  }
}
