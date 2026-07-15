/**
 * 회사명 정규화(normCompany) 테스트 — C3 회귀 방지.
 *
 * 검증 핵심:
 *   1) 표기 변형(㈜·(주)·주식회사·앞/뒤·Co.,Ltd)이 같은 키로 통합되는가
 *   2) 낱글자 '주'로 시작하는 서로 다른 회사가 병합되지 않는가 (예전 버그)
 *   3) 영문 접미사(inc/ltd/co)가 단어 중간에서 오매칭되지 않는가 (Lincoln)
 *
 * Node 24 타입 스트리핑으로 .ts를 직접 import. Run: `node --test src/lib/__tests__/company-match.test.js`
 */
const test = require('node:test');
const assert = require('node:assert/strict');

test('normCompany — 표기 변형 통합 / 다른 회사 분리 / 영문 경계', async () => {
  const { normCompany } = await import('../admin/company-match.ts');

  const eq = (a, b) => assert.equal(normCompany(a), normCompany(b), `${a} == ${b} 이어야 함`);
  const ne = (a, b) => assert.notEqual(normCompany(a), normCompany(b), `${a} != ${b} 이어야 함`);

  // 1) 같은 회사의 표기 변형 → 통합
  eq('㈜대웅제약', '대웅제약');
  eq('(주)대웅제약', '대웅제약');
  eq('주식회사 대웅제약', '㈜대웅제약');     // 예전엔 '식회사대웅제약' 이 되어 매칭 실패
  eq('대웅제약 주식회사', '대웅제약');
  eq('대웅제약(주)', '대웅제약');
  eq('셀트리온', '㈜셀트리온');
  eq('Samsung Biologics Co., Ltd.', 'Samsung Biologics');

  // 2) 낱글자 '주/성' — 서로 다른 회사가 병합되면 안 됨 (예전 버그)
  ne('주성엔지니어링', '성엔지니어링');
  ne('우주바이오', '우바이오');
  ne('주노바이오', '노바이오');

  // 3) 영문 접미사 부분 매칭 방지
  assert.equal(normCompany('Lincoln Bio'), 'lincolnbio');   // 'inc' 가 잘리면 안 됨
  assert.equal(normCompany('ABC Inc.'), 'abc');

  // 4) 빈 입력
  assert.equal(normCompany(''), '');
  assert.equal(normCompany(null), '');
});
