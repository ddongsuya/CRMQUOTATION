/**
 * @typedef {'MFDS' | 'OECD'} PriceStandard
 * @typedef {'KRW' | 'USD'} Currency
 * @typedef {'A' | 'B' | 'SPECIAL' | 'NONE'} RouteGroup
 * @typedef {'DRF' | 'RECOVERY' | 'GLP_ANALYSIS' | 'TK' | null} LinkRelation
 */

/**
 * @typedef TestItem  — shape of an entry in data/test_items.json
 * @property {string} key
 * @property {string} masterId
 * @property {string} testName
 * @property {string[]} modalityPool
 * @property {string|null} adminRoute
 * @property {RouteGroup} routeGroup
 * @property {number|null} studyWeeks
 * @property {number|null} priceMfds
 * @property {number|null} priceOecd
 * @property {number|null} hamryangUnit
 * @property {string|null} hamryangRule
 * @property {string|null} excipientBranch
 * @property {string|null} linkRelation
 * @property {string|null} parentTest
 * @property {boolean} isPrerequisite
 */

/**
 * @typedef QuoteLine
 * @property {'test'|'analysis'} kind
 * @property {string} [testItemKey]
 * @property {string} testName
 * @property {string|null} [adminRoute]
 * @property {number} unitPrice
 * @property {number} quantity
 * @property {number} subtotal
 * @property {LinkRelation} [linkRelation]
 * @property {string} [linkedFromKey]
 * @property {string} [note]
 */

/**
 * @typedef QuoteTotals
 * @property {number} totalBeforeDiscount
 * @property {number} discountAmount
 * @property {number} totalAfterDiscount
 * @property {number} vatAmount
 * @property {number} grandTotal
 * @property {Currency} currency
 * @property {number} [exchangeRate]
 */

module.exports = {};
