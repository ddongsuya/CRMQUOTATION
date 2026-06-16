import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * Minimal self-registration. In production this should be admin-gated or
 * tied to a corporate email allow-list — for now it's open so the team can
 * seed their own accounts.
 */
export async function POST(req: Request) {
  const { email, name, password } = await req.json() as { email?: string; name?: string; password?: string };
  if (!email || !name || !password || password.length < 6) {
    return NextResponse.json({ error: '이메일·이름·비밀번호(6자 이상) 필수' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  // First user becomes admin; subsequent are regular users.
  const totalUsers = await prisma.user.count();
  const role = totalUsers === 0 ? 'admin' : 'user';
  await prisma.user.create({ data: { email, name, passwordHash, role } });
  return NextResponse.json({ ok: true, role });
}
