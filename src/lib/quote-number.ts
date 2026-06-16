import { prisma } from './prisma';

/**
 * Generate the next quote number for today: CK-YYYYMMDD-NNN
 * NNN is a zero-padded daily sequence (resets each day).
 *
 * We compute by counting existing rows whose quoteNumber starts with today's
 * prefix and using count+1. This is racy under high concurrency but acceptable
 * for a CRO's daily quote volume; tighten with a unique index retry if needed.
 */
export async function nextQuoteNumber(now = new Date()): Promise<string> {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `CK-${yyyy}${mm}${dd}-`;
  const todays = await prisma.quote.count({ where: { quoteNumber: { startsWith: prefix } } });
  const seq = String(todays + 1).padStart(3, '0');
  return prefix + seq;
}
