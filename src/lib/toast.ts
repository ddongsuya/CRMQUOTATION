'use client';

import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export type Toast = { id: number; kind: ToastKind; message: string };

type ToastStore = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error:   (m: string) => useToasts.getState().push('error', m),
  info:    (m: string) => useToasts.getState().push('info', m),
  warning: (m: string) => useToasts.getState().push('warning', m),
};
