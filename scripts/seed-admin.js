/**
 * 관리자 계정 시드 (멱등 — 여러 번 실행해도 안전).
 * catalog 데이터는 JSON(data/)에 있으므로 DB 시드는 운영 데이터(User)만 담당한다.
 * 사용: node scripts/seed-admin.js  (DATABASE_URL 필요)
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const EMAIL = process.env.ADMIN_EMAIL || 'admin@chemon.co.kr';
const PASSWORD = process.env.ADMIN_PASSWORD || 'test1234';
const NAME = process.env.ADMIN_NAME || '관리자';

(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'admin' },
    create: { email: EMAIL, name: NAME, role: 'admin', passwordHash },
  });
  console.log('✅ 관리자 계정:', user.email, '| role:', user.role, '| id:', user.id);
  const total = await prisma.user.count();
  console.log('   전체 사용자 수:', total);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ 시드 실패:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
