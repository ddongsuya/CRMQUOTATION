/**
 * 관리자 API 가드 — 라우트 첫 줄에서 호출한다.
 *
 *  · requireAdmin()      : 실제 계정 role 이 관리자(ADMIN·CENTER_LEAD·TEAM_LEAD·admin)여야 통과.
 *                          쓰기(구성원·목표·일일보고·가져오기 등)는 데모 뷰 토글과 무관하게 실제 role 로 판정.
 *  · adminReadScope()    : 읽기(드로어·검색)용. 관리자 뷰면 전사(undefined), 아니면 본인 소유 id 목록.
 *
 * 사용법:
 *   const denied = await requireAdmin(); if (denied) return denied;
 *   const uids = await adminReadScope();   // undefined = 전사, number[] = 본인 범위
 *
 * 인증(C1)을 켜기 전에도 배포 URL 만 알면 전사 실적이 열리는 상태를 막기 위한 최소 가드.
 * 정식 로그인 전환 시 getViewMode 내부가 세션 유저로 바뀌므로 이 파일은 그대로 유효하다.
 */
import { NextResponse } from 'next/server';
import { getViewMode } from './view';
import { visibleOwnerIds } from '../current-user';

export const FORBIDDEN_MESSAGE = '관리자만 사용할 수 있습니다.';

export function forbidden(message = FORBIDDEN_MESSAGE): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** 실제 role 기준 관리자 검사. 통과하면 null, 아니면 403 응답. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const view = await getViewMode();
  return view.actualIsAdmin ? null : forbidden();
}

/** 관리자 "뷰"(데모 토글 포함) 기준 검사. 집계 화면처럼 미리보기가 의미 있는 읽기 전용 라우트용. */
export async function requireAdminView(): Promise<NextResponse | null> {
  const view = await getViewMode();
  return view.isAdminView ? null : forbidden();
}

/** 읽기 스코프: 관리자 뷰 → undefined(전사), 일반 → 본인이 볼 수 있는 ownerId 목록. */
export async function adminReadScope(): Promise<number[] | undefined> {
  const view = await getViewMode();
  if (view.isAdminView) return undefined;
  return visibleOwnerIds();
}
