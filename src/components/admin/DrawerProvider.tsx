'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import CompanyDrawer from './CompanyDrawer';

type DrawerCtx = { openCompany: (name: string) => void };
const Ctx = createContext<DrawerCtx>({ openCompany: () => {} });
export const useDrawer = () => useContext(Ctx);

/** 슬라이드오버 드로어 컨텍스트 — 어느 화면에서든 회사명 클릭 시 상세를 연다. */
export default function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const openCompany = useCallback((n: string) => setName(n), []);
  return (
    <Ctx.Provider value={{ openCompany }}>
      {children}
      <CompanyDrawer name={name} onClose={() => setName(null)} />
    </Ctx.Provider>
  );
}
