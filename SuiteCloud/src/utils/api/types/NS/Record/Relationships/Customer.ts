/**
 * @file src/utils/api/types/NS/Record/Relationships/Customer.ts
 */

/**
 * @enum {number} **`CustomerStatusEnum`**
 */
export enum CustomerStatusEnum {
    UNQUALIFIED = 6,
    QUALIFIED = 7,
    IN_DISCUSSION = 8,
    IDENTIFIED_DECISION_MAKERS = 9,
    PROPOSAL = 10,
    IN_NEGOTIATION = 11,
    PURCHASING = 12,
    CLOSED_WON = 13,
    CLOSED_LOST = 14,
    RENEWAL = 15,
    LOST_CUSTOMER = 16,
}

export interface CustomerBase {
    // TODO implement this
}