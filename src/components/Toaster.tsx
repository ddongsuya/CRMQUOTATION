'use client';

import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import { useToasts, type ToastKind } from '@/lib/toast';

const ICON: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4" />,
  error:   <XCircle className="w-4 h-4" />,
  info:    <Info className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
};

const STYLE: Record<ToastKind, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  info:    'bg-brand-50 border-brand-200 text-brand-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
};

export default function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'flex items-start gap-2 px-3 py-2 rounded-xl border shadow-md backdrop-blur animate-slide-up text-sm',
            STYLE[t.kind],
          )}
        >
          <span className="flex-shrink-0 mt-0.5">{ICON[t.kind]}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
