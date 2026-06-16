/**
 * 관리자 게이팅 헬퍼 (서버 전용).
 * 쓰기 API(지식 데이터 편집·가져오기)는 관리자(role==='admin')만 허용한다.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type SessionUser = { id?: string; email?: string | null; name?: string | null; role?: string };

/** 현재 세션이 관리자면 user 를 반환, 아니면 null. */
export async function getAdmin(): Promise<SessionUser | null> {
  // ⚠️ DEMO(임시): 로그인 OFF — 누구나 관리자로 취급(편집 기능 시연용).
  //    정식 배포 시 아래 한 줄 제거하고 그 아래 블록을 복구할 것.
  return { email: 'demo@chemon.co.kr', name: '데모', role: 'admin' };

  /* ───── 정식 배포 복구용 ─────
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== 'admin') return null;
  return user;
  ──────────────────────────── */
}
