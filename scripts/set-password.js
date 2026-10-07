#!/usr/bin/env node
/**
 * 계정 비밀번호 설정(없으면 생성) — 로그인 게이트를 켠 뒤 계정을 발급하는 유일한 공식 경로.
 *
 *   node scripts/set-password.js <email> [--name 이름] [--role ADMIN|CENTER_LEAD|TEAM_LEAD|MEMBER]
 *   (비밀번호는 인자가 아니라 프롬프트로 받는다 — 셸 히스토리에 남지 않게)
 *
 * DATABASE_URL 이 가리키는 DB 에 쓴다. 운영 계정을 만들 땐 운영(main 브랜치) URL 로 실행할 것.
 * 기존 계정이면 비밀번호만 바꾸고, --role 을 준 경우에만 role 도 바꾼다.
 * 예전 데모 계정들은 passwordHash='demo'(bcrypt 아님)라 이 스크립트로 비밀번호를 정해야 로그인할 수 있다.
 */
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const ROLES = ['ADMIN', 'CENTER_LEAD', 'TEAM_LEAD', 'MEMBER'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const name = arg('--name');
  const role = arg('--role');
  if (!email || email.startsWith('--') || !email.includes('@')) {
    console.error('사용법: node scripts/set-password.js <email> [--name 이름] [--role ADMIN|CENTER_LEAD|TEAM_LEAD|MEMBER]');
    process.exit(1);
  }
  if (role && !ROLES.includes(role)) {
    console.error(`role 은 ${ROLES.join(' / ')} 중 하나여야 합니다.`);
    process.exit(1);
  }
  const pw = await askHidden('새 비밀번호(8자 이상): ');
  const pw2 = await askHidden('한 번 더: ');
  if (pw.length < 8) { console.error('비밀번호는 8자 이상이어야 합니다.'); process.exit(1); }
  if (pw !== pw2) { console.error('두 입력이 다릅니다.'); process.exit(1); }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(pw, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { passwordHash, ...(role ? { role } : {}), ...(name ? { name } : {}) },
      });
      console.log(`✔ 비밀번호 변경: ${email} (role=${role ?? existing.role})`);
    } else {
      await prisma.user.create({ data: { email, name: name || email.split('@')[0], passwordHash, role: role || 'MEMBER' } });
      console.log(`✔ 계정 생성: ${email} (role=${role || 'MEMBER'})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1); });
