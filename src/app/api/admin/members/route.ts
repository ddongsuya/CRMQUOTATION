import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin/guard';

import { withErrorHandling } from '@/lib/api-handler';
/** 구성원 추가 — 관리자 뷰 전용. { name, role, centerId }. 데모: 비밀번호 'demo' 고정. */
async function _POST(req: Request) {
  const denied = await requireAdmin(); if (denied) return denied;

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

export const POST = withErrorHandling(_POST);
