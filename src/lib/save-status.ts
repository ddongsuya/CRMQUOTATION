'use client';

/**
 * 화면 공통 "저장 상태" — 상단바 배지(components/SaveStatus.tsx)가 표시한다.
 * 이전 상단바의 "자동 저장됨" 은 아무 로직에도 연결되지 않은 고정 문구였다. 이제 각 화면이 실제 상태를 보고한다.
 *
 *   saveStatus.dirty('브라우저에 임시 보관')   — 서버에 아직 저장되지 않은 변경이 있음
 *   saveStatus.saving()                        — 서버 저장 중
 *   saveStatus.saved('26-09-DL-0125')          — 서버 저장 완료(라벨 = 견적번호 등)
 *   saveStatus.error('네트워크 오류')          — 저장 실패(사용자는 다시 시도 가능)
 *   saveStatus.reset()                         — 화면 이탈 시(AppChrome 이 경로 변경마다 호출)
 */
import { create } from 'zustand';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type Store = {
  state: SaveState;
  label: string | null;
  at: number | null;
  set: (state: SaveState, label?: string | null) => void;
  reset: () => void;
};

export const useSaveStatus = create<Store>((set) => ({
  state: 'idle', label: null, at: null,
  set: (state, label = null) => set({ state, label, at: Date.now() }),
  reset: () => set({ state: 'idle', label: null, at: null }),
}));

export const saveStatus = {
  dirty: (label?: string) => useSaveStatus.getState().set('dirty', label ?? null),
  saving: (label?: string) => useSaveStatus.getState().set('saving', label ?? null),
  saved: (label?: string) => useSaveStatus.getState().set('saved', label ?? null),
  error: (label?: string) => useSaveStatus.getState().set('error', label ?? null),
  reset: () => useSaveStatus.getState().reset(),
};
