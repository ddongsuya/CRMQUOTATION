'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import EntityDrawer from './EntityDrawer';

export type Frame =
  | { type: 'company'; key: string }
  | { type: 'quote'; key: number }
  | { type: 'report'; key: number };

type DrawerCtx = {
  openCompany: (name: string) => void;
  openQuote: (id: number) => void;
  openReport: (id: number) => void;
  back: () => void;
  close: () => void;
};
const Ctx = createContext<DrawerCtx>({ openCompany: () => {}, openQuote: () => {}, openReport: () => {}, back: () => {}, close: () => {} });
export const useDrawer = () => useContext(Ctx);

/** 스택형 상세 드로어 — 회사·견적·기록을 서로 왕복(뒤로가기). showFullPage=관리자만 전체 페이지. */
export default function DrawerProvider({ children, showFullPage = true }: { children: React.ReactNode; showFullPage?: boolean }) {
  const [stack, setStack] = useState<Frame[]>([]);
  const openCompany = useCallback((name: string) => setStack((s) => [...s, { type: 'company', key: name }]), []);
  const openQuote = useCallback((id: number) => setStack((s) => [...s, { type: 'quote', key: id }]), []);
  const openReport = useCallback((id: number) => setStack((s) => [...s, { type: 'report', key: id }]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  return (
    <Ctx.Provider value={{ openCompany, openQuote, openReport, back, close }}>
      {children}
      <EntityDrawer stack={stack} back={back} close={close} showFullPage={showFullPage} />
    </Ctx.Provider>
  );
}
