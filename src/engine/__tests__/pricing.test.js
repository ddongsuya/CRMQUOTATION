const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { computeTotals, computeValidUntil, VAT_RATE } = require('../pricing');

test('KRW no discount', () => {
    const t = computeTotals([{ subtotal: 1_000_000 }, { subtotal: 500_000 }], 0, 'KRW');
    assert.equal(t.totalBeforeDiscount, 1_500_000);
    assert.equal(t.discountAmount, 0);
    assert.equal(t.totalAfterDiscount, 1_500_000);
    assert.equal(t.vatAmount, 150_000);
    assert.equal(t.grandTotal, 1_650_000);
});

test('KRW 10% discount', () => {
    const t = computeTotals([{ subtotal: 1_000_000 }], 0.1, 'KRW');
    assert.equal(t.totalBeforeDiscount, 1_000_000);
    assert.equal(t.discountAmount, 100_000);
    assert.equal(t.totalAfterDiscount, 900_000);
    assert.equal(t.vatAmount, 90_000);
    assert.equal(t.grandTotal, 990_000);
});

test('USD conversion (rate 1400)', () => {
    const t = computeTotals([{ subtotal: 1_400_000 }], 0, 'USD', 1400);
    assert.equal(t.currency, 'USD');
    assert.equal(t.totalAfterDiscount, 1000);
    assert.equal(t.vatAmount, 100);
    assert.equal(t.grandTotal, 1100);
});

test('invalid inputs', () => {
    assert.throws(() => computeTotals([], -0.1, 'KRW'));
    assert.throws(() => computeTotals([], 1.1, 'KRW'));
    assert.throws(() => computeTotals([], 0, 'EUR'));
    assert.throws(() => computeTotals([], 0, 'USD'));       // no rate
    assert.throws(() => computeTotals([], 0, 'USD', -1));
});

test('validUntil = issuedAt + 60d', () => {
    const d = new Date('2026-04-24T00:00:00Z');
    const v = computeValidUntil(d);
    assert.equal(v.toISOString().slice(0, 10), '2026-06-23');
});

test('[fc] grandTotal ≈ totalAfterDiscount × (1 + VAT_RATE) (KRW)', () => {
    fc.assert(fc.property(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 0, max: 100 }), // 할인률 × 100
        (subtotals, pct) => {
            const lines = subtotals.map(s => ({ subtotal: s }));
            const rate = pct / 100;
            const t = computeTotals(lines, rate, 'KRW');
            const expected = Math.round(t.totalAfterDiscount * (1 + VAT_RATE));
            // KRW rounding drift can accumulate to ±1
            return Math.abs(t.grandTotal - expected) <= 1;
        },
    ));
});

test('[fc] discount monotonic: higher rate → lower totalAfterDiscount', () => {
    fc.assert(fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 50, max: 100 }),
        (subtotals, lowPct, highPct) => {
            const lines = subtotals.map(s => ({ subtotal: s }));
            const low = computeTotals(lines, lowPct / 100, 'KRW');
            const high = computeTotals(lines, highPct / 100, 'KRW');
            return high.totalAfterDiscount <= low.totalAfterDiscount;
        },
    ));
});

test('[fc] USD conversion preserves ratio', () => {
    fc.assert(fc.property(
        fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1000, max: 2000 }),
        (subtotals, rate) => {
            const lines = subtotals.map(s => ({ subtotal: s }));
            const krw = computeTotals(lines, 0, 'KRW');
            const usd = computeTotals(lines, 0, 'USD', rate);
            const expectedUsd = Math.round((krw.totalBeforeDiscount / rate) * 100) / 100;
            return Math.abs(usd.totalBeforeDiscount - expectedUsd) < 0.01;
        },
    ));
});
