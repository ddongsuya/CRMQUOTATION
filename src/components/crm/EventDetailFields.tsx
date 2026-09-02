'use client';

/**
 * 일정(미팅) 상세 필드 — 장소 · 참여자(고객사/우리 회사) · 요청사항.
 * 캘린더 모달과 고객 상세 일정 탭이 같은 컴포넌트를 써서 필드 구성이 어긋나지 않게 한다(패리티).
 */
export type EventDetail = { location: string; attendeesClient: string; attendeesInternal: string; requests: string };

export default function EventDetailFields({ f, set, dense }: {
  f: EventDetail;
  set: <K extends keyof EventDetail>(k: K, v: EventDetail[K]) => void;
  /** 고객 상세 탭처럼 좁은 폼이면 true (라벨·간격 축소) */
  dense?: boolean;
}) {
  const L = dense ? 'text-[11px] text-ink-subtle' : 'label mb-1';
  const I = dense ? 'input text-sm w-full' : 'input w-full';
  const gap = dense ? 'gap-2' : 'gap-3';
  return (
    <>
      <label className="block">
        <span className={L}>장소</span>
        <input className={I} placeholder="예: 켐온 본사 회의실 / 화상" value={f.location} onChange={e => set('location', e.target.value)} />
      </label>
      <div className={`grid grid-cols-2 ${gap}`}>
        <label className="block">
          <span className={L}>참여자 — 고객사</span>
          <input className={I} placeholder="예: 김OO 팀장, 이OO 연구원" value={f.attendeesClient} onChange={e => set('attendeesClient', e.target.value)} />
        </label>
        <label className="block">
          <span className={L}>참여자 — 우리 회사</span>
          <input className={I} placeholder="예: 임OO, 박OO 책임" value={f.attendeesInternal} onChange={e => set('attendeesInternal', e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className={L}>요청사항</span>
        <textarea className={`${I} min-h-[56px]`} placeholder="미팅에서 나온 요청·준비사항" value={f.requests} onChange={e => set('requests', e.target.value)} />
      </label>
    </>
  );
}
