/**
 * @file src/utils/ns/record/relationships/Lead.ts
 */

/**
 * @enum {number} **`LeadSourceEnum`**
 * @property {number} WEB `-6`
 * @property {number} TRADE_SHOW `-5`
 * @property {number} PARTNER_REFERRAL `-4`
 * @property {number} OTHER `-3`
 * @property {number} ADVERTISEMENT `-2`
 */
export enum LeadSourceEnum {
    WEB = -6,
    TRADE_SHOW = -5,
    PARTNER_REFERRAL = -4,
    OTHER = -3,
    ADVERTISEMENT = -2,
}

export enum LeadStatusEnum {}