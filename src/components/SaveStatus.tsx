'use client';

/**
 * 상단바 저장 상태 배지 — lib/save-status 의 실제 상태만 표시한다. idle 이면 아무것도 그리지 않는다.
 */
import { Loader2, Check, AlertCircle, CircleDashed } from 'lucide-react';
import { useSaveStatus } from '@/lib/save-status';

const hhmm = (t: number | null) => (t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

export default function SaveStatus() {
  const { state, label, at } = useSaveStatus();
  if (state === 'idle') return null;

  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">저장 중…</span>
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite" title={`저장됨 ${hhmm(at)}`}>
        <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} aria-hidden="true" />
        <span className="hidden sm:inline">저장됨{label ? ` · ${label}` : ''} <span className="tabular-nums text-ink-subtle">{hhmm(at)}</span></span>
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5" role="alert" style={{ color: 'var(--error)' }}>
        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">저장 실패{label ? ` · ${label}` : ''}</span>
      </span>
    );
  }
  // dirty — 서버 미저장 변경(브라우저 임시 보관 등)
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite" style={{ color: 'var(--accent-press)' }} title={label ?? '저장되지 않은 변경'}>
      <CircleDashed className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{label ?? '저장되지 않은 변경'}</span>
    </span>
  );
}
