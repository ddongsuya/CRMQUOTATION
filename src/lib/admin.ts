/**
 * 관리자 게이팅 헬퍼 (서버 전용).
 * 쓰기 API(지식 데이터 편집·가져오기)는 관리자(role==='admin')만 허용한다.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type SessionUser = { id?: string; email?: string | null; name?: string | null; role?: string };

/** 현재 세션이 관리자면 user 를 반환, 아니면 null. */
export async function getAdmin(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user || user.role !== 'admin') return null;
  return user;
}
