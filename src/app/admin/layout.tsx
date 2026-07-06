import { redirect } from 'next/navigation';
import AdminChrome from '@/components/admin/AdminChrome';
import { getViewMode, getCurrentUser } from '@/lib/admin/view';
import { roleLabel } from '@/lib/admin/roles';

/** /admin/* 게이트 — 관리자 뷰가 아니면 홈으로. 데모: demoView=user 쿠키면 차단. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const view = await getViewMode();
  if (!view.isAdminView) redirect('/');
  const u = await getCurrentUser();

  const scopeLabel =
    u.role === 'ADMIN' ? '전사 조회 권한'
    : u.role === 'CENTER_LEAD' ? '센터 조회 권한'
    : u.role === 'TEAM_LEAD' ? '팀 조회 권한'
    : '전사 조회 권한';

  return (
    <AdminChrome user={{ name: u.name ?? '관리자', roleLabel: roleLabel(u.role), scopeLabel }}>
      {children}
    </AdminChrome>
  );
}
