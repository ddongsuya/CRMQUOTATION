'use client';

/**
 * 빈 상태 · 오류 상태 · 로딩 상태 공용 컴포넌트.
 * 화면마다 문구·위치·아이콘이 달랐던 것을 통일하고, 빈 상태에는 항상 "첫 행동" 버튼을 붙일 수 있게 한다.
 *
 *   <EmptyState title="아직 고객사가 없습니다" description="첫 고객사를 등록하면 견적·기록이 이곳에 모입니다."
 *               action={{ label: '고객사 추가', onClick: openNew }} />
 *   <ErrorState message={loadError} onRetry={load} />
 *   <LoadingState label="견적 불러오는 중" />
 */
import Link from 'next/link';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

type Action = { label: string; onClick?: () => void; href?: string };

function ActionButton({ a, primary }: { a: Action; primary?: boolean }) {
  const cls = primary ? 'btn-primary h-9 px-4 text-[13px]' : 'btn-ghost h-9 text-[13px]';
  if (a.href) return <Link href={a.href} className={cls}>{a.label}</Link>;
  return <button type="button" onClick={a.onClick} className={cls}>{a.label}</button>;
}

export function EmptyState({ icon, title, description, action, secondary, compact }: {
  icon?: ReactNode; title: string; description?: string; action?: Action; secondary?: Action; compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--card-cream)', color: 'var(--muted)' }} aria-hidden="true">
        {icon ?? <Inbox className="w-5 h-5" />}
      </div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description && <p className="text-[13px] text-ink-muted mt-1 max-w-[36ch] leading-relaxed">{description}</p>}
      {(action || secondary) && (
        <div className="flex items-center gap-2 mt-4">
          {action && <ActionButton a={action} primary />}
          {secondary && <ActionButton a={secondary} />}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact }: { message?: string | null; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}>
      <AlertCircle className="w-6 h-6 mb-2" style={{ color: 'var(--error)' }} aria-hidden="true" />
      <p className="text-[14px] font-semibold text-ink">불러오지 못했습니다</p>
      <p className="text-[13px] text-ink-muted mt-1 max-w-[40ch]">{message || '일시적인 연결 문제일 수 있습니다.'}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-ghost h-9 text-[13px] mt-4">다시 시도</button>}
    </div>
  );
}

export function LoadingState({ label = '불러오는 중', compact }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 text-[13px] text-ink-subtle ${compact ? 'py-6' : 'py-12'}`}>
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />{label}…
    </div>
  );
}
