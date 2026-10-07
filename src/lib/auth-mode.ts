/**
 * 인증 우회(로컬 개발 전용) 스위치 — middleware(edge)와 current-user(node) 양쪽에서 쓰므로
 * prisma 등 node 전용 의존이 없는 별도 파일로 둔다.
 *
 * AUTH_DISABLED=1 이면 로그인 없이 데모 계정으로 동작한다. 단 Vercel production 에서는
 * 이 값이 있어도 무시한다 — 환경변수 실수 하나로 운영이 다시 공개되는 사고를 막기 위함.
 */
export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === '1' && process.env.VERCEL_ENV !== 'production';
}
