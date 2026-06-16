/**
 * Pricing math (discount / VAT / currency).
 *
 * R1. Discount: flat % on total subtotal. 0 ≤ rate ≤ 1.
 * R2. VAT: 10%, computed on (total after discount), shown separately ("부가세 별도").
 * R3. Currency: if USD, convert (after discount) using provided exchangeRate (KRW per USD). VAT is computed on the USD amount.
 *     Rounding: KRW → integer. USD → 2 decimals.
 */

const VAT_RATE = 0.1;

/**
 * @param {{subtotal: number}[]} lines
 * @param {number} discountRate   0 ≤ rate ≤ 1
 * @param {'KRW'|'USD'} currency
 * @param {number} [exchangeRate] KRW per 1 USD (required if currency=USD)
 */
function computeTotals(lines, discountRate, currency, exchangeRate) {
    if (!Array.isArray(lines)) throw new TypeError('lines must be array');
    if (!(discountRate >= 0 && discountRate <= 1)) throw new RangeError('discountRate 0..1');
    if (currency !== 'KRW' && currency !== 'USD') throw new RangeError('currency');
    if (currency === 'USD') {
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            throw new RangeError('exchangeRate must be positive number when currency=USD');
        }
    }

    const totalBeforeDiscountKrw = lines.reduce((s, l) => s + Number(l.subtotal || 0), 0);
    const discountAmountKrw = totalBeforeDiscountKrw * discountRate;
    const totalAfterDiscountKrw = totalBeforeDiscountKrw - discountAmountKrw;

    const roundFn = currency === 'KRW' ? Math.round : (x) => Math.round(x * 100) / 100;
    const convert = currency === 'KRW'
        ? (krw) => krw
        : (krw) => krw / exchangeRate;

    const totalBeforeDiscount = roundFn(convert(totalBeforeDiscountKrw));
    const discountAmount      = roundFn(convert(discountAmountKrw));
    const totalAfterDiscount  = roundFn(convert(totalAfterDiscountKrw));
    const vatAmount           = roundFn(convert(totalAfterDiscountKrw) * VAT_RATE);
    const grandTotal          = roundFn(totalAfterDiscount + vatAmount);

    return {
        currency,
        exchangeRate: exchangeRate ?? null,
        totalBeforeDiscount,
        discountAmount,
        totalAfterDiscount,
        vatAmount,
        grandTotal,
    };
}

/**
 * Standard 견적 유효기간: issue date + 60 days
 * @param {Date} issuedAt
 * @returns {Date}
 */
function computeValidUntil(issuedAt) {
    const d = new Date(issuedAt.getTime());
    d.setDate(d.getDate() + 60);
    return d;
}

module.exports = { computeTotals, computeValidUntil, VAT_RATE };
