/**
 * 데모 조직 시드 — 관리자 대시보드 미리보기용.
 *  · 센터 2개(1센터/2센터) + 구성원 9명(본부장·센터장·팀장·구성원)
 *  · 기존 CRM 데이터(고객사·안건·견적·노트·일정)의 소유(ownerId)를 구성원에 분산
 *  · Quote.userId 채움(딜 소유자 기준) — 관리자 롤업이 성립하도록
 *  · 센터별/전사 수주 목표(Target) 설정 (period=2026H1)
 * 실행: npx ts-node --transpile-only prisma/seed-demo-org.ts
 * 멱등: 이메일/이름 upsert. 데이터 분산은 매 실행 재배분(결정적 round-robin).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PERIOD = '2026H1';

async function main() {
  // 1) 센터 (name unique 아님 → findFirst 후 없으면 create)
  const ensureCenter = async (name: string) =>
    (await prisma.center.findFirst({ where: { name } })) ?? (await prisma.center.create({ data: { name } }));
  const c1 = await ensureCenter('1센터');
  const c2 = await ensureCenter('2센터');
  const centers = [c1, c2];

  // 2) 구성원 (role: ADMIN=본부장 / CENTER_LEAD=센터장 / TEAM_LEAD=팀장 / MEMBER=구성원)
  const members: { email: string; name: string; role: string; centerId: number }[] = [
    { email: 'admin@chemon.co.kr', name: '이본부', role: 'ADMIN', centerId: c1.id },      // 데모 계정 = 본부장
    { email: 'k.sunil@chemon.co.kr', name: '김선일', role: 'CENTER_LEAD', centerId: c1.id },
    { email: 'p.seojun@chemon.co.kr', name: '박서준', role: 'TEAM_LEAD', centerId: c1.id },
    { email: 'c.yuri@chemon.co.kr', name: '최유리', role: 'MEMBER', centerId: c1.id },
    { email: 'j.minho@chemon.co.kr', name: '정민호', role: 'MEMBER', centerId: c1.id },
    { email: 'l.sujin@chemon.co.kr', name: '이수진', role: 'CENTER_LEAD', centerId: c2.id },
    { email: 'k.taeo@chemon.co.kr', name: '강태오', role: 'TEAM_LEAD', centerId: c2.id },
    { email: 'y.areum@chemon.co.kr', name: '윤아름', role: 'MEMBER', centerId: c2.id },
    { email: 'h.jiun@chemon.co.kr', name: '한지운', role: 'MEMBER', centerId: c2.id },
  ];
  const userIds: number[] = [];
  for (const m of members) {
    const u = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, role: m.role, centerId: m.centerId },
      create: { email: m.email, name: m.name, role: m.role, centerId: m.centerId, passwordHash: 'demo' },
    });
    userIds.push(u.id);
  }

  // 3) 기존 데이터 소유 분산 (결정적 round-robin, id 기준)
  const assign = (id: number) => userIds[id % userIds.length];
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const c of companies) await prisma.company.update({ where: { id: c.id }, data: { ownerId: assign(c.id) } });
  const deals = await prisma.deal.findMany({ select: { id: true } });
  for (const d of deals) await prisma.deal.update({ where: { id: d.id }, data: { ownerId: assign(d.id) } });
  const notes = await prisma.note.findMany({ select: { id: true } });
  for (const n of notes) await prisma.note.update({ where: { id: n.id }, data: { ownerId: assign(n.id) } });
  const events = await prisma.calendarEvent.findMany({ select: { id: true } });
  for (const e of events) await prisma.calendarEvent.update({ where: { id: e.id }, data: { ownerId: assign(e.id) } });
  // Quote.userId — 견적도 담당자에 귀속(롤업 핵심). deal 연결 있으면 그 소유자, 없으면 round-robin.
  const quotes = await prisma.quote.findMany({ select: { id: true, dealId: true } });
  for (const q of quotes) {
    let uid = assign(q.id);
    if (q.dealId) { const d = await prisma.deal.findUnique({ where: { id: q.dealId }, select: { ownerId: true } }); if (d) uid = d.ownerId; }
    await prisma.quote.update({ where: { id: q.id }, data: { userId: uid } });
  }

  // 3.5) 데모 볼륨 데이터 — 관리자 대시보드 12종 차트가 성립하도록 고객사·안건·견적 생성.
  //      기존 실데이터는 건드리지 않음. memo='DEMO_SEED' 마커로 멱등(이미 있으면 skip).
  //      전량 삭제하려면: DEMO_SEED 마커 Company/그 하위 Deal·Quote 제거.
  const already = await prisma.company.count({ where: { memo: 'DEMO_SEED' } });
  if (already === 0) {
    const INDUSTRIES = ['제약', '바이오', '백신', '세포·유전자치료', '의료기기', '화장품', '건강기능식품', 'CRO·기타'];
    const MODALITIES = ['의약품', '백신', '세포치료제', '의료기기', '화장품', '건강기능식품'];
    const NAMES = ['한올바이오', '지놈앤컴퍼니', '에이비엘바이오', '알테오젠', '레고켐바이오', '올릭스', '큐로셀',
      '네오이뮨텍', '보로노이', '메드팩토', '샤페론', '지아이이노베이션', '티움바이오', '브릿지바이오',
      '노벨티노빌리티', '카이노스메드', '엔케이맥스', '박셀바이오'];
    // 상태 패턴(수주율≈68%): W=WON/ACCEPTED, L=LOST/REJECTED, A=ACTIVE/SENT
    const PATTERN = ['W', 'W', 'A', 'W', 'L', 'W', 'A', 'W', 'L', 'A', 'W', 'W', 'A', 'L', 'W', 'A', 'W', 'A'];
    const AMT = [128, 245, 96, 312, 178, 405, 67, 523, 154, 89, 276, 198, 342, 112, 458, 231, 175, 388]; // 백만원
    let seq = 0;
    const stamp = (monthIdx: number, day: number) => new Date(2026, monthIdx, day, 10, 0, 0);
    for (let i = 0; i < NAMES.length; i++) {
      const owner = userIds[(i + 1) % userIds.length];   // demo admin(0) 포함 순환 분산
      const industry = INDUSTRIES[i % INDUSTRIES.length];
      const modality = MODALITIES[i % MODALITIES.length];
      const st = PATTERN[i];
      const monthIdx = i % 6;                              // 2026-01 ~ 06
      const created = stamp(monthIdx, 6 + (i % 20));
      const company = await prisma.company.create({
        data: {
          ownerId: owner, name: NAMES[i], industry, memo: 'DEMO_SEED',
          isNewClient: st !== 'W', createdAt: created, updatedAt: created,
          contacts: { create: { name: `담당자${i + 1}`, email: `contact${i + 1}@demo.co.kr`, position: '연구소장' } },
        },
        include: { contacts: true },
      });
      const dealStatus = st === 'W' ? 'WON' : st === 'L' ? 'LOST' : 'ACTIVE';
      const dealStage = st === 'W' ? 'CONTRACT' : st === 'L' ? 'QUOTE' : 'QUOTE';
      const deal = await prisma.deal.create({
        data: {
          ownerId: owner, contactId: company.contacts[0].id,
          title: `${NAMES[i]} ${modality} 독성`, modality, status: dealStatus, stage: dealStage,
          submissionTarget: i % 3 === 0 ? 'US FDA' : 'MFDS',
          createdAt: created, updatedAt: created,
        },
      });
      const total = AMT[i] * 1_000_000;
      const qStatus = st === 'W' ? 'ACCEPTED' : st === 'L' ? 'REJECTED' : 'SENT';
      seq += 1;
      await prisma.quote.create({
        data: {
          quoteNumber: `CK-DEMO-${String(seq).padStart(4, '0')}`,
          userId: owner, dealId: deal.id,
          customerCompany: NAMES[i], customerName: `담당자${i + 1}`,
          projectName: `${NAMES[i]} ${modality} 비임상`, modality,
          status: qStatus,
          totalBeforeDiscount: total, totalAfterDiscount: total,
          vatAmount: Math.round(total * 0.1), grandTotal: Math.round(total * 1.1),
          sentAt: created, issuedAt: created, createdAt: created, updatedAt: created,
          accepted: st === 'W' ? true : st === 'L' ? false : null,
        },
      });
    }
  }

  // 3.6) 데모 활동(노트·일정) — 활동량 KPI·활동 히트맵용. 최근 ~12주 분산. 멱등(마커 title).
  const actAlready = await prisma.note.count({ where: { title: { startsWith: '[DEMO]' } } });
  if (actAlready === 0) {
    const demoCompanies = await prisma.company.findMany({
      where: { memo: 'DEMO_SEED' },
      select: { ownerId: true, contacts: { select: { id: true } }, name: true },
    });
    const today = new Date(2026, 6, 6);                 // 기준일 2026-07-06 (currentDate)
    const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000);
    const NOTE_TYPES = ['MEETING', 'CALL', 'MEMO'];
    const EVT_TYPES = ['MEETING', 'DEADLINE', 'MILESTONE', 'REMINDER'];
    let k = 0;
    for (const co of demoCompanies) {
      const contactId = co.contacts[0]?.id ?? null;
      // 회사당 노트 3 + 일정 3, 최근 84일 내 의사난수(결정적) 분산
      for (let j = 0; j < 3; j++) {
        k++;
        const day = (k * 13) % 84;
        await prisma.note.create({
          data: {
            ownerId: co.ownerId, contactId,
            type: NOTE_TYPES[k % NOTE_TYPES.length],
            title: `[DEMO] ${co.name} ${['미팅', '통화', '메모'][k % 3]}`,
            body: `${co.name} 관련 진행 기록 (데모).`,
            occurredAt: daysAgo(day),
          },
        });
      }
      for (let j = 0; j < 3; j++) {
        k++;
        const day = (k * 17) % 84;
        const dt = daysAgo(day);
        await prisma.calendarEvent.create({
          data: {
            ownerId: co.ownerId, contactId,
            title: `[DEMO] ${co.name} ${['미팅', '마감', '마일스톤', '리마인더'][k % 4]}`,
            type: EVT_TYPES[k % EVT_TYPES.length],
            startAt: dt, allDay: true, source: 'AUTO',
          },
        });
      }
    }
  }

  // 3.7) 전년(2025) 견적 — 실적분석 YoY(전년 동기) 비교용. 소량·ACCEPTED. 멱등(번호 CK-DMY-).
  const yAlready = await prisma.quote.count({ where: { quoteNumber: { startsWith: 'CK-DMY-' } } });
  if (yAlready === 0) {
    const NAMES2 = ['한올바이오', '지놈앤컴퍼니', '알테오젠', '레고켐바이오', '올릭스', '큐로셀', '보로노이', '메드팩토',
      '샤페론', '티움바이오', '브릿지바이오', '엔케이맥스', '박셀바이오', '카이노스메드'];
    const AMT2 = [180, 96, 240, 150, 88, 300, 130, 170, 110, 205, 160, 90, 145, 120]; // 백만원, 전년은 약간 낮게
    for (let i = 0; i < NAMES2.length; i++) {
      const owner = userIds[(i + 2) % userIds.length];
      const modality = ['의약품', '백신', '세포치료제', '의료기기'][i % 4];
      const created = new Date(2025, i % 12, 8 + (i % 18), 10, 0, 0);
      const total = AMT2[i] * 1_000_000;
      await prisma.quote.create({
        data: {
          quoteNumber: `CK-DMY-${String(i + 1).padStart(4, '0')}`,
          userId: owner, customerCompany: NAMES2[i], customerName: `담당자${i + 1}`,
          projectName: `${NAMES2[i]} ${modality} 비임상(전년)`, modality,
          status: 'ACCEPTED',
          totalBeforeDiscount: total, totalAfterDiscount: total,
          vatAmount: Math.round(total * 0.1), grandTotal: Math.round(total * 1.1),
          sentAt: created, issuedAt: created, createdAt: created, updatedAt: created, accepted: true,
        },
      });
    }
  }

  // 4) 목표(Target) — 센터별 2026 상반기 수주액 기준 달성률 ~75~80% 역산 + 전사
  //    ※ 기간 필터 필수(전년 2025 수주 제외 — getTargetGauge 와 동일 기준)
  const H1_GTE = new Date(2026, 0, 1), H1_LT = new Date(2026, 6, 1);
  const wonByCenter = async (centerId: number | null) => {
    const uids = centerId == null ? userIds : (await prisma.user.findMany({ where: { centerId }, select: { id: true } })).map(u => u.id);
    const agg = await prisma.quote.aggregate({ _sum: { grandTotal: true }, where: { status: 'ACCEPTED', userId: { in: uids }, createdAt: { gte: H1_GTE, lt: H1_LT } } });
    return agg._sum.grandTotal ?? 0;
  };
  const setTarget = async (centerId: number | null, ratio: number) => {
    const won = await wonByCenter(centerId);
    const amount = Math.max(won / ratio, 100_000_000);   // 최소 1억
    await prisma.target.upsert({
      where: { centerId_period: { centerId: centerId as number, period: PERIOD } },
      update: { amount },
      create: { centerId, period: PERIOD, amount },
    }).catch(async () => {
      // centerId null 은 복합 unique에서 upsert 제약 → 수동 처리
      const ex = await prisma.target.findFirst({ where: { centerId, period: PERIOD } });
      if (ex) await prisma.target.update({ where: { id: ex.id }, data: { amount } });
      else await prisma.target.create({ data: { centerId, period: PERIOD, amount } });
    });
  };
  await setTarget(c1.id, 0.79);
  await setTarget(c2.id, 0.76);
  await setTarget(null, 0.775);   // 전사

  const counts = { centers: centers.length, members: userIds.length, companies: companies.length, deals: deals.length, quotes: quotes.length };
  console.log('데모 org 시드 완료:', JSON.stringify(counts));
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
