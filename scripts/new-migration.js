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
{
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  console.log(`기준 DB 호스트: ${host}`);
  if (process.env.PROD_DB_HOST && host === process.env.PROD_DB_HOST) {
    console.error('⚠️  DATABASE_URL 이 운영(PROD_DB_HOST) 을 가리킵니다. 로컬 .env 를 Neon dev 브랜치로 바꾼 뒤 실행하세요.');
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = path.join(__dirname, '..', 'prisma', 'migrations', `${stamp}_${name}`);
const schema = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// shell 을 거치지 않고 prisma CLI 를 직접 실행 — Neon URL 의 '&'(sslmode&channel_binding) 가 cmd.exe 에서 잘리는 문제 방지
const prismaCli = require.resolve('prisma/build/index.js');
const sql = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schema, '--script'], {
  encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'],
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
