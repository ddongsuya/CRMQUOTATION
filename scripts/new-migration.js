#!/usr/bin/env node
/**
 * 새 마이그레이션 생성 — shadow DB 없이(Neon 호환).
 *
 *   npm run db:migrate:new -- add_quote_valid_until
 *
 * 현재 DATABASE_URL 이 가리키는 DB(로컬 = Neon dev 브랜치) 와 prisma/schema.prisma 의 차이를
 * prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql 로 저장한다.
 * 이후 `npm run db:deploy` 로 적용하고, 커밋하면 Vercel(vercel-build) 이 prod 에 적용한다.
 *
 * 전제: DATABASE_URL 의 DB 가 이미 migrations/ 를 모두 적용한 상태여야 한다(아니면 diff 에 옛 변경이 섞인다).
 *       먼저 `npm run db:status` 로 확인할 것.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const name = (process.argv[2] || '').replace(/[^a-zA-Z0-9_]/g, '_');
if (!name) {
  console.error('사용법: npm run db:migrate:new -- <migration_name>');
  process.exit(1);
}
const url = process.env.DATABASE_URL || readEnvFile();
if (!url) { console.error('DATABASE_URL 이 없습니다 (.env 확인).'); process.exit(1); }
if (/neon\.tech/.test(url) && !/-dev|dev-/.test(url) && !process.env.ALLOW_PROD_MIGRATION_DIFF) {
  console.warn('⚠️  DATABASE_URL 이 Neon dev 브랜치가 아닌 것 같습니다. prod 를 기준으로 diff 를 만들면 위험할 수 있습니다.');
  console.warn('    계속하려면 ALLOW_PROD_MIGRATION_DIFF=1 을 붙이세요.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = path.join(__dirname, '..', 'prisma', 'migrations', `${stamp}_${name}`);
const schema = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const sql = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schema, '--script'], {
  encoding: 'utf-8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'],
});
if (/This is an empty migration/.test(sql) || !sql.trim()) {
  console.log('변경 없음 — DB 와 schema.prisma 가 일치합니다.');
  process.exit(0);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'migration.sql'), sql, 'utf-8');
console.log(`생성: ${path.relative(process.cwd(), dir)}/migration.sql`);
console.log('내용을 검토한 뒤: npm run db:deploy');

function readEnvFile() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
    const m = /^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(txt);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
