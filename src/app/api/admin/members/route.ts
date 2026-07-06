import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/admin/view';

/** 구성원 추가 — 관리자 뷰 전용. { name, role, centerId }. 데모: 비밀번호 'demo' 고정. */
export async function POST(req: Request) {
  const view = await getViewMode();
  if (!view.isAdminView) return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? '').toString().trim();
  const role = (body?.role ?? 'MEMBER').toString();
  const centerId = body?.centerId != null ? Number(body.centerId) : null;
  if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });
  if (!['MEMBER', 'TEAM_LEAD', 'CENTER_LEAD', 'ADMIN'].includes(role)) return NextResponse.json({ error: '직책 오류' }, { status: 400 });

  const email = `member_${Date.now().toString(36)}@chemon.co.kr`;
  const user = await prisma.user.create({
    data: { name, email, role, centerId: Number.isFinite(centerId) ? centerId : null, passwordHash: 'demo' },
    select: { id: true, name: true, role: true, centerId: true },
  });
  return NextResponse.json({ ok: true, user });
}
