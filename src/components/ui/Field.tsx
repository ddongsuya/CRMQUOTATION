'use client';

/**
 * 폼 필드 공용 래퍼 — 라벨·필수 표시·힌트·오류를 한 곳에서 그리고 접근성 속성을 자동 연결한다.
 *
 *   <Field label="고객사" required error={errors.company}>
 *     {(a) => <input {...a} className="input" value={v} onChange={...} />}
 *   </Field>
 *
 *  · children 은 render-prop: id / aria-describedby / aria-invalid / aria-required 를 받아 입력 요소에 전개한다.
 *  · placeholder 를 라벨 대신 쓰지 않는다 — 라벨은 항상 보이거나(기본) srOnly 로 숨긴다.
 */
import { useId, type ReactNode } from 'react';

export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  srOnlyLabel?: boolean;
  className?: string;
  children: (a: FieldControlProps) => ReactNode;
};

export default function Field({ label, required, hint, error, srOnlyLabel, className, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className={srOnlyLabel ? 'sr-only' : 'label'}>
        {label}{required && <span aria-hidden="true" className="ml-0.5" style={{ color: 'var(--accent-press)' }}>*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {error && <p id={errId} role="alert" className="mt-1 text-[12px]" style={{ color: 'var(--error)' }}>{error}</p>}
      {hint && !error && <p id={hintId} className="mt-1 text-[12px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** 자주 쓰는 형태 — 텍스트 input 한 줄. */
export function TextField({ label, value, onChange, type = 'text', placeholder, required, hint, error, className, inputClassName, autoComplete, disabled, onBlur, onKeyDown }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; hint?: string; error?: string | null;
  className?: string; inputClassName?: string; autoComplete?: string; disabled?: boolean; onBlur?: () => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(a) => (
        <input {...a} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={inputClassName ?? 'input'} autoComplete={autoComplete} disabled={disabled} onBlur={onBlur} onKeyDown={onKeyDown} />
      )}
    </Field>
  );
}
