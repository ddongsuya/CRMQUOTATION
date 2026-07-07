'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import CompanyDrawer from './CompanyDrawer';

type DrawerCtx = { openCompany: (name: string) => void };
const Ctx = createContext<DrawerCtx>({ openCompany: () => {} });
export const useDrawer = () => useContext(Ctx);

/** 슬라이드오버 드로어 컨텍스트 — 어느 화면에서든 회사명 클릭 시 상세를 연다.
 *  showFullPage: 관리자 뷰만 '전체 페이지로 열기' 노출(사용자 뷰는 드로어로 충분). */
export default function DrawerProvider({ children, showFullPage = true }: { children: React.ReactNode; showFullPage?: boolean }) {
  const [name, setName] = useState<string | null>(null);
  const openCompany = useCallback((n: string) => setName(n), []);
  return (
    <Ctx.Provider value={{ openCompany }}>
      {children}
      <CompanyDrawer name={name} onClose={() => setName(null)} showFullPage={showFullPage} />
    </Ctx.Provider>
  );
}
