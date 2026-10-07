import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

import { withErrorHandling } from '@/lib/api-handler';
/**
 * 자가 가입 — 기본은 닫혀 있다.
 *
 * 이메일 인증 없는 자가 가입은 "회사 도메인처럼 보이는 아무 주소"로 계정을 만들 수 있어 외부인 진입로가 된다.
 * 또 예전엔 첫 가입자를 admin 으로 만들어서, DB 를 새로 만들면 처음 들어온 사람이 관리자가 됐다.
 * 그래서: REGISTRATION_OPEN=1 일 때만 열고, 허용 도메인(ALLOWED_EMAIL_DOMAINS, 기본 csco.co.kr)만 받고,
 * role 은 항상 MEMBER 로 만든다. 계정은 원칙적으로 관리자가 scripts/set-password.js 로 발급한다.
 */
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'csco.co.kr')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

async function _POST(req: Request) {
  if (process.env.REGISTRATION_OPEN !== '1') {
    return NextResponse.json({ error: '가입이 닫혀 있습니다. 관리자에게 계정 발급을 요청해 주세요.' }, { status: 403 });
  }
  const { email: rawEmail, name, password } = await req.json() as { email?: string; name?: string; password?: string };
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !name || !password || password.length < 8) {
    return NextResponse.json({ error: '이메일·이름·비밀번호(8자 이상) 필수' }, { status: 400 });
  }
  const domain = email.split('@')[1] ?? '';
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: `회사 메일(${ALLOWED_DOMAINS.join(', ')})로만 가입할 수 있습니다.` }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name, passwordHash, role: 'MEMBER' } });
  return NextResponse.json({ ok: true, role: 'MEMBER' });
}

export const POST = withErrorHandling(_POST);
