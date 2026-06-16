/**
 * 회귀 테스트 스냅샷 갱신 (크로스플랫폼).
 *
 * UPDATE_SNAPSHOTS=1 환경변수를 세팅한 채 스냅샷 기반 회귀 테스트를 재실행하여
 * __snapshots__/*.json 을 현재 결과로 덮어쓴다.
 *
 * 사용: npm run test:snapshots:update
 *
 * ⚠ 의도된 변경일 때만 실행할 것. 의도치 않은 가격·로직 변경이 있으면
 *   스냅샷을 덮어쓰면서 회귀를 묻어버린다.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const targets = [
  'src/lib/__tests__/regression-assemble.test.js',
  'src/lib/__tests__/regression-suggest-api.test.js',
];

console.log('[update-snapshots] UPDATE_SNAPSHOTS=1 로 회귀 테스트 재실행...');
const res = spawnSync(process.execPath, ['--test', ...targets], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, UPDATE_SNAPSHOTS: '1' },
});
process.exit(res.status ?? 0);
